// dsh-plugin-devin-bridge 入口。
// 注册 DevinAdapter 为 dsh LLM 的 `devin` provider route，
// 让 dsh 内部的 agent loop 能使用 Devin 的托管模型。
//
// Token 解析优先级：
//   1. settings 面板用户配置（token 字段）
//   2. composition entry config.token（显式配置）
//   3. Devin CLI credentials.toml（`devin auth login` 写入）
//   4. 环境变量 DEVIN_CREDENTIALS_PATH 指定的自定义路径
//
// 当 settings 服务存在时，所有连接事实（token / baseUrl / proxy / retryPolicy 等）
// 通过 settings 面板动态可调，变更即时生效（`live` applies）。

import type { Context, Volatile } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/cordis-plugin-loader'
import z from '@deepseek-ai/schemastery'
import {
  resolveRetryPolicy,
  RetryPolicySchema,
  type RetryPolicyConfig,
  type ResolvedRetryPolicy,
} from '@deepseek-ai/dsh-llm'
import type {} from '@deepseek-ai/dsh-settings'
import type { ImageAttachmentRef, StoredImageAttachment } from '@deepseek-ai/dsh-attachment'
import { DevinAdapter, type DevinCatalogModel } from './adapter/devin.ts'
import { readDevinSession, DEFAULT_API_SERVER_URL } from './adapter/credentials.ts'
import { createDevinAccount } from './account.ts'
import { registerSettingsRoutes, type BridgeStatus } from './settings-rpc.ts'

export const name = 'dsh-plugin-devin-bridge'
export const inject = ['llm', 'settings']

const PROVIDER = 'devin'

// ─── 默认模型 ───────────────────────────────────────────────────────────────

const DEFAULT_MODELS: DevinCatalogModel[] = [
  { id: 'swe-2-high', name: 'SWE-2 High', family: 'SWE-2',
    contextWindow: 262_000, maxTokens: 16_384, supportsImages: true },
  { id: 'glm-5-3-max', name: 'GLM-5.3 Max', family: 'GLM-5.3',
    contextWindow: 1_048_576, maxTokens: 16_384, supportsImages: false },
]

// ─── 配置 schema ────────────────────────────────────────────────────────────

export interface Config {
  /**
   * Devin session token，格式 devin-session-token$<...>。
   * 留空时自动从 Devin CLI 的 credentials.toml 读取（`devin auth login` 写入）。
   */
  token: string
  /** Devin Connect 端点，默认 https://server.codeium.com。 */
  baseUrl: string
  /** 可选出站代理 URL（http/https/socks5）。 */
  proxy: string
  /** 强制 HTTP/1.1 连接 Devin，默认 true。 */
  forceHttp1: boolean
  /** 默认上下文窗口，默认 128000。 */
  defaultContextWindow: number
  /** 默认最大输出 token，默认 16384。 */
  defaultMaxTokens: number
  /** 可用模型列表。 */
  models: DevinCatalogModel[]
  /** 重试策略。 */
  retryPolicy: RetryPolicyConfig
}

const catalogModel: z<DevinCatalogModel> = z.object({
  id: z.string().required(),
  name: z.string(),
  description: z.string(),
  contextWindow: z.number().step(1).min(1),
  maxTokens: z.number().step(1).min(1),
  supportsImages: z.boolean(),
  family: z.string(),
  isPremium: z.boolean(),
  isPromo: z.boolean(),
  creditMultiplier: z.number().step(0.01),
})

export const Config = z.object({
  token: z.string().role('secret').default(''),
  baseUrl: z.string().default('https://server.codeium.com'),
  proxy: z.string().default(''),
  forceHttp1: z.boolean().default(true),
  defaultContextWindow: z.number().step(1).min(1).default(128_000),
  defaultMaxTokens: z.number().step(1).min(1).default(16_384),
  models: z.array(catalogModel).default(DEFAULT_MODELS),
  retryPolicy: RetryPolicySchema,
}).volatile()

// ─── Token 解析 ─────────────────────────────────────────────────────────────

interface ResolvedConnection {
  token: string
  baseUrl: string
}

// ─── 插件入口 ───────────────────────────────────────────────────────────────

export function apply(ctx: Context, config: Volatile<Config>): void {
  // attachment store（用于读取图片）— 在插件加载时获取一次
  const attachments = ctx.get('attachments')
  const readImage: ((ref: ImageAttachmentRef, signal?: AbortSignal) => Promise<StoredImageAttachment>) | undefined =
    attachments
      ? (ref, signal) => attachments.readImage(ref, signal)
      : undefined

  // 新版设置页由 Config 自动生成，命名空间必须是当前 profile entry id。
  const settingsNs = ctx.fiber.entry?.options.id
  if (!settingsNs) throw new Error('devin-bridge: DSH settings entry is unavailable')
  ctx.effect(() => ctx.settings.configure({ auto: true }))
  const source = () => ((ctx.fiber.effectiveConfig ?? config) as Volatile<Config>).get()

  const resolveConn = (): ResolvedConnection => {
    const c = source()
    if (c.token) return { token: c.token, baseUrl: c.baseUrl }
    const session = readDevinSession()
    if (session) {
      const baseUrl = c.baseUrl === DEFAULT_API_SERVER_URL ? session.apiServerUrl : c.baseUrl
      return { token: session.apiKey, baseUrl }
    }
    const hint = process.platform === 'win32'
      ? '%APPDATA%\\devin\\credentials.toml'
      : '~/.local/share/devin/credentials.toml'
    throw new Error(
      `devin-bridge: no Devin session token found. Either:\n` +
      `  1. Set token in the settings panel to a "devin-session-token$..." value, or\n` +
      `  2. Run "devin auth login" to create ${hint}, or\n` +
      `  3. Set DEVIN_CREDENTIALS_PATH to a custom credentials.toml path`,
    )
  }

  // DevinAdapter 持有连接配置 thunk，每次操作时读取最新值
  const adapter = new DevinAdapter({
    options: () => {
      const c = source()
      const { token, baseUrl } = resolveConn()
      return {
        token,
        baseUrl,
        proxy: c.proxy || undefined,
        forceHttp1: c.forceHttp1,
        models: c.models,
        defaultContextWindow: c.defaultContextWindow,
        defaultMaxTokens: c.defaultMaxTokens,
        ...readImage ? { readImage } : {},
      }
    },
  })

  // 注册 configurable provider 目录 + adapter route + model discovery
  // registration handle 在重新注册时先释放旧的
  let directoryHandle: (() => void) | null = null
  let adapterHandle: ((() => void) & { replace?: (p: string[]) => void }) | null = null
  let discoveryHandle: (() => void) | null = null

  const register = (): void => {
    // 解析当前 retryPolicy — 注册时捕获，变更需重新注册
    const retryPolicy: ResolvedRetryPolicy = resolveRetryPolicy(
      structuredClone(source().retryPolicy) as RetryPolicyConfig,
      `llm: provider "${PROVIDER}" retryPolicy`,
    )
    // 覆盖 adapter 的 providerRetryPolicy，让注册时捕获最新策略
    ;(adapter as unknown as {
      providerRetryPolicy: (_provider: string) => ResolvedRetryPolicy | undefined
    }).providerRetryPolicy = () => retryPolicy

    if (!directoryHandle) {
      directoryHandle = ctx.llm.registerConfigurableProviders([
        { provider: PROVIDER, displayName: 'Devin', settingsNs, settingsPath: [] },
      ])
    }
    if (!adapterHandle) {
      adapterHandle = ctx.llm.registerAdapter([PROVIDER], adapter) as never
    }
    if (!discoveryHandle) {
      discoveryHandle = ctx.llm.registerModelDiscovery(settingsNs, (_request, signal) =>
        adapter.discoverModels(signal),
      )
    }
  }

  const unregister = (): void => {
    if (discoveryHandle) {
      try { discoveryHandle() } catch { /* already disposed */ }
      discoveryHandle = null
    }
    if (adapterHandle) {
      try { adapterHandle() } catch { /* already disposed */ }
      adapterHandle = null
    }
    if (directoryHandle) {
      try { directoryHandle() } catch { /* already disposed */ }
      directoryHandle = null
    }
  }

  const refreshRoutes = () => {
    unregister()
    register()
  }

  // SettingsForms persists the chosen catalog through the normal profile layer.
  ctx.on('loader/volatile-update', refreshRoutes)
  ctx.effect(() => () => unregister())
  register()

  const account = createDevinAccount({ onCredentialsChanged: refreshRoutes })
  ctx.effect(() => () => account.dispose())
  let catalog: readonly DevinCatalogModel[] = []
  let catalogAccount: string | undefined
  const currentCredential = () => source().token || readDevinSession()?.apiKey
  const desktop = () => (ctx.get('profileContext') as { name?: string } | undefined)?.name === 'desktop'
  const status = (): BridgeStatus => ({
    account: account.status(),
    desktop: desktop(),
    configuredToken: Boolean(source().token),
    models: source().models,
  })
  ctx.inject(['connection'], (scope) => scope.effect(() => registerSettingsRoutes(
    scope.get('connection') as Parameters<typeof registerSettingsRoutes>[0],
    async (endpoint, payload, signal) => {
      if (endpoint === 'status') return status()
      if (endpoint === 'usage') return adapter.fetchUsage(AbortSignal.any([signal, AbortSignal.timeout(15_000)]))
      if (endpoint === 'catalog') {
        const credential = currentCredential()
        const models = await adapter.fetchModelCatalog(AbortSignal.any([signal, AbortSignal.timeout(20_000)]))
        if (credential !== currentCredential()) throw new Error('Account changed')
        catalog = models
        catalogAccount = credential
        return models
      }
      if (endpoint === 'save') {
        if (!Array.isArray(payload) || payload.length > 300 || !payload.every(id => typeof id === 'string')) {
          throw new Error('Invalid model selection')
        }
        const available = new Map(source().models.map(model => [model.id, model]))
        if (catalogAccount === currentCredential()) {
          for (const model of catalog) available.set(model.id, model)
        }
        const models = [...new Set<string>(payload)].map(id => available.get(id))
        if (models.some(model => !model)) throw new Error('Refresh the catalog first')
        await ctx.settings.update(settingsNs, { models })
        return status()
      }
      if (!desktop()) throw new Error('Account controls require DSH Desktop')
      if (endpoint === 'login') account.login()
      if (endpoint === 'cancel') await account.cancelLogin()
      if (endpoint === 'logout') {
        if (account.status().authenticated) {
          const next = await account.logout()
          if (next.authenticated || next.error) return status()
        }
        if (source().token) await ctx.settings.update(settingsNs, { token: '' })
        catalog = []
        catalogAccount = undefined
      }
      return status()
    },
  )))

}

export { DevinAdapter } from './adapter/devin.ts'
export type { DevinCatalogModel, DevinAdapterOptions, DevinConnectionOptions } from './adapter/devin.ts'
export { readDevinSession, devinCredentialsPath, type DevinSession } from './adapter/credentials.ts'

// Devin Connect 适配器：dsh GenerateOptions → Devin RPC → StreamChunk。
// 实现 dsh-llm 的 LlmAdapter 接口，注册为 `devin` provider route。

import { createClient } from '@connectrpc/connect'
import { create } from '@bufbuild/protobuf'
import { randomBytes, randomUUID } from 'node:crypto'
import {
  LlmAdapter,
  LlmError,
  type GenerateOptions,
  type LlmDiscoveredModel,
  type LlmModelInfo,
  type LlmProviderInfo,
  type LlmResolvedModelInfo,
  type RequestMessage,
  type StreamChunk,
  type ToolSchema,
  type ContentBlock,
  ReasoningEffortId,
  projectToolUpdates,
} from '@deepseek-ai/dsh-llm'
import type { ImageAttachmentRef, StoredImageAttachment } from '@deepseek-ai/dsh-attachment'
import {
  ApiServerService,
  ChatMessageRequestType,
  ExaChatPb_ChatMessagePromptSchema,
  ExaChatPb_ChatToolDefinitionSchema,
  ExaCodeiumCommonPb_ChatMessageSource,
  ExaCodeiumCommonPb_ChatToolCallSchema,
  ExaCodeiumCommonPb_CompletionConfigurationSchema,
  ExaCodeiumCommonPb_ConversationalPlannerMode,
  ExaCodeiumCommonPb_MetadataSchema,
  ExaCortexPb_CortexStepType,
  ExaCortexPb_CortexTrajectoryReferenceSchema,
  ExaCortexPb_CortexTrajectoryType,
  GetCascadeModelConfigsRequestSchema,
  GetChatMessageRequestSchema,
} from '../proto/gen/devin_pb.ts'
import type {
  ExaChatPb_ChatMessagePrompt,
  ExaChatPb_ChatToolDefinition,
  ExaCodeiumCommonPb_ImageData,
  GetChatMessageRequest,
} from '../proto/gen/devin_pb.ts'
import { BillingStrategy, GetUserStatusRequestSchema, SeatManagementService } from '../proto/gen/seat_pb.ts'
import { createDevinTransport } from './transport.ts'
import { DevinStreamDecoder, wrapConnectError } from './decoder.ts'

const CLIENT_NAME = 'chisel'
const CLIENT_VERSION = '3000.2.17'

function devinMetadata(token: string, fingerprint?: string) {
  return create(ExaCodeiumCommonPb_MetadataSchema, {
    apiKey: token,
    extensionName: CLIENT_NAME,
    extensionVersion: CLIENT_VERSION,
    ideName: CLIENT_NAME,
    ideVersion: CLIENT_VERSION,
    locale: 'en',
    os: 'win',
    f: fingerprint,
  })
}

// ─── 配置类型 ───────────────────────────────────────────────────────────────

export interface DevinCatalogModel {
  id: string
  name?: string
  description?: string
  contextWindow?: number
  maxTokens?: number
  supportsImages?: boolean
  /** 模型系列标签（如 "GLM-5.2", "SWE-1.7"），从 model_family_metadata 提取。 */
  family?: string
  /** 是否需要付费 plan。 */
  isPremium?: boolean
  /** 是否当前处于促销期（promo_status.is_active）。 */
  isPromo?: boolean
  /** 信用倍率，用于排序和展示。 */
  creditMultiplier?: number
  /** Devin 标为该系列的默认变体。 */
  isDefault?: boolean
  isRecommended?: boolean
  isNew?: boolean
}

export interface DevinConnectionOptions {
  baseUrl: string
  token: string
  proxy?: string
  forceHttp1: boolean
  models: readonly DevinCatalogModel[]
  defaultContextWindow: number
  defaultMaxTokens: number
  /** 可选的 attachment 读取器，用于获取图片字节 */
  readImage?: (ref: ImageAttachmentRef, signal?: AbortSignal) => Promise<StoredImageAttachment>
}

export interface DevinAdapterOptions {
  /** 当前连接配置；每次操作时调用以获取最新值。 */
  options: () => DevinConnectionOptions
}

export interface DevinUsageWindow {
  remainingPercent: number
  resetAt: string
}

export interface DevinUsage {
  daily?: DevinUsageWindow
  weekly?: DevinUsageWindow
}

function usageWindow(remainingPercent: number, resetAtUnix: bigint): DevinUsageWindow | undefined {
  if (resetAtUnix <= 0n || !Number.isInteger(remainingPercent) || remainingPercent < 0 || remainingPercent > 100) {
    return undefined
  }
  const resetAt = new Date(Number(resetAtUnix) * 1000)
  if (!Number.isFinite(resetAt.valueOf())) return undefined
  return { remainingPercent, resetAt: resetAt.toISOString() }
}

// ─── DevinAdapter ───────────────────────────────────────────────────────────

const PROVIDER = 'devin'

// ─── Reasoning effort → model_uid 后缀映射 ──────────────────────────────────
//
// Devin 的 model_uid 已包含 effort（glm-5-2=High, glm-5-2-max=Max,
// glm-5-2-none=No Thinking, swe-1-7=Max, swe-1-7-medium=Medium）。
// 插件对外只暴露基础 model id（glm-5-2, swe-1-7），通过 dsh 的 reasoning
// effort 滑块（high/medium/max/none）在内部映射到实际 model_uid。

/** dsh effort id → Devin model_uid 后缀。 */
const EFFORT_SUFFIX: Record<string, string> = {
  high: '',           // glm-5-2 → glm-5-2 (High)
  medium: '-medium',  // swe-1-7 → swe-1-7-medium
  max: '-max',        // glm-5-2 → glm-5-2-max
  none: '-none',      // glm-5-2 → glm-5-2-none
}

/** dsh reasoning effort 列表（供 resolveModel 返回给 dsh 显示滑块）。 */
const REASONING_EFFORTS = [
  { id: ReasoningEffortId('high'), name: 'High' },
  { id: ReasoningEffortId('medium'), name: 'Medium' },
  { id: ReasoningEffortId('max'), name: 'Max' },
  { id: ReasoningEffortId('none'), name: 'No Thinking' },
] as const

/**
 * 把 base model id + reasoningEffort 映射到 Devin 实际 model_uid。
 * 如 glm-5-2 + max → glm-5-2-max，swe-1-7 + medium → swe-1-7-medium。
 * 如果映射后的 uid 不在已知模型列表里，回退到 base id。
 */
function resolveModelUid(baseId: string, effort: string | undefined, knownIds: Set<string>): string {
  if (!effort) return baseId
  const suffix = EFFORT_SUFFIX[effort]
  if (suffix === undefined) return baseId
  const mapped = suffix ? `${baseId}${suffix}` : baseId
  // 只有已知模型才用映射后的 uid，否则回退
  return knownIds.has(mapped) ? mapped : baseId
}

/** 格式化发现结果的名称和 Devin 返回的额度倍率。 */
function formatDiscoveredName(m: DevinCatalogModel): string {
  const parts = [m.name ?? m.id]
  if (m.isPromo) parts.push('[Promo]')
  else if (m.isPremium) parts.push('[Premium]')
  if (m.creditMultiplier && m.creditMultiplier > 0) parts.push(`(${m.creditMultiplier}x)`)
  return parts.join(' ')
}

export class DevinAdapter extends LlmAdapter {
  private readonly config: DevinAdapterOptions
  // transport/client 缓存：配置变更时重建
  private cachedClients: {
    apiServer: ReturnType<typeof createClient<typeof ApiServerService>>
    seatManagement: ReturnType<typeof createClient<typeof SeatManagementService>>
  } | null = null
  private cachedClientKey = ''

  constructor(options: DevinAdapterOptions) {
    super()
    this.config = options
  }

  /** 当前连接配置（每次调用读取最新值）。 */
  private conn(): DevinConnectionOptions {
    return this.config.options()
  }

  /** 根据同一套连接参数创建聊天和账号客户端。 */
  private clients(c: DevinConnectionOptions) {
    const key = `${c.baseUrl}\0${c.token}\0${c.proxy ?? ''}\0${c.forceHttp1}`
    if (this.cachedClients !== null && this.cachedClientKey === key) {
      return this.cachedClients
    }
    const transport = createDevinTransport({
      baseUrl: c.baseUrl,
      token: c.token,
      proxy: c.proxy,
      forceHttp1: c.forceHttp1,
    })
    this.cachedClients = {
      apiServer: createClient(ApiServerService, transport),
      seatManagement: createClient(SeatManagementService, transport),
    }
    this.cachedClientKey = key
    return this.cachedClients
  }

  private client(c = this.conn()) {
    return this.clients(c).apiServer
  }

  private seatClient(c: DevinConnectionOptions) {
    return this.clients(c).seatManagement
  }

  override providerInfo(_provider: string): LlmProviderInfo {
    return { id: PROVIDER, name: 'Devin' }
  }

  override async listModels(_provider: string): Promise<readonly LlmModelInfo[]> {
    const c = this.conn()
    return c.models.map((m) => ({
      provider: PROVIDER,
      id: m.id,
      name: m.name ?? m.id,
      ...m.description ? { description: m.description } : {},
      ...m.supportsImages
        ? { inputModalities: ['text' as const, 'image' as const] }
        : { inputModalities: ['text' as const] },
    }))
  }

  override async resolveModel(
    _provider: string,
    model: string,
    _signal?: AbortSignal,
  ): Promise<LlmResolvedModelInfo> {
    const c = this.conn()
    const configured = c.models.find((m) => m.id === model)
    const contextWindow = configured?.contextWindow ?? c.defaultContextWindow
    return {
      provider: PROVIDER,
      id: model,
      name: configured?.name ?? model,
      ...configured?.description ? { description: configured.description } : {},
      ...configured?.supportsImages
        ? { inputModalities: ['text' as const, 'image' as const] }
        : { inputModalities: ['text' as const] },
      context: { contextWindow },
      defaultMaxTokens: configured?.maxTokens ?? c.defaultMaxTokens,
      // 暴露 high/medium/max/none effort 滑块给 dsh；
      // 插件内部在 stream 时映射到实际 model_uid
      reasoning: {
        efforts: REASONING_EFFORTS,
        defaultEffort: ReasoningEffortId('high'),
      },
    }
  }

  // ─── 模型发现（供宿主模型发现接口使用）────────────

  /** 将当前可用模型投影为 DSH 的模型发现格式。 */
  async discoverModels(signal?: AbortSignal): Promise<LlmDiscoveredModel[]> {
    const catalog = await this.fetchModelCatalog(signal)
    return catalog.map((m) => ({
      id: m.id,
      name: formatDiscoveredName(m),
      ...m.contextWindow ? { contextWindow: m.contextWindow } : {},
      ...m.maxTokens ? { maxTokens: m.maxTokens } : {},
    }))
  }

  /**
   * 读取当前账号的目录。每个系列保留一个可选变体及其真实模型 ID，
   * 优先选择 Devin 指定的默认或推荐变体。
   */
  async fetchModelCatalog(signal?: AbortSignal): Promise<DevinCatalogModel[]> {
    const c = this.conn()
    const request = create(GetCascadeModelConfigsRequestSchema, { metadata: devinMetadata(c.token) })
    const response = await this.client(c).getCascadeModelConfigs(request, { signal, timeoutMs: 15_000 })

    const families = new Map<string, { model: DevinCatalogModel; rank: number }>()
    const seen = new Set<string>()
    for (const config of response.clientModelConfigs) {
      if (config.disabled) continue
      const uid = config.modelUid
      if (!uid || seen.has(uid)) continue
      seen.add(uid)
      const family = config.modelFamilyMetadata?.modelFamilyLabel || undefined
      const key = family ? `family:${family}` : `id:${uid}`
      const isDefault = config.modelFamilyMetadata?.isDefaultModelInFamily === true
      const rank = Number(isDefault) * 4
        + Number(config.isRecommended === true) * 2
        - Number(config.isCapacityLimited === true) * 8
      const current = families.get(key)
      if (current && current.rank >= rank) continue
      const model: DevinCatalogModel = {
        id: uid,
        ...config.label ? { name: config.label } : {},
        ...config.description ? { description: config.description } : {},
        ...config.maxTokens > 0 ? {
          contextWindow: config.maxTokens,
          // The catalog limit describes context, not the desired reply length.
          maxTokens: Math.min(config.maxTokens, c.defaultMaxTokens),
        } : {},
        supportsImages: config.supportsImages,
        ...family ? { family } : {},
        isDefault,
        isRecommended: config.isRecommended,
        isNew: config.isNew,
        isPremium: config.isPremium,
        isPromo: config.promoStatus?.isActive === true,
        ...config.creditMultiplier > 0 ? { creditMultiplier: config.creditMultiplier } : {},
      }
      families.set(key, { model, rank })
    }
    return [...families.values()].map(({ model }) => model)
  }

  /** 返回该账号可见的额度窗口。没有日／周额度的计划返回空对象。 */
  async fetchUsage(signal?: AbortSignal): Promise<DevinUsage> {
    const c = this.conn()
    const request = create(GetUserStatusRequestSchema, { metadata: devinMetadata(c.token) })
    const response = await this.seatClient(c).getUserStatus(request, { signal, timeoutMs: 15_000 })
    const status = response.userStatus?.planStatus
    const plan = response.planInfo ?? status?.planInfo
    if (!status || plan?.billingStrategy !== BillingStrategy.QUOTA) return {}

    const daily = plan.hideDailyQuota ? undefined
      : usageWindow(status.dailyQuotaRemainingPercent, status.dailyQuotaResetAtUnix)
    const weekly = plan.hideWeeklyQuota ? undefined
      : usageWindow(status.weeklyQuotaRemainingPercent, status.weeklyQuotaResetAtUnix)
    return { ...daily ? { daily } : {}, ...weekly ? { weekly } : {} }
  }

  async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    // 构建 Devin 请求
    let protoRequest: GetChatMessageRequest
    try {
      protoRequest = await this.buildRequest(options)
    } catch (err) {
      throw new LlmError(
        `Devin request build failed: ${err instanceof Error ? err.message : String(err)}`,
        'INVALID_REQUEST',
        { cause: err as Error },
      )
    }

    // 调用 Devin RPC
    let serverStream: AsyncIterable<import('../proto/gen/devin_pb.ts').GetChatMessageResponse>
    try {
      serverStream = await this.client().getChatMessage(protoRequest)
    } catch (err) {
      throw wrapConnectError(err)
    }

    // 解码响应
    // Auto Review consumes the JSON verdict only. Trailing reasoning frames
    // would put another block after the verdict and invalidate it.
    const decoder = new DevinStreamDecoder(options.purpose !== 'auto-review')
    const iterator = serverStream[Symbol.asyncIterator]()
    let upstreamError: Error | null = null

    try {
      while (true) {
        let result
        try {
          result = await iterator.next()
        } catch (err) {
          upstreamError = err instanceof Error ? err : new Error(String(err))
          break
        }
        if (result.done) break
        if (result.value) {
          yield* decoder.decode(result.value)
        }
      }
    } finally {
      if (typeof iterator.return === 'function') {
        try { await iterator.return() } catch { /* abort teardown */ }
      }
    }

    yield* decoder.finish(upstreamError)
  }

  // ─── buildRequest ─────────────────────────────────────────────────────────

  private async buildRequest(options: GenerateOptions): Promise<GetChatMessageRequest> {
    const c = this.conn()
    // 新版将系统提示词放在消息历史里，并以 developer 消息记录工具目录变化。
    // Devin 不支持增量工具声明，交给宿主投影成当前完整工具列表。
    const { messages, tools } = projectToolUpdates(
      options.messages, options.tools, undefined, options.toolHistory,
    )
    const system = [options.system, ...messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text).join(''))]
      .filter(Boolean).join('\n\n')
    const fingerprint = randomHex(366)
    const trajectoryID = randomUUID()
    const cascadeID = randomUUID()
    const executionID = randomUUID()

    const metadata = devinMetadata(c.token, fingerprint)

    // 把 base model id + reasoningEffort 映射到 Devin 实际 model_uid
    const knownIds = new Set(c.models.map((m) => m.id))
    const effortId = options.reasoningEffort as unknown as string | undefined
    const actualModelUid = resolveModelUid(options.model, effortId, knownIds)

    const result = create(GetChatMessageRequestSchema, {
      metadata,
      prompt: sanitizeSystemPrompt(withToolDescriptions(system, tools)),
      chatModelUid: actualModelUid,
      requestType: ChatMessageRequestType.CASCADE,
      configuration: create(ExaCodeiumCommonPb_CompletionConfigurationSchema, {
        numCompletions: 1n,
        maxTokens: BigInt(options.maxTokens ?? c.defaultMaxTokens),
        maxNewlines: 400n,
        // DSH Auto Review sends 0, which Devin rejects on the wire.
        temperature: options.temperature === 0 ? 0.01 : (options.temperature ?? 1),
        topK: 40n,
        topP: 0.95,
      }),
      trajectoryReference: create(ExaCortexPb_CortexTrajectoryReferenceSchema, {
        trajectoryId: trajectoryID,
        trajectoryType: ExaCortexPb_CortexTrajectoryType.ExaCortexPb_CortexTrajectoryType_CORTEX_TRAJECTORY_TYPE_CASCADE,
        stepType: ExaCortexPb_CortexStepType.ExaCortexPb_CortexStepType_CORTEX_STEP_TYPE_USER_INPUT,
      }),
      cascadeId: cascadeID,
      plannerMode: ExaCodeiumCommonPb_ConversationalPlannerMode.ExaCodeiumCommonPb_ConversationalPlannerMode_CONVERSATIONAL_PLANNER_MODE_DEFAULT,
      executionId: executionID,
    })

    // 当前轮 = 最后一条 assistant 之后的所有 user/tool 消息
    let lastAssistantIndex = -1
    for (let i = 0; i < messages.length; i++) {
      if (messages[i]!.role === 'assistant') {
        lastAssistantIndex = i
      }
    }

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i]!
      if (message.role === 'system') continue
      const converted = await this.convertMessage(
        message,
        i > lastAssistantIndex,
        options.signal,
      )
      result.chatMessagePrompts.push(...converted)
    }

    if (tools) {
      for (const tool of tools) {
        result.tools.push(convertToolDefinition(tool))
      }
    }

    return result
  }

  // ─── 消息转换 ─────────────────────────────────────────────────────────────

  private async convertMessage(
    message: RequestMessage,
    attachImages: boolean,
    signal?: AbortSignal,
  ): Promise<ExaChatPb_ChatMessagePrompt[]> {
    if (message.role === 'tool') {
      // tool result
      const prompt = await this.promptForContent(
        ExaCodeiumCommonPb_ChatMessageSource.ExaCodeiumCommonPb_ChatMessageSource_CHAT_MESSAGE_SOURCE_TOOL,
        message.content,
        attachImages,
        signal,
      )
      prompt.toolCallId = message.toolCallId
      prompt.toolResultIsError = message.isError ?? false
      return [prompt]
    }

    if (message.role === 'assistant') {
      // assistant message
      const prompt = await this.promptForContent(
        ExaCodeiumCommonPb_ChatMessageSource.ExaCodeiumCommonPb_ChatMessageSource_CHAT_MESSAGE_SOURCE_SYSTEM,
        message.content,
        false,
        signal,
      )
      for (const block of message.content) {
        if (block.type === 'tool-call') {
          prompt.toolCalls.push(create(ExaCodeiumCommonPb_ChatToolCallSchema, {
            id: block.id,
            name: block.name,
            argumentsJson: block.arguments,
          }))
        }
      }
      return [prompt]
    }

    // user or plugin → user source
    const prompt = await this.promptForContent(
      ExaCodeiumCommonPb_ChatMessageSource.ExaCodeiumCommonPb_ChatMessageSource_CHAT_MESSAGE_SOURCE_USER,
      message.content,
      attachImages,
      signal,
    )
    return [prompt]
  }

  private async promptForContent(
    source: ExaCodeiumCommonPb_ChatMessageSource,
    content: readonly ContentBlock[],
    attachImages: boolean,
    signal?: AbortSignal,
  ): Promise<ExaChatPb_ChatMessagePrompt> {
    const prompt = create(ExaChatPb_ChatMessagePromptSchema, {
      messageId: randomUUID(),
      source,
    })

    let text = ''
    for (const block of content) {
      switch (block.type) {
        case 'text':
          text += block.text
          break
        case 'reasoning':
          prompt.thinking = block.text
          prompt.thinkingRedacted = false
          break
        case 'image':
          if (!attachImages) {
            if (text.length > 0) text += '\n'
            text += '[Image omitted from history]'
            break
          }
          const readImage = this.conn().readImage
          if (!readImage) {
            throw new LlmError(
              'Devin adapter received an image but no attachment store is available',
              'INVALID_REQUEST',
            )
          }
          try {
            const stored = await readImage(block.attachment, signal)
            const base64 = Buffer.from(stored.data).toString('base64')
            const mimeType = stored.ref.mediaType
            prompt.images.push({ base64Data: base64, mimeType } as ExaCodeiumCommonPb_ImageData)
          } catch (err) {
            throw new LlmError(
              `Failed to read image attachment: ${err instanceof Error ? err.message : String(err)}`,
              'INVALID_REQUEST',
              { cause: err as Error },
            )
          }
          break
        case 'tool-call':
          // assistant 消息中的工具调用在 convertMessage 中单独处理
          break
      }
    }
    prompt.prompt = text
    return prompt
  }
}

// ─── 工具定义转换 ───────────────────────────────────────────────────────────

function convertToolDefinition(tool: ToolSchema): ExaChatPb_ChatToolDefinition {
  const schema = stripSchemaAnnotations(tool.parameters)
  return create(ExaChatPb_ChatToolDefinitionSchema, {
    name: tool.name,
    description: tool.description || tool.name,
    jsonSchemaString: schema,
  })
}

function stripSchemaAnnotations(schema: Record<string, unknown>): string {
  try {
    const cleaned = stripSchemaValueAnnotations(schema, false)
    return JSON.stringify(cleaned)
  } catch {
    return JSON.stringify(schema)
  }
}

function stripSchemaValueAnnotations(value: unknown, propertyNames: boolean): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stripSchemaValueAnnotations(item, false))
  }
  if (value !== null && typeof value === 'object') {
    const cleaned: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (isNaturalLanguageAnnotation(key) && !propertyNames) continue
      if (isSchemaLiteral(key) && !propertyNames) {
        cleaned[key] = child
        continue
      }
      cleaned[key] = stripSchemaValueAnnotations(child, key === 'properties')
    }
    return cleaned
  }
  return value
}

function isSchemaLiteral(key: string): boolean {
  return ['const', 'default', 'enum', 'example', 'examples'].includes(key)
}

function isNaturalLanguageAnnotation(key: string): boolean {
  if (['description', 'title', '$comment'].includes(key)) return true
  return key.toLowerCase().startsWith('x-')
}

// ─── 系统提示词清洗 ─────────────────────────────────────────────────────────

const IDENTITY_REPLACEMENTS: Array<{ pattern: RegExp; replace: string }> = [
  { pattern: /You are Claude Code, Anthropic's official CLI for Claude/gi, replace: 'You are an AI coding assistant' },
  { pattern: /Claude Code is available as a CLI in the terminal, desktop app/gi, replace: 'The assistant is available as a CLI in the terminal, desktop tool' },
  { pattern: /Fast mode for Claude Code uses Claude Opus/gi, replace: 'Fast mode uses the faster output model' },
  { pattern: /The most recent Claude models are the Claude 5 family/gi, replace: 'The most recent models are the latest family' },
  { pattern: /default to the latest and most capable Claude models/gi, replace: 'default to the latest and most capable models' },
  {
    pattern: /IMPORTANT: Assist with authorized security testing[\s\S]*?defensive use cases/g,
    replace: 'IMPORTANT: Assist with authorized security testing and educational contexts. Refuse harmful requests. Dual-use tools require clear authorization context',
  },
]

function sanitizeSystemPrompt(prompt: string): string {
  for (const { pattern, replace } of IDENTITY_REPLACEMENTS) {
    prompt = prompt.replace(pattern, replace)
  }
  return prompt
}

function withToolDescriptions(systemPrompt: string, tools?: readonly ToolSchema[]): string {
  if (!tools || tools.length === 0) return systemPrompt
  let section = ''
  for (const tool of tools) {
    const description = tool.description.trim()
    if (!description) continue
    if (!section) section = '# tools descriptions'
    section += `\n<tool name="${escapeXMLAttribute(tool.name)}">\n`
    section += escapeXMLText(description)
    section += '\n</tool>'
  }
  if (!section) return systemPrompt
  const trimmed = systemPrompt.replace(/[\r\n]+$/, '')
  if (!trimmed.trim()) return section
  return `${trimmed}\n\n${section}`
}

function escapeXMLAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

function escapeXMLText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ─── 辅助函数 ───────────────────────────────────────────────────────────────

function randomHex(size: number): string {
  return randomBytes(size).toString('hex')
}

import React, { useEffect, useState } from 'react'
import type { DevinCatalogModel } from '../adapter/devin.ts'
import type { BridgeStatus, Endpoint, SettingsCalls } from '../settings-rpc.ts'
import { styles } from './styles.ts'

type Call = <E extends Endpoint>(endpoint: E, payload?: unknown, signal?: AbortSignal) => Promise<SettingsCalls[E]>
type Action = Exclude<Endpoint, 'status'>
type Usage = SettingsCalls['usage']

const zh = navigator.language.toLowerCase().startsWith('zh')
const copy = {
  title: zh ? 'Devin 桥' : 'Devin Bridge',
  account: zh ? '登录管理' : 'Account',
  signedIn: zh ? '已登录 Devin' : 'Signed in to Devin',
  signedOut: zh ? '未登录 Devin' : 'Signed out of Devin',
  token: zh ? '正在使用配置里的凭据' : 'Using the configured credential',
  login: zh ? '在浏览器登录' : 'Sign in with browser',
  logout: zh ? '退出登录' : 'Sign out',
  cancel: zh ? '取消登录' : 'Cancel sign-in',
  waiting: zh ? '请在浏览器完成登录，完成后这里会自动更新。' : 'Finish signing in in your browser. This page updates automatically.',
  cli: zh ? '请安装 Devin CLI 或 Devin 桌面版，然后重开此页。' : 'Install Devin CLI or Devin Desktop, then reopen this page.',
  desktop: zh ? '请在 DSH 桌面版管理 Devin 登录。' : 'Manage Devin sign-in from DSH Desktop.',
  usage: zh ? '用量限制' : 'Usage limits',
  day: zh ? '每日' : 'Daily',
  week: zh ? '每周' : 'Weekly',
  remaining: zh ? '剩余' : 'remaining',
  reset: zh ? '重置' : 'Resets',
  noUsage: zh ? 'Devin 未返回这个周期的额度。' : 'Devin did not report a limit for this window.',
  openUsage: zh ? '在 Devin 查看用量 ↗' : 'View usage in Devin ↗',
  checkUsage: zh ? '刷新用量' : 'Refresh usage',
  models: zh ? '聊天模型' : 'Chat models',
  modelsHelp: zh ? '勾选要显示在 DSH 聊天模型列表里的模型，然后保存。' : 'Select the models to show in the DSH chat picker, then save.',
  refresh: zh ? '从 Devin 拉取模型' : 'Fetch models from Devin',
  search: zh ? '搜索模型' : 'Search models',
  shown: zh ? '只看已选' : 'Show selected only',
  save: zh ? '保存模型列表' : 'Save model list',
  empty: zh ? '没有匹配的模型。' : 'No matching models.',
  clear: zh ? '清空选择' : 'Clear selection',
  saved: zh ? '聊天模型列表已保存。' : 'Chat model list saved.',
  busy: zh ? '正在处理…' : 'Working…',
  loading: zh ? '正在读取 Devin 桥设置…' : 'Loading Devin Bridge settings…',
  retry: zh ? '重试' : 'Retry',
  failed: zh ? '操作未完成。请检查 Devin 登录或网络后重试。' : 'The operation failed. Check your Devin sign-in or connection and retry.',
}

function Settings({ call }: { call: Call }) {
  const [state, setState] = useState<BridgeStatus>()
  const [catalog, setCatalog] = useState<readonly DevinCatalogModel[]>([])
  const [selection, setSelection] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [selectedOnly, setSelectedOnly] = useState(false)
  const [usage, setUsage] = useState<Usage>()
  const [action, setAction] = useState<Action>()
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const authenticated = state?.account.authenticated || state?.configuredToken
  const loginPending = state?.account.loginInProgress

  function initialize(next: BridgeStatus) {
    setState(next)
    setSelection(new Set(next.models.map(model => model.id)))
  }

  useEffect(() => {
    const controller = new AbortController()
    void call('status', undefined, controller.signal).then(initialize, () => {
      if (!controller.signal.aborted) setError(copy.failed)
    })
    return () => controller.abort()
  }, [call])

  useEffect(() => {
    if (!loginPending || action) return
    const controller = new AbortController()
    const poll = async () => {
      try {
        const next = await call('status', undefined, controller.signal)
        if (controller.signal.aborted) return
        setState(next)
        if (next.account.loginInProgress) timer = setTimeout(poll, 900)
      } catch {
        if (!controller.signal.aborted) setError(copy.failed)
      }
    }
    let timer = setTimeout(poll, 900)
    return () => { clearTimeout(timer); controller.abort() }
  }, [call, loginPending, action])

  async function run<E extends Action>(operation: E, onResult: (value: SettingsCalls[E]) => void, payload?: unknown) {
    setAction(operation)
    setNotice('')
    setError('')
    try {
      onResult(await call(operation, payload))
    } catch {
      setError(copy.failed)
    } finally {
      setAction(undefined)
    }
  }

  if (!state) return <section className="devin-bridge">
    <p role="status">{error || copy.loading}</p>
    {error && <button onClick={() => { setError(''); void call('status').then(initialize, () => setError(copy.failed)) }}>{copy.retry}</button>}
  </section>

  const available = new Map(state.models.map(model => [model.id, model]))
  for (const model of catalog) available.set(model.id, model)
  const search = query.trim().toLowerCase()
  const results = [...available.values()].filter(model =>
    (!selectedOnly || selection.has(model.id)) &&
    `${model.name ?? ''} ${model.id} ${model.family ?? ''}`.toLowerCase().includes(search),
  )
  const dirty = selection.size !== state.models.length || state.models.some(model => !selection.has(model.id))
  const disabled = Boolean(action || state.account.logoutInProgress)
  const canLogin = state.desktop && state.account.cliAvailable

  return <section className="devin-bridge" aria-label={copy.title}>
    <h2>{copy.title}</h2>
    <section className="devin-section">
      <div className="devin-heading">
        <div>
          <h3>{copy.account}</h3>
          <p>{state.configuredToken ? copy.token : authenticated ? copy.signedIn : copy.signedOut}</p>
        </div>
        {state.desktop && (loginPending
          ? <button disabled={disabled} onClick={() => void run('cancel', setState)}>{copy.cancel}</button>
          : authenticated
            ? <button disabled={disabled || (!canLogin && !state.configuredToken)} onClick={() => void run('logout', next => {
                setState(next)
                if (!next.account.authenticated && !next.configuredToken) { setCatalog([]); setUsage(undefined) }
              })}>{copy.logout}</button>
            : <button className="devin-primary" disabled={disabled || !canLogin} onClick={() => void run('login', setState)}>{copy.login}</button>)}
      </div>
      <p className="devin-note" role="status">{loginPending ? copy.waiting : state.account.error || (!state.desktop ? copy.desktop : !canLogin ? copy.cli : '')}</p>
    </section>
    <section className="devin-section">
      <div className="devin-heading">
        <h3>{copy.usage}</h3>
        <button disabled={disabled || !authenticated} onClick={() => void run('usage', setUsage)}>{copy.checkUsage}</button>
      </div>
      {usage && <div className="devin-usage">
        {(['daily', 'weekly'] as const).map(window => {
          const limit = usage[window]
          const label = window === 'daily' ? copy.day : copy.week
          return <div key={window}>
            <strong>{label}</strong>
            {limit?.remainingPercent != null && <><p>{limit.remainingPercent}% {copy.remaining}</p>
              <progress aria-label={label} max={100} value={limit.remainingPercent} /></>}
            {limit?.resetAt && <p>{copy.reset} {new Date(limit.resetAt).toLocaleString()}</p>}
            {limit?.remainingPercent == null && !limit?.resetAt && <p>{copy.noUsage}</p>}
          </div>
        })}
      </div>}
      <a href="https://app.devin.ai/settings/usage" target="_blank" rel="noreferrer">{copy.openUsage}</a>
    </section>
    <section className="devin-section">
      <div className="devin-heading">
        <div><h3>{copy.models}</h3><p>{copy.modelsHelp}</p></div>
        <button disabled={disabled || !authenticated} onClick={() => void run('catalog', setCatalog)}>{copy.refresh}</button>
      </div>
      <div className="devin-filter">
        <input aria-label={copy.search} placeholder={copy.search} type="search" value={query} onChange={event => setQuery(event.target.value)} />
        <label><input type="checkbox" checked={selectedOnly} onChange={event => setSelectedOnly(event.target.checked)} />{copy.shown}</label>
      </div>
      <div className="devin-models">
        {results.length === 0 && <p>{copy.empty}</p>}
        {results.map(model => <label className="devin-model" key={model.id}>
          <input type="checkbox" checked={selection.has(model.id)} disabled={disabled} onChange={event => {
            const next = new Set(selection)
            if (event.target.checked) next.add(model.id)
            else next.delete(model.id)
            setSelection(next)
          }} />
          <span>{model.name || model.id}<small>{model.id}</small></span>
        </label>)}
      </div>
      <div className="devin-heading devin-save">
        <span aria-live="polite">{zh ? `已选 ${selection.size} 个模型` : `${selection.size} models selected`}</span>
        <div className="devin-actions">
          <button disabled={disabled || selection.size === 0} onClick={() => setSelection(new Set())}>{copy.clear}</button>
          <button className="devin-primary" disabled={disabled || !dirty} onClick={() => void run('save', next => {
            initialize(next)
            setNotice(copy.saved)
          }, [...selection])}>{copy.save}</button>
        </div>
      </div>
    </section>
    <p className="devin-result" role="status">{action ? copy.busy : notice}</p>
    {error && <p className="devin-error" role="alert">{error}</p>}
  </section>
}

interface ClientContext {
  get(service: 'connection'): { rpc: { call(base: string, method: string, payload?: unknown, signal?: AbortSignal): Promise<unknown> } }
  effect(setup: () => () => void): void
  slots: {
    inject(name: string, setup: () => () => void): void
    register<Props>(options: { name: string; id: string; order?: number; label?: () => string; inject?: () => Props }, component: React.ComponentType<Props>): () => void
  }
}

export const inject = ['slots', 'connection']

export function apply(ctx: ClientContext) {
  const rpc = ctx.get('connection').rpc
  const call: Call = async (endpoint, payload, signal) => {
    const response = await rpc.call('/api', `devin-bridge/${endpoint}`, payload ?? null, signal) as { ok: boolean; value?: never }
    if (!response?.ok) throw new Error(copy.failed)
    return response.value!
  }
  ctx.effect(() => {
    const style = document.createElement('style')
    style.textContent = styles
    document.head.append(style)
    return () => style.remove()
  })
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section', id: 'devin-bridge', label: () => copy.title, order: 16, inject: () => ({ call }),
  }, Settings))
  ctx.slots.inject('settings.section.icon', () => ctx.slots.register({
    name: 'settings.section.icon', id: 'devin-bridge',
  }, () => <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
    <path d="M3 17h18M5 17v-4m14 4v-4M5 13a7 7 0 0 0 14 0M8 17v-2m8 2v-2" />
  </svg>))
}

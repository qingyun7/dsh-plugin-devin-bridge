import { spawn, type ChildProcess } from 'node:child_process'
import { accessSync, constants, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, isAbsolute, join, resolve } from 'node:path'
import { devinCredentialsPath, readDevinSession } from './adapter/credentials.ts'

const BUNDLED_MAC_CLI = '/Applications/Devin.app/Contents/Resources/app/extensions/windsurf/devin/bin/devin'
const BROWSER_AUTH = 'devin-browser'
const LOGIN_TIMEOUT = 5 * 60_000
const LOGOUT_TIMEOUT = 15_000
const MAX_RESPONSE_BYTES = 1024 * 1024

export interface DevinAccountStatus {
  cliAvailable: boolean
  authenticated: boolean
  loginInProgress: boolean
  logoutInProgress: boolean
  error?: string
}

function findDevinCli(): string | undefined {
  const executable = process.platform === 'win32' ? 'devin.exe' : 'devin'
  const configured = process.env.DEVIN_CLI_PATH
  const candidates = configured ? [configured] : [
    ...(process.env.PATH ?? '').split(delimiter).filter(isAbsolute).map((dir) => join(dir, executable)),
    join(homedir(), '.local', 'bin', executable),
    ...(process.platform === 'darwin' ? [BUNDLED_MAC_CLI] : []),
  ]
  return candidates.find((path) => {
    if (!isAbsolute(path)) return false
    try {
      accessSync(path, constants.X_OK)
      return statSync(path).isFile()
    } catch {
      return false
    }
  })
}

function hasCustomCredentialsPath(): boolean {
  if (!process.env.DEVIN_CREDENTIALS_PATH) return false
  const defaultPath = process.platform === 'win32'
    ? join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'devin', 'credentials.toml')
    : join(process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share'), 'devin', 'credentials.toml')
  return resolve(devinCredentialsPath()) !== resolve(defaultPath)
}

type Outcome = 'success' | 'cancelled' | 'failed' | 'timeout' | 'unsupported'

interface CliJob {
  finished: Promise<Outcome>
  cancel(): void
}

function watchCli(child: ChildProcess, timeout: number, defaultOutcome: (code: number | null) => Outcome) {
  let outcome: Outcome | undefined
  let forceKill: NodeJS.Timeout | undefined
  const finish = (value: Outcome) => {
    if (outcome !== undefined) return
    outcome = value
    if (child.exitCode !== null || child.signalCode !== null || child.pid === undefined) return
    child.kill('SIGTERM')
    forceKill = setTimeout(() => child.kill('SIGKILL'), 1_000)
    forceKill.unref()
  }
  const deadline = setTimeout(() => finish('timeout'), timeout)
  deadline.unref()
  const finished = new Promise<Outcome>((settle) => {
    child.on('error', () => finish('failed'))
    child.once('close', (code) => {
      clearTimeout(deadline)
      clearTimeout(forceKill)
      settle(outcome ?? defaultOutcome(code))
    })
  })
  return { finish, finished, isFinishing: () => outcome !== undefined, cancel: () => finish('cancelled') }
}

function startBrowserLogin(cli: string): CliJob {
  // ACP advertises Devin's browser flow and needs no pseudo terminal. The CLI
  // starts the browser, exchanges the code, and owns credential persistence.
  const child = spawn(cli, ['acp'], { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true })
  const job = watchCli(child, LOGIN_TIMEOUT, () => 'failed')
  child.stdin.on('error', () => job.finish('failed'))
  child.stdout.on('error', () => job.finish('failed'))
  const request = (id: number, method: string, params: object) => {
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
  }
  let buffer = ''
  let authenticating = false
  child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
    if (job.isFinishing()) return
    buffer += chunk
    if (Buffer.byteLength(buffer, 'utf8') > MAX_RESPONSE_BYTES) {
      job.finish('failed')
      return
    }
    const lines = buffer.split('\n')
    buffer = lines.pop()!
    for (const line of lines) {
      let message: unknown
      try {
        message = JSON.parse(line)
      } catch {
        continue
      }
      if (!message || typeof message !== 'object' || !('id' in message) || 'method' in message) continue
      if (message.id === 1 && !authenticating) {
        const result = 'result' in message ? message.result : undefined
        const methods = result && typeof result === 'object' && 'authMethods' in result ? result.authMethods : []
        if (!Array.isArray(methods) || !methods.some((method) => method?.id === BROWSER_AUTH)) {
          job.finish('unsupported')
          return
        }
        authenticating = true
        request(2, 'authenticate', { methodId: BROWSER_AUTH })
      } else if (message.id === 2 && authenticating) {
        job.finish('result' in message && !('error' in message) ? 'success' : 'failed')
        return
      }
    }
  })
  request(1, 'initialize', { protocolVersion: 1, clientCapabilities: {} })
  return job
}

const CUSTOM_PATH_ERROR = 'This profile uses a custom Devin credentials path. Manage that login in your terminal.'
const NO_CLI_ERROR = 'Devin CLI was not found. Install Devin Desktop or add the Devin CLI to the host PATH.'

export function createDevinAccount({ onCredentialsChanged }: { onCredentialsChanged?: () => void } = {}) {
  let loginJob: CliJob | undefined
  let logoutJob: CliJob | undefined
  let error: string | undefined
  let disposed = false

  const notifyCredentialsChanged = () => {
    try {
      onCredentialsChanged?.()
    } catch {
      error = 'Devin credentials changed, but DSH could not refresh the models. Restart DSH to apply the change.'
    }
  }

  const status = (): DevinAccountStatus => ({
    cliAvailable: findDevinCli() !== undefined,
    authenticated: readDevinSession() !== undefined,
    loginInProgress: loginJob !== undefined,
    logoutInProgress: logoutJob !== undefined,
    ...(error ? { error } : {}),
  })

  const login = (): DevinAccountStatus => {
    if (disposed || loginJob || logoutJob) return status()
    error = undefined
    if (hasCustomCredentialsPath()) {
      error = CUSTOM_PATH_ERROR
      return status()
    }
    if (readDevinSession()) return status()
    const cli = findDevinCli()
    if (!cli) {
      error = NO_CLI_ERROR
      return status()
    }
    const job = startBrowserLogin(cli)
    loginJob = job
    void job.finished.then((result) => {
      loginJob = undefined
      if (disposed) return
      if (readDevinSession()) {
        notifyCredentialsChanged()
      } else if (result === 'timeout') {
        error = 'Devin browser login timed out. Try again.'
      } else if (result === 'unsupported') {
        error = 'This Devin CLI does not support browser login from DSH. Run devin auth login in a terminal.'
      } else if (result !== 'cancelled') {
        error = 'Devin browser login failed. Try again or run devin auth login in a terminal.'
      }
    })
    return status()
  }

  const cancelLogin = async (): Promise<DevinAccountStatus> => {
    const job = loginJob
    job?.cancel()
    await job?.finished
    return status()
  }

  const logout = async (): Promise<DevinAccountStatus> => {
    if (disposed || logoutJob) return status()
    error = undefined
    if (hasCustomCredentialsPath()) {
      error = CUSTOM_PATH_ERROR
      return status()
    }
    const cli = findDevinCli()
    if (!cli) {
      error = NO_CLI_ERROR
      return status()
    }
    // Reserve the logout slot before stopping any pending login so another
    // request cannot launch a second login while its credentials are removed.
    const pendingLogin = loginJob
    let cancelLogout = () => pendingLogin?.cancel()
    const finished = Promise.resolve().then(async (): Promise<Outcome> => {
      pendingLogin?.cancel()
      await pendingLogin?.finished
      if (disposed) return 'cancelled'
      if (!readDevinSession()) return 'success'
      const child = spawn(cli, ['auth', 'logout'], { stdio: 'ignore', windowsHide: true })
      const job = watchCli(child, LOGOUT_TIMEOUT, (code) => code === 0 ? 'success' : 'failed')
      cancelLogout = job.cancel
      return job.finished
    })
    logoutJob = { finished, cancel: () => cancelLogout() }
    try {
      const result = await finished
      if (!disposed) {
        if (!readDevinSession()) notifyCredentialsChanged()
        else if (result === 'timeout') error = 'Devin logout timed out. Try again.'
        else error = 'Devin logout failed. Run devin auth logout in a terminal.'
      }
    } finally {
      logoutJob = undefined
    }
    return status()
  }

  const dispose = async (): Promise<void> => {
    disposed = true
    loginJob?.cancel()
    logoutJob?.cancel()
    await Promise.allSettled([loginJob?.finished, logoutJob?.finished])
  }

  return { status, login, cancelLogin, logout, dispose }
}

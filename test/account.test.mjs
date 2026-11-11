import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import test from 'node:test'
import { createDevinAccount } from '../src/account.ts'

const fakeCli = String.raw`
const { appendFileSync, mkdirSync, rmSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')
const { createInterface } = require('node:readline')
const dir = join(process.env.XDG_DATA_HOME, 'devin')
const creds = join(dir, 'credentials.toml')
const trace = (line) => appendFileSync(process.env.TEST_DEVIN_TRACE, line + '\n')
const respond = (id, data) => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, ...data }) + '\n')
if (process.argv.slice(2).join(' ') === 'auth logout') {
  trace('logout')
  rmSync(creds)
} else if (process.argv[2] === 'acp') {
  trace('acp')
  createInterface({ input: process.stdin }).on('line', (line) => {
    const { id, method, params } = JSON.parse(line)
    if (method === 'initialize') {
      const authMethods = process.env.TEST_DEVIN_BEHAVIOR === 'unsupported' ? [] : [{ id: 'devin-browser' }]
      respond(id, { result: { protocolVersion: 1, authMethods } })
    } else if (method === 'authenticate' && params.methodId === 'devin-browser') {
      trace('authenticate')
      if (process.env.TEST_DEVIN_BEHAVIOR === 'waiting') return
      if (process.env.TEST_DEVIN_BEHAVIOR === 'error') {
        respond(id, { error: { code: -32000, message: 'secret-in-cli-output' } })
        return
      }
      mkdirSync(dir, { recursive: true })
      writeFileSync(creds, 'windsurf_api_key = "devin-session-token$test-only"\n')
      respond(id, { result: {} })
    } else process.exit(1)
  })
} else process.exit(1)
`

async function waitFor(check) {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (check()) return
    await delay(15)
  }
  assert.fail('Timed out waiting for the isolated Devin CLI')
}

test('manages Devin browser auth through the CLI without exposing credentials', { skip: process.platform === 'win32' }, async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-devin-account-'))
  const executable = join(dir, 'fake-devin')
  const trace = join(dir, 'trace')
  const credentials = join(dir, 'devin', 'credentials.toml')
  const env = {
    DEVIN_CLI_PATH: executable,
    DEVIN_CREDENTIALS_PATH: undefined,
    XDG_DATA_HOME: dir,
    TEST_DEVIN_TRACE: trace,
    TEST_DEVIN_BEHAVIOR: undefined,
  }
  const previous = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]))
  const applyEnv = (values) => {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
  applyEnv(env)
  writeFileSync(executable, '#!/usr/bin/env node\n' + fakeCli, { mode: 0o700 })
  let changes = 0
  const account = createDevinAccount({ onCredentialsChanged: () => changes++ })
  t.after(async () => {
    await account.dispose()
    applyEnv(previous)
    rmSync(dir, { recursive: true, force: true })
  })
  const history = () => existsSync(trace) ? readFileSync(trace, 'utf8').trim().split('\n') : []

  await t.test('logs in once through ACP and logs out through the CLI', async () => {
    assert.deepEqual(account.status(), {
      cliAvailable: true, authenticated: false, loginInProgress: false, logoutInProgress: false,
    })
    assert.equal(account.login().loginInProgress, true)
    assert.equal(account.login().loginInProgress, true)
    await waitFor(() => !account.status().loginInProgress)
    assert.deepEqual(history(), ['acp', 'authenticate'])
    assert.deepEqual(account.status(), {
      cliAvailable: true, authenticated: true, loginInProgress: false, logoutInProgress: false,
    })
    assert.equal(changes, 1)
    assert.equal(existsSync(credentials), true)
    const result = account.logout()
    assert.equal(account.status().logoutInProgress, true)
    assert.equal(account.login().loginInProgress, false)
    assert.equal((await result).authenticated, false)
    assert.equal(changes, 2)
    assert.deepEqual(history(), ['acp', 'authenticate', 'logout'])
  })

  await t.test('cancels a browser login that is waiting for user approval', async () => {
    process.env.TEST_DEVIN_BEHAVIOR = 'waiting'
    const before = history().length
    assert.equal(account.login().loginInProgress, true)
    await waitFor(() => history().length === before + 2)
    const cancelled = await account.cancelLogin()
    assert.equal(cancelled.loginInProgress, false)
    assert.equal(cancelled.authenticated, false)
    assert.equal(cancelled.error, undefined)
    assert.equal(changes, 2)
  })

  await t.test('returns a safe failure without echoing CLI output', async () => {
    process.env.TEST_DEVIN_BEHAVIOR = 'error'
    account.login()
    await waitFor(() => !account.status().loginInProgress)
    assert.match(account.status().error, /browser login failed/)
    assert.doesNotMatch(JSON.stringify(account.status()), /secret-in-cli-output/)
    process.env.TEST_DEVIN_BEHAVIOR = 'unsupported'
    account.login()
    await waitFor(() => !account.status().loginInProgress)
    assert.match(account.status().error, /does not support browser login/)
  })

  await t.test('preserves both credential files when an override is active', async () => {
    mkdirSync(join(dir, 'devin'), { recursive: true })
    writeFileSync(credentials, 'windsurf_api_key = "default-test-token"\n')
    const custom = join(dir, 'custom.toml')
    writeFileSync(custom, 'windsurf_api_key = "custom-test-token"\n')
    process.env.DEVIN_CREDENTIALS_PATH = custom
    const before = history()
    assert.equal(account.status().authenticated, true)
    assert.match(account.login().error, /custom Devin credentials path/)
    assert.match((await account.logout()).error, /custom Devin credentials path/)
    assert.equal(existsSync(credentials), true)
    assert.equal(existsSync(custom), true)
    assert.deepEqual(history(), before)
  })
})

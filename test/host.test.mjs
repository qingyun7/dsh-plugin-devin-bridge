import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { Context } from '@deepseek-ai/cordis'
import { Loader } from '@deepseek-ai/cordis-plugin-loader'
import { SettingsForms } from '@deepseek-ai/dsh-settings'
import * as bridge from '../lib/index.js'

// Real Cordis, Loader and SettingsForms; only the profile persistence boundary
// and LLM registration registry are replaced. No personal profile or credentials
// are read, and no Devin request is made.
async function startHost(t) {
  const home = await mkdtemp(join(tmpdir(), 'devin-bridge-host-test-'))
  const ctx = new Context()
  const records = []
  const policies = []
  const entryId = 'test-devin-instance'
  const register = (kind, value) => {
    assert.equal(records.filter((row) => row.kind === kind && row.active).length, 0,
      `${kind}: the previous registration must be released before replacement`)
    const row = { kind, value, active: true, releases: 0 }
    records.push(row)
    return () => { row.active = false; row.releases++ }
  }
  const provides = [
    ctx.provide('profileContext', { home, name: 'test-profile' }),
    ctx.provide('llm', {
      registerConfigurableProviders: (entries) => register('directory', entries),
      registerAdapter: (providers, adapter) => register('adapter', { providers, adapter }),
      registerModelDiscovery: (ns, discover) => register('discovery', { ns, discover }),
    }),
  ]
  const loaderFiber = ctx.plugin(Loader)
  await loaderFiber.await()
  const loader = ctx.loader
  provides.push(ctx.provide('configEditor', {
    documentPath: join(home, 'profile.patch.yml'),
    entries: () => [...loader.entries()],
    configuration: () => [...loader.entries()].map((entry) => ({
      entry, inherited: {}, override: entry.options.config ?? {},
    })),
    async edit(entry, change) {
      const config = change(entry.options.config ?? {}, {})
      await loader.update(entry.options.id, { config })
      await loader.await()
    },
  }))
  class RecordingSettings extends SettingsForms {
    configure(policy, owner) {
      policies.push(policy)
      return super.configure(policy, owner)
    }
  }
  const settingsFiber = ctx.plugin(RecordingSettings)
  await settingsFiber.await()
  loader.builtins.bridge = bridge
  // Cleanup is registered before loading the plugin so a failed activation
  // still removes its effects and the isolated temporary directory.
  t.after(async () => {
    if (loader.store[entryId]) loader.remove(entryId)
    await loader.await()
    await settingsFiber.dispose()
    await loaderFiber.dispose()
    for (const dispose of provides.reverse()) await dispose()
    await rm(home, { recursive: true, force: true })
  })
  await loader.root.create({
    id: entryId,
    name: 'cordis:bridge',
    config: { token: 'test-only-token', models: [{ id: 'initial-model', name: 'Initial model' }] },
  })
  await loader.await()
  const entry = loader.resolve(entryId)
  await entry.fiber.await()
  assert.equal(entry.fiber.state, 2, 'the plugin must be active')
  const active = (kind) => records.filter((row) => row.kind === kind && row.active)
  const adapter = () => active('adapter')[0].value.adapter
  return { ctx, loader, entry, entryId, records, policies, active, adapter }
}

test('real SettingsForms exposes the entry namespace and redacts the token', async (t) => {
  const host = await startHost(t)
  const { ctx, entryId, policies, active } = host
  assert.deepEqual(policies, [{ auto: true }])
  assert.deepEqual(active('directory')[0].value, [{
    provider: 'devin', displayName: 'Devin', settingsNs: entryId, settingsPath: [],
  }])
  assert.equal(active('discovery')[0].value.ns, entryId)
  const descriptors = ctx.settings.describe({ redactSecrets: true })
  const form = descriptors.find((row) => row.ns === entryId)
  assert.ok(form, 'a Config schema without volatile fields would produce no form')
  assert.equal(form.autoGenerate, true)
  assert.equal(form.applies, 'live')
  assert.equal(Object.hasOwn(form.value, 'token'), false)
  assert.deepEqual(form.secrets, [{ path: ['token'], set: true }])
  assert.deepEqual(form.value.models, [{ id: 'initial-model', name: 'Initial model' }])
})

test('saving through real SettingsForms updates the active adapter and survives reload', async (t) => {
  const host = await startHost(t)
  const { ctx, loader, entry, entryId, adapter, active, records } = host
  const firstAdapter = adapter()
  const firstModel = await firstAdapter.resolveModel('devin', 'initial-model')
  assert.equal(firstModel.name, 'Initial model')
  const form = ctx.settings.describe().find((row) => row.ns === entryId)
  await ctx.settings.update(entryId, {
    models: [{ id: 'updated-model', name: 'Updated model', contextWindow: 99000, maxTokens: 1200 }],
    retryPolicy: { mode: 'normal', maxRetries: 7 },
    proxy: 'http://127.0.0.1:8123',
  }, form.revision)
  assert.equal(entry.fiber.state, 2)
  assert.equal(adapter(), firstAdapter, 'volatile settings should update the running instance')
  const updated = await adapter().resolveModel('devin', 'updated-model')
  assert.equal(updated.name, 'Updated model')
  assert.equal(updated.context.contextWindow, 99000)
  assert.equal(updated.defaultMaxTokens, 1200)
  assert.equal(adapter().providerRetryPolicy('devin').maxRetries, 7)
  assert.equal(ctx.settings.describe().find((row) => row.ns === entryId).value.token, 'test-only-token',
    'editing non-secret fields must preserve the token')
  for (const kind of ['directory', 'adapter', 'discovery']) {
    assert.equal(active(kind).length, 1)
    assert.ok(records.some((row) => row.kind === kind && !row.active && row.releases === 1))
  }
  const savedConfig = structuredClone(entry.options.config)
  await entry.update({ disabled: true })
  await loader.await()
  await entry.update({ disabled: false, config: savedConfig })
  await loader.await()
  await entry.fiber.await()
  assert.equal(entry.fiber.state, 2)
  assert.notEqual(adapter(), firstAdapter, 're-enabling creates a fresh plugin instance')
  assert.equal((await adapter().resolveModel('devin', 'updated-model')).name, 'Updated model')
  assert.equal(adapter().providerRetryPolicy('devin').maxRetries, 7)
})

test('discovery forwards cancellation and unloading releases all three registrations', async (t) => {
  const host = await startHost(t)
  const { loader, entryId, active, adapter, records } = host
  const signal = AbortSignal.abort(new Error('test cancellation'))
  const originalDiscovery = adapter().discoverModels
  adapter().discoverModels = async (received) => {
    assert.equal(received, signal)
    return [{ id: 'discovered-without-network' }]
  }
  try {
    assert.deepEqual(await active('discovery')[0].value.discover({ provider: 'devin' }, signal),
      [{ id: 'discovered-without-network' }])
  } finally {
    adapter().discoverModels = originalDiscovery
  }
  loader.remove(entryId)
  await loader.await()
  for (const kind of ['directory', 'adapter', 'discovery']) assert.equal(active(kind).length, 0)
  assert.equal(records.length, 3)
  for (const row of records) assert.equal(row.releases, 1, `${row.kind} must be released exactly once`)
})

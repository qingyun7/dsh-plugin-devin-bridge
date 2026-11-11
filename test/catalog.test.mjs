import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DevinAdapter } from '../lib/index.js'

function adapter() {
  return new DevinAdapter({ options: () => ({
    token: 'test-token',
    baseUrl: 'https://example.invalid',
    forceHttp1: true,
    models: [{ id: 'visible-model' }],
    defaultContextWindow: 128_000,
    defaultMaxTokens: 16_384,
  }) })
}

test('refresh selects available representative models without changing the configured selector', async () => {
  const bridge = adapter()
  const signal = new AbortController().signal
  const family = (modelFamilyLabel, isDefaultModelInFamily = false) => ({
    modelFamilyLabel, isDefaultModelInFamily,
  })
  const variant = (modelUid, modelFamilyMetadata, extra = {}) => ({
    modelUid, modelFamilyMetadata, label: modelUid, maxTokens: 262_000, ...extra,
  })
  bridge.client = () => ({
    async getCascadeModelConfigs(_request, options) {
      assert.equal(options.signal, signal)
      return { clientModelConfigs: [
        variant('swe-2-medium', family('SWE-2'), { isRecommended: true }),
        variant('swe-2-high', family('SWE-2', true), { supportsImages: true, promoStatus: { isActive: true } }),
        variant('glm-5-3-max', family('GLM-5.3', true), { isCapacityLimited: true }),
        variant('glm-5-3-high', family('GLM-5.3')),
        variant('hidden-model', family('Hidden'), { disabled: true }),
        variant('standalone', undefined),
        variant('standalone', undefined),
      ] }
    },
  })

  const catalog = await bridge.fetchModelCatalog(signal)
  assert.deepEqual(catalog.map(({ id }) => id), ['swe-2-high', 'glm-5-3-high', 'standalone'])
  assert.equal(catalog[0].contextWindow, 262_000)
  assert.equal(catalog[0].maxTokens, 16_384)
  assert.equal(catalog[0].supportsImages, true)
  assert.equal(catalog[0].isPromo, true)
  assert.deepEqual((await bridge.discoverModels(signal)).map(({ id }) => id), catalog.map(({ id }) => id))
  assert.deepEqual((await bridge.listModels('devin')).map(({ id }) => id), ['visible-model'])
})

test('usage retains exhausted quotas and respects hidden windows and non-quota plans', async () => {
  const bridge = adapter()
  const signal = new AbortController().signal
  const planInfo = { billingStrategy: 2, hideWeeklyQuota: true }
  bridge.seatClient = () => ({
    async getUserStatus(_request, options) {
      assert.equal(options.signal, signal)
      return {
        planInfo,
        userStatus: { planStatus: {
          dailyQuotaRemainingPercent: 0,
          weeklyQuotaRemainingPercent: 42,
          dailyQuotaResetAtUnix: 1_794_384_000n,
          weeklyQuotaResetAtUnix: 1_794_729_600n,
        } },
      }
    },
  })

  assert.deepEqual(await bridge.fetchUsage(signal), {
    daily: { remainingPercent: 0, resetAt: '2026-11-11T08:00:00.000Z' },
  })
  planInfo.hideWeeklyQuota = false
  assert.deepEqual((await bridge.fetchUsage(signal)).weekly, {
    remainingPercent: 42, resetAt: '2026-11-15T08:00:00.000Z',
  })
  planInfo.billingStrategy = 1
  assert.deepEqual(await bridge.fetchUsage(signal), {})
})

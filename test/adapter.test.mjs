import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BlockAssembler, createAssistantMessage, createSystemMessage, createToolResultMessage, ToolCallId } from '@deepseek-ai/dsh-llm'
import { DevinAdapter } from '../lib/index.js'

function harness(responses = []) {
  let request
  const adapter = new DevinAdapter({ options: () => ({
    token: 'test-token', baseUrl: 'https://example.invalid', forceHttp1: true,
    models: [{ id: 'test-model' }], defaultContextWindow: 128000, defaultMaxTokens: 16384,
  }) })
  // Exercise the complete adapter stream while keeping every RPC local.
  adapter.client = () => ({ getChatMessage: async function* (value) {
    request = value
    yield* responses
  } })
  return {
    async run(messages, extra = {}) {
      const chunks = []
      for await (const chunk of adapter.stream({ provider: 'devin', model: 'test-model', messages, ...extra })) chunks.push(chunk)
      return { request, chunks }
    },
  }
}

function response(overrides) {
  return { deltaText: '', deltaThinking: '', deltaSignature: '', thinkingRedacted: false,
    deltaToolCalls: [], stopReason: 0, ...overrides }
}

test('accepts identity-free user input and places history system prompts in the system slot', async () => {
  const { request } = await harness().run([
    createSystemMessage('Keep answers short.'),
    { role: 'user', content: [{ type: 'text', text: 'hello' }] },
  ], { system: 'Use plain language.' })
  assert.match(request.prompt, /Use plain language\./)
  assert.match(request.prompt, /Keep answers short\./)
  assert.equal(request.chatMessagePrompts.length, 1)
  assert.equal(request.chatMessagePrompts[0].prompt, 'hello')
})

test('preserves tool call ids and first-class tool failure results across a full turn', async () => {
  const callId = ToolCallId('call-example')
  const { chunks } = await harness([response({ deltaToolCalls: [
    { id: callId, name: 'read_file', argumentsJson: '{"path":"missing"}' },
  ] })]).run([{ role: 'user', content: [{ type: 'text', text: 'Read the file' }] }])
  const call = chunks.find((chunk) => chunk.type === 'block-end' && chunk.block.type === 'tool-call')?.block
  assert.deepEqual(call, { type: 'tool-call', id: callId, name: 'read_file', arguments: '{"path":"missing"}' })
  const assistant = createAssistantMessage({ content: [call], source: { provider: 'devin', model: 'test-model' } })
  const result = createToolResultMessage({ callId, content: [{ type: 'text', text: 'File not found' }], isError: true })
  const { request } = await harness().run([assistant, result])
  assert.equal(request.chatMessagePrompts[0].toolCalls[0].id, callId)
  assert.equal(request.chatMessagePrompts[1].toolCallId, callId)
  assert.equal(request.chatMessagePrompts[1].toolResultIsError, true)
  assert.equal(request.chatMessagePrompts[1].prompt, 'File not found')
})

test('sends complete current tools without leaking developer tool updates into chat', async () => {
  const { request } = await harness().run([
    { id: 'tool-update', role: 'developer', source: { kind: 'test' }, content: [{ type: 'tool-removal', names: ['old_tool'] }] },
    { role: 'user', content: [{ type: 'text', text: 'Continue' }] },
  ], { tools: [{ name: 'new_tool', description: 'Current tool', parameters: { type: 'object', properties: {} } }] })
  assert.deepEqual(request.tools.map((tool) => tool.name), ['new_tool'])
  assert.deepEqual(request.chatMessagePrompts.map((message) => message.prompt), ['Continue'])
})

test('sends a Devin-compatible temperature for DSH Auto Review', async () => {
  const messages = [{ role: 'user', content: [{ type: 'text', text: 'Review a local read.' }] }]
  const { request } = await harness().run(messages, { purpose: 'auto-review', temperature: 0 })
  assert.equal(request.configuration.temperature, 0.01)
  const normal = await harness().run(messages, { temperature: 0.5 })
  assert.equal(normal.request.configuration.temperature, 0.5)
})

test('reports a rejected streaming request as invalid input', async () => {
  const broken = {
    *[Symbol.iterator]() {
      throw new Error('[invalid_argument] an internal error occurred')
    },
  }
  const { chunks } = await harness(broken).run([])
  assert.equal(chunks.at(-1).reason.failure.code, 'INVALID_REQUEST')
})

test('keeps the Auto Review verdict as the final text block even with late thinking metadata', async () => {
  const verdict = '{"risk":"low","decision":"allow"}'
  const { chunks } = await harness([
    response({ deltaThinking: 'Consider the action.' }),
    response({ deltaText: verdict }),
    response({ deltaSignature: 'trailing-signature' }),
  ]).run([], { purpose: 'auto-review', temperature: 0 })
  const assembler = new BlockAssembler()
  for (const chunk of chunks) assembler.push(chunk)
  assert.deepEqual(assembler.blocks(), [{ type: 'text', text: verdict }])
  assert.equal(chunks.at(-1).reason.kind, 'stop')
})

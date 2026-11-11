/** DSH's authenticated host/client bridge for the Devin settings section. */
import type { DevinAdapter, DevinCatalogModel } from './adapter/devin.ts'
import type { DevinAccountStatus } from './account.ts'

export const namespace = 'devin-bridge'
export const endpoints = ['status', 'login', 'cancel', 'logout', 'catalog', 'save', 'usage'] as const
export type Endpoint = typeof endpoints[number]

export interface BridgeStatus {
  account: DevinAccountStatus
  desktop: boolean
  configuredToken: boolean
  models: readonly DevinCatalogModel[]
}

export interface SettingsCalls {
  status: BridgeStatus
  login: BridgeStatus
  cancel: BridgeStatus
  logout: BridgeStatus
  catalog: readonly DevinCatalogModel[]
  save: BridgeStatus
  usage: Awaited<ReturnType<DevinAdapter['fetchUsage']>>
}

interface Connection {
  fetch: {
    register(route: {
      path: string
      methods: string[]
      requestBody: 'buffered'
      fetch: (request: Request) => Promise<Response>
    }): () => void
  }
}

export function registerSettingsRoutes(
  connection: Connection,
  handle: (endpoint: Endpoint, payload: unknown, signal: AbortSignal) => Promise<unknown>,
): () => void {
  const disposers: Array<() => void> = []
  try {
    for (const endpoint of endpoints) {
      const method = `${namespace}/${endpoint}`
      disposers.push(connection.fetch.register({
        path: `/api/${method}`,
        methods: ['POST'],
        requestBody: 'buffered',
        async fetch(request) {
          if (endpoint === 'login' || endpoint === 'cancel' || endpoint === 'logout') {
            // Electron forwards authenticated requests to its loopback host and
            // strips Origin. Reject remote browser origins for local CLI actions.
            const authority = request.headers.get('host') ?? ''
            const origin = request.headers.get('origin')
            // The carrier constructs Request.url with dsh.internal; the
            // admitted Host header retains the actual loopback authority.
            const loopback = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::[0-9]+)?$/u.test(authority)
            if (!loopback || (origin && origin !== `http://${authority}` && origin !== `https://${authority}`)) {
              return new Response(null, { status: 403 })
            }
          }
          if (request.headers.get('content-type')?.split(';')[0]?.trim() !== 'application/json') {
            return new Response('JSON required', { status: 415 })
          }
          const envelope = await request.json().catch(() => null) as { method?: unknown; rpcId?: unknown; payload?: unknown } | null
          if (!envelope || envelope.method !== method || typeof envelope.rpcId !== 'string') {
            return new Response('Invalid request', { status: 400 })
          }
          const result = await handle(endpoint, envelope.payload, request.signal)
            .then(value => ({ ok: true, value }), () => ({ ok: false }))
          return Response.json({ type: 'server-response', rpcId: envelope.rpcId, result })
        },
      }))
    }
  } catch (error) {
    disposers.reverse().forEach(dispose => dispose())
    throw error
  }
  return () => disposers.reverse().forEach(dispose => dispose())
}

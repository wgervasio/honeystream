import { TransportMessageValidator } from './contracts'

export type E2EWebSocketRole = 'guest' | 'host'
export type UnknownRecord = { readonly [key: string]: unknown }
export type RelayMessageParseResult =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly reason: string }

export interface E2EWebSocketPeerTransportOptions<TInboundMessage> {
  readonly inboundValidator: TransportMessageValidator<TInboundMessage>
  readonly localPeerId: string
  readonly now?: () => number
  readonly remotePeerIdHint: string
  readonly role: E2EWebSocketRole
  readonly roomId: string
  readonly url?: string
  readonly connectTimeoutMs?: number
}

export const RELAY_PATH = '/__honeystream_e2e_peer_relay__'

export const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null

export const parseRelayMessage = (value: unknown): RelayMessageParseResult => {
  if (typeof value !== 'string') return { ok: true, value }
  try {
    return { ok: true, value: JSON.parse(value) }
  } catch {
    return { ok: false, reason: 'E2E relay message must be valid JSON.' }
  }
}

export const toRelayUrl = (options: {
  readonly localPeerId: string
  readonly role: E2EWebSocketRole
  readonly roomId: string
  readonly url?: string
}): string => {
  const baseUrl =
    options.url ||
    `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}${RELAY_PATH}`
  const url = new URL(baseUrl)
  url.searchParams.set('peerId', options.localPeerId)
  url.searchParams.set('role', options.role)
  url.searchParams.set('roomId', options.roomId)
  return url.toString()
}

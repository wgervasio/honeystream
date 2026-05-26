import type NetConnection from '../../network/connection'
import type NetServer from '../../network/server'
import { WireEnvelope } from '../../protocol'
import { PeerTransportEnvelope, PeerTransportListener } from '../contracts'

/**
 * architecture-analyzer-exception: import-boundary
 * Context:
 * SessionRuntime needs a temporary bridge that moves WireEnvelope traffic over existing NetServer/NetConnection primitives.
 * Invariant:
 * Legacy network imports remain isolated to transport/legacy-net and do not pull Redux middleware into new runtime code.
 * Options considered:
 * Rewrite legacy network primitives now, duplicate transport logic, or add a thin adapter over NetServer/NetConnection.
 * Decision:
 * Add a narrow WireEnvelope adapter in transport/legacy-net while WebRTC PeerTransport cutover is in progress.
 * Performance impact:
 * Constant-time frame header checks plus JSON parse/serialize per wire message.
 * Memory/lifecycle ownership:
 * LegacyNetWireTransport owns only listeners it registers and removes every listener in dispose().
 * Failure mode:
 * Malformed framed payloads move the transport to a failed state with typed validation errors.
 * Validation:
 * transport/legacy-net/legacy-net-wire-transport.spec.ts exercises send, receive, and cleanup behavior.
 * Removal condition:
 * Delete this adapter once SessionRuntime uses the new WebRTC transport path end-to-end.
 */
export type LegacyNetServerPrimitive = NetServer
export type LegacyNetConnectionPrimitive = NetConnection

export const LEGACY_NET_WIRE_HEADER = Buffer.from('HSWIRE1', 'utf-8')
export const MAX_SUBSCRIBERS = 32
export const UNKNOWN_PEER_ID = 'unknown-peer'

type UnknownRecord = { readonly [key: string]: unknown }

type LegacyPeerId = { toString(): string }

export interface LegacyNetConnectionLike {
  readonly id: LegacyPeerId
  readonly connected?: boolean
}

export interface LegacyNetServerLike {
  readonly isHost: boolean
  readonly connected: boolean
  on(eventName: string | symbol, listener: (...args: readonly unknown[]) => void): this
  removeListener(eventName: string | symbol, listener: (...args: readonly unknown[]) => void): this
  getClientById(clientId: string): LegacyNetConnectionLike | undefined
  sendTo(clientId: string, data: Buffer): void
  sendToHost(data: Buffer): void
  close(): void
}

type Clock = () => number

export interface LegacyNetWireTransportOptions {
  readonly server: LegacyNetServerLike
  readonly localPeerId: string
  readonly remotePeerIdHint?: string
  readonly ownsServer?: boolean
  readonly now?: Clock
}

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null

const isLegacyPeerId = (value: unknown): value is LegacyPeerId =>
  isRecord(value) && typeof value.toString === 'function'

export const isLegacyNetConnection = (value: unknown): value is LegacyNetConnectionLike =>
  isRecord(value) && isLegacyPeerId(value.id)

export const asWirePayload = (data: Buffer): Buffer | null => {
  if (data.length <= LEGACY_NET_WIRE_HEADER.length) {
    return null
  }
  const maybeHeader = data.slice(0, LEGACY_NET_WIRE_HEADER.length)
  if (!maybeHeader.equals(LEGACY_NET_WIRE_HEADER)) {
    return null
  }
  return data.slice(LEGACY_NET_WIRE_HEADER.length)
}

export const toPeerTransportEnvelope = (
  wireEnvelope: WireEnvelope
): PeerTransportEnvelope<WireEnvelope> => ({
  seq: wireEnvelope.seq,
  sentAtMs: wireEnvelope.sentAtMs,
  message: wireEnvelope
})

export type WireTransportListener = PeerTransportListener<WireEnvelope>

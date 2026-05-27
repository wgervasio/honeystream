import { PeerTransportEnvelope, TransportMessageValidator } from './contracts'

export type Clock = () => number

export const MAX_SIMULATED_FRAMES = 256

export interface SimulatedPeerNetworkProfile {
  readonly latencyMs?: number
  readonly dropEveryNthMessage?: number
  readonly maxQueuedFrames?: number
}

export interface SimulatedPeerTransportMetrics {
  readonly sentMessages: number
  readonly deliveredMessages: number
  readonly droppedMessages: number
  readonly sentBytes: number
  readonly deliveredBytes: number
  readonly lostBytes: number
  readonly averageLatencyMs: number
  readonly maxLatencyMs: number
  readonly queuedMessages: number
}

export interface SimulatedPeerTransportOptions<TInboundMessage> {
  readonly localPeerId: string
  readonly remotePeerId: string
  readonly inboundValidator: TransportMessageValidator<TInboundMessage>
  readonly now?: Clock
  readonly network?: SimulatedPeerNetworkProfile
}

export interface PendingFrame<TMessage> {
  readonly dueAtMs: number
  readonly sentAtMs: number
  readonly bytes: number
  readonly fromPeerId: string
  readonly envelope: PeerTransportEnvelope<TMessage>
}

export const byteLength = (value: unknown): number =>
  Buffer.byteLength(JSON.stringify(value), 'utf-8')

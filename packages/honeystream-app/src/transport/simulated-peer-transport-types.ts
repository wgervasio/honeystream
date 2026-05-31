import { PeerTransportEnvelope, TransportMessageValidator } from './contracts'
import { serializedByteLength } from './transport-byte-length'

export type Clock = () => number

export const MAX_SIMULATED_FRAMES = 256

export interface SimulatedPeerNetworkProfile {
  readonly latencyMs?: number
  readonly jitterMs?: number
  readonly dropRate?: number
  readonly dropEveryNthMessage?: number
  readonly maxQueuedFrames?: number
  readonly retransmitDroppedFrames?: boolean
  readonly retransmitDelayMs?: number
}

export type SimulatedPeerTransportFrameOutcome = 'delivered' | 'dropped' | 'retransmitted' | 'sent'
export type SimulatedPeerTransportDropReason =
  | 'network-drop'
  | 'peer-disconnected'
  | 'queue-overflow'

export interface SimulatedPeerTransportFrameSample {
  readonly bytes: number
  readonly direction: string
  readonly latencyMs?: number
  readonly outcome: SimulatedPeerTransportFrameOutcome
  readonly reason?: SimulatedPeerTransportDropReason
  readonly recordedByPeerId: string
  readonly recordedAtMs: number
  readonly sampleId: number
  readonly seq: number
}

export interface SimulatedPeerTransportMetrics {
  readonly sentMessages: number
  readonly deliveredMessages: number
  readonly droppedMessages: number
  readonly retransmittedMessages: number
  readonly outOfOrderMessages: number
  readonly sequenceGapMessages: number
  readonly sentBytes: number
  readonly deliveredBytes: number
  readonly lostBytes: number
  readonly retransmittedBytes: number
  readonly deliveryRate: number
  readonly byteLossRate: number
  readonly retransmissionRate: number
  readonly retransmissionByteRate: number
  readonly averageMessageBytes: number
  readonly maxMessageBytes: number
  readonly averageLatencyMs: number
  readonly averageLatencyJitterMs: number
  readonly p50LatencyMs: number
  readonly p95LatencyMs: number
  readonly maxLatencyMs: number
  readonly maxLatencyJitterMs: number
  readonly queuedMessages: number
  readonly peakQueuedMessages: number
  readonly recentFrames: readonly SimulatedPeerTransportFrameSample[]
}

export interface SimulatedPeerTransportOptions<TInboundMessage> {
  readonly localPeerId: string
  readonly remotePeerId: string
  readonly inboundValidator: TransportMessageValidator<TInboundMessage>
  readonly now?: Clock
  readonly random?: Clock
  readonly network?: SimulatedPeerNetworkProfile
}

export interface PendingFrame<TMessage> {
  readonly dueAtMs: number
  readonly sentAtMs: number
  readonly bytes: number
  readonly fromPeerId: string
  readonly envelope: PeerTransportEnvelope<TMessage>
}

export type SimulatedPeerTransportEnqueueResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: SimulatedPeerTransportDropReason }

export const byteLength = serializedByteLength

export interface SimulatedPeerTransportBudget {
  readonly minDeliveryRate: number
  readonly maxDroppedMessages: number
  readonly maxRetransmissionRate: number
  readonly maxRetransmissionByteRate: number
  readonly maxOutOfOrderMessages: number
  readonly maxSequenceGapMessages: number
  readonly maxByteLossRate: number
  readonly maxAverageMessageBytes: number
  readonly maxMessageBytes: number
  readonly maxAverageLatencyMs: number
  readonly maxAverageLatencyJitterMs: number
  readonly maxP95LatencyMs: number
  readonly maxMaxLatencyMs: number
  readonly maxMaxLatencyJitterMs: number
  readonly maxQueuedMessages: number
  readonly maxQueuedBytes: number
  readonly maxDirectionalAverageLatencyMs: number
  readonly maxDirectionalLatencySkewMs: number
  readonly maxDirectionalByteLossRate: number
  readonly maxDirectionalRetransmissionRate: number
  readonly maxDirectionalRetransmissionByteRate: number
  readonly maxDirectionalQueuedMessages: number
  readonly maxDirectionalQueuedBytes: number
  readonly maxCombinedPeakQueuedMessages: number
  readonly maxCombinedPeakQueuedBytes: number
  readonly maxDirectionalPeakQueuedMessages: number
  readonly maxDirectionalPeakQueuedBytes: number
  readonly maxEstimatedRoundTripP95LatencyMs: number
  readonly maxEstimatedRoundTripMaxLatencyMs: number
}

export type SimulatedPeerTransportBudgetMetric =
  | 'combinedDeliveryRate'
  | 'combinedDroppedMessages'
  | 'combinedRetransmissionRate'
  | 'combinedRetransmissionByteRate'
  | 'combinedOutOfOrderMessages'
  | 'combinedSequenceGapMessages'
  | 'combinedByteLossRate'
  | 'combinedAverageMessageBytes'
  | 'combinedMaxMessageBytes'
  | 'combinedAverageLatencyMs'
  | 'maxDirectionalAverageLatencyJitterMs'
  | 'combinedP95LatencyMs'
  | 'combinedMaxLatencyMs'
  | 'maxDirectionalLatencyJitterMs'
  | 'combinedQueuedMessages'
  | 'combinedQueuedBytes'
  | 'maxDirectionalAverageLatencyMs'
  | 'directionalAverageLatencySkewMs'
  | 'maxDirectionalByteLossRate'
  | 'maxDirectionalRetransmissionRate'
  | 'maxDirectionalRetransmissionByteRate'
  | 'maxDirectionalQueuedMessages'
  | 'maxDirectionalQueuedBytes'
  | 'combinedPeakQueuedMessages'
  | 'combinedPeakQueuedBytes'
  | 'maxDirectionalPeakQueuedMessages'
  | 'maxDirectionalPeakQueuedBytes'
  | 'estimatedRoundTripP95LatencyMs'
  | 'estimatedRoundTripMaxLatencyMs'

export interface SimulatedPeerTransportBudgetFailure {
  readonly metric: SimulatedPeerTransportBudgetMetric
  readonly expected: string
  readonly actual: number
}

export interface SimulatedPeerTransportBudgetResult {
  readonly ok: boolean
  readonly failures: readonly SimulatedPeerTransportBudgetFailure[]
}

const MAX_MESSAGE_BYTES = 2048
const MAX_COMBINED_PEAK_QUEUED_FRAMES = 64
const MAX_DIRECTIONAL_PEAK_QUEUED_FRAMES = 32
const MAX_PEAK_QUEUED_BYTES = 128 * MAX_MESSAGE_BYTES

/*
Context: Streaming-site sync tests need a stable host/guest mock-network merge gate.
Invariant: Website playback shares compact commands only; video bytes stay local to each browser.
Options considered: Per-test assertions, ad hoc logs, or one reusable budget evaluator.
Decision: Keep delivery, loss, retransmission, wire-size, latency, and peak queue caps typed.
Performance impact: Budget checks are O(1) over aggregate metrics already captured by simulations.
Memory/lifecycle ownership: Metrics are bounded by the simulated transport recorder.
Failure mode: Over-budget simulations return typed failures for the exact metric that regressed.
Validation: Covered by simulated-peer-transport-performance and streaming-site runtime tests.
*/
export const STREAMING_SITE_TRANSPORT_BUDGET: SimulatedPeerTransportBudget = Object.freeze({
  minDeliveryRate: 1,
  maxDroppedMessages: 0,
  maxRetransmissionRate: 0.5,
  maxRetransmissionByteRate: 0.5,
  maxOutOfOrderMessages: 0,
  maxSequenceGapMessages: 0,
  maxByteLossRate: 0,
  maxAverageMessageBytes: 1200,
  maxMessageBytes: MAX_MESSAGE_BYTES,
  maxAverageLatencyMs: 16,
  maxAverageLatencyJitterMs: 4,
  maxP95LatencyMs: 16,
  maxMaxLatencyMs: 20,
  maxMaxLatencyJitterMs: 8,
  maxQueuedMessages: 0,
  maxQueuedBytes: 0,
  maxDirectionalAverageLatencyMs: 16,
  maxDirectionalLatencySkewMs: 8,
  maxDirectionalByteLossRate: 0,
  maxDirectionalRetransmissionRate: 0.5,
  maxDirectionalRetransmissionByteRate: 0.5,
  maxDirectionalQueuedMessages: 0,
  maxDirectionalQueuedBytes: 0,
  maxCombinedPeakQueuedMessages: MAX_COMBINED_PEAK_QUEUED_FRAMES,
  maxCombinedPeakQueuedBytes: MAX_PEAK_QUEUED_BYTES,
  maxDirectionalPeakQueuedMessages: MAX_DIRECTIONAL_PEAK_QUEUED_FRAMES,
  maxDirectionalPeakQueuedBytes: MAX_PEAK_QUEUED_BYTES,
  maxEstimatedRoundTripP95LatencyMs: 32,
  maxEstimatedRoundTripMaxLatencyMs: 32
})

import { AggregateSimulatedPeerTransportMetrics } from './simulated-peer-transport-pair'

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
  readonly maxDirectionalAverageLatencyMs: number
  readonly maxDirectionalLatencySkewMs: number
  readonly maxDirectionalByteLossRate: number
  readonly maxDirectionalRetransmissionRate: number
  readonly maxDirectionalRetransmissionByteRate: number
  readonly maxDirectionalQueuedMessages: number
  readonly maxCombinedPeakQueuedMessages: number
  readonly maxDirectionalPeakQueuedMessages: number
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
  | 'maxDirectionalAverageLatencyMs'
  | 'directionalAverageLatencySkewMs'
  | 'maxDirectionalByteLossRate'
  | 'maxDirectionalRetransmissionRate'
  | 'maxDirectionalRetransmissionByteRate'
  | 'maxDirectionalQueuedMessages'
  | 'combinedPeakQueuedMessages'
  | 'maxDirectionalPeakQueuedMessages'
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

/*
Context: Streaming-site sync tests need a stable host/guest mock-network merge gate.
Invariant: Website playback shares compact commands only; video bytes stay local to each browser.
Options considered: Per-test assertions, ad hoc logs, or one reusable budget evaluator.
Decision: Keep delivery, drop, retransmission overhead, sequence-integrity, byte-loss,
wire-size, jitter, latency, round-trip tail, and peak-queue caps in this helper.
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
  maxMessageBytes: 2048,
  maxAverageLatencyMs: 16,
  maxAverageLatencyJitterMs: 4,
  maxP95LatencyMs: 16,
  maxMaxLatencyMs: 20,
  maxMaxLatencyJitterMs: 8,
  maxQueuedMessages: 0,
  maxDirectionalAverageLatencyMs: 16,
  maxDirectionalLatencySkewMs: 8,
  maxDirectionalByteLossRate: 0,
  maxDirectionalRetransmissionRate: 0.5,
  maxDirectionalRetransmissionByteRate: 0.5,
  maxDirectionalQueuedMessages: 0,
  maxCombinedPeakQueuedMessages: 64,
  maxDirectionalPeakQueuedMessages: 32,
  maxEstimatedRoundTripP95LatencyMs: 32,
  maxEstimatedRoundTripMaxLatencyMs: 32
})

interface BudgetCheck {
  readonly actual: number
  readonly expected: string
  readonly metric: SimulatedPeerTransportBudgetMetric
  readonly passes: boolean
}

const overBudgetFailure = (check: BudgetCheck): SimulatedPeerTransportBudgetFailure => ({
  metric: check.metric,
  expected: check.expected,
  actual: check.actual
})

const minCheck = (
  metric: SimulatedPeerTransportBudgetMetric,
  actual: number,
  minimum: number
): BudgetCheck => ({
  metric,
  expected: `>= ${minimum}`,
  actual,
  passes: actual >= minimum
})

const maxCheck = (
  metric: SimulatedPeerTransportBudgetMetric,
  actual: number,
  maximum: number
): BudgetCheck => ({
  metric,
  expected: `<= ${maximum}`,
  actual,
  passes: actual <= maximum
})

export const evaluateSimulatedPeerTransportBudget = (
  metrics: AggregateSimulatedPeerTransportMetrics,
  budget: SimulatedPeerTransportBudget = STREAMING_SITE_TRANSPORT_BUDGET
): SimulatedPeerTransportBudgetResult => {
  const checks: readonly BudgetCheck[] = [
    minCheck('combinedDeliveryRate', metrics.combinedDeliveryRate, budget.minDeliveryRate),
    maxCheck('combinedDroppedMessages', metrics.combinedDroppedMessages, budget.maxDroppedMessages),
    maxCheck(
      'combinedRetransmissionRate',
      metrics.combinedRetransmissionRate,
      budget.maxRetransmissionRate
    ),
    maxCheck(
      'combinedRetransmissionByteRate',
      metrics.combinedRetransmissionByteRate,
      budget.maxRetransmissionByteRate
    ),
    maxCheck(
      'combinedOutOfOrderMessages',
      metrics.combinedOutOfOrderMessages,
      budget.maxOutOfOrderMessages
    ),
    maxCheck(
      'combinedSequenceGapMessages',
      metrics.combinedSequenceGapMessages,
      budget.maxSequenceGapMessages
    ),
    maxCheck('combinedByteLossRate', metrics.combinedByteLossRate, budget.maxByteLossRate),
    maxCheck(
      'maxDirectionalByteLossRate',
      metrics.maxDirectionalByteLossRate,
      budget.maxDirectionalByteLossRate
    ),
    maxCheck(
      'maxDirectionalRetransmissionRate',
      metrics.maxDirectionalRetransmissionRate,
      budget.maxDirectionalRetransmissionRate
    ),
    maxCheck(
      'maxDirectionalRetransmissionByteRate',
      metrics.maxDirectionalRetransmissionByteRate,
      budget.maxDirectionalRetransmissionByteRate
    ),
    maxCheck(
      'combinedAverageMessageBytes',
      metrics.combinedAverageMessageBytes,
      budget.maxAverageMessageBytes
    ),
    maxCheck('combinedMaxMessageBytes', metrics.combinedMaxMessageBytes, budget.maxMessageBytes),
    maxCheck(
      'combinedAverageLatencyMs',
      metrics.combinedAverageLatencyMs,
      budget.maxAverageLatencyMs
    ),
    maxCheck(
      'maxDirectionalAverageLatencyJitterMs',
      metrics.maxDirectionalAverageLatencyJitterMs,
      budget.maxAverageLatencyJitterMs
    ),
    maxCheck(
      'maxDirectionalAverageLatencyMs',
      metrics.maxDirectionalAverageLatencyMs,
      budget.maxDirectionalAverageLatencyMs
    ),
    maxCheck(
      'directionalAverageLatencySkewMs',
      metrics.directionalAverageLatencySkewMs,
      budget.maxDirectionalLatencySkewMs
    ),
    maxCheck('combinedP95LatencyMs', metrics.combinedP95LatencyMs, budget.maxP95LatencyMs),
    maxCheck(
      'estimatedRoundTripP95LatencyMs',
      metrics.estimatedRoundTripP95LatencyMs,
      budget.maxEstimatedRoundTripP95LatencyMs
    ),
    maxCheck(
      'estimatedRoundTripMaxLatencyMs',
      metrics.estimatedRoundTripMaxLatencyMs,
      budget.maxEstimatedRoundTripMaxLatencyMs
    ),
    maxCheck('combinedMaxLatencyMs', metrics.combinedMaxLatencyMs, budget.maxMaxLatencyMs),
    maxCheck(
      'maxDirectionalLatencyJitterMs',
      metrics.maxDirectionalLatencyJitterMs,
      budget.maxMaxLatencyJitterMs
    ),
    maxCheck(
      'maxDirectionalQueuedMessages',
      metrics.maxDirectionalQueuedMessages,
      budget.maxDirectionalQueuedMessages
    ),
    maxCheck(
      'combinedPeakQueuedMessages',
      metrics.combinedPeakQueuedMessages,
      budget.maxCombinedPeakQueuedMessages
    ),
    maxCheck(
      'maxDirectionalPeakQueuedMessages',
      metrics.maxDirectionalPeakQueuedMessages,
      budget.maxDirectionalPeakQueuedMessages
    ),
    maxCheck('combinedQueuedMessages', metrics.combinedQueuedMessages, budget.maxQueuedMessages)
  ]
  const failures = checks.filter(check => !check.passes).map(overBudgetFailure)

  return {
    ok: failures.length === 0,
    failures
  }
}

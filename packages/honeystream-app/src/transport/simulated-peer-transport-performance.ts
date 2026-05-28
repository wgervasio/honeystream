import { AggregateSimulatedPeerTransportMetrics } from './simulated-peer-transport-pair'

export interface SimulatedPeerTransportBudget {
  readonly minDeliveryRate: number
  readonly maxDroppedMessages: number
  readonly maxByteLossRate: number
  readonly maxAverageMessageBytes: number
  readonly maxAverageLatencyMs: number
  readonly maxP95LatencyMs: number
  readonly maxMaxLatencyMs: number
  readonly maxQueuedMessages: number
  readonly maxDirectionalAverageLatencyMs: number
  readonly maxDirectionalLatencySkewMs: number
  readonly maxDirectionalByteLossRate: number
  readonly maxDirectionalQueuedMessages: number
  readonly maxEstimatedRoundTripP95LatencyMs: number
}

export type SimulatedPeerTransportBudgetMetric =
  | 'combinedDeliveryRate'
  | 'combinedDroppedMessages'
  | 'combinedByteLossRate'
  | 'combinedAverageMessageBytes'
  | 'combinedAverageLatencyMs'
  | 'combinedP95LatencyMs'
  | 'combinedMaxLatencyMs'
  | 'combinedQueuedMessages'
  | 'maxDirectionalAverageLatencyMs'
  | 'directionalAverageLatencySkewMs'
  | 'maxDirectionalByteLossRate'
  | 'maxDirectionalQueuedMessages'
  | 'estimatedRoundTripP95LatencyMs'

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
Decision: Keep delivery, drop, byte-loss, wire-size, directional latency, round-trip, and queue caps in this helper.
Performance impact: Budget checks are O(1) over aggregate metrics already captured by simulations.
Memory/lifecycle ownership: Metrics are bounded by the simulated transport recorder.
Failure mode: Over-budget simulations return typed failures for the exact metric that regressed.
Validation: Covered by simulated-peer-transport-performance and streaming-site runtime tests.
*/
export const STREAMING_SITE_TRANSPORT_BUDGET: SimulatedPeerTransportBudget = Object.freeze({
  minDeliveryRate: 1,
  maxDroppedMessages: 0,
  maxByteLossRate: 0,
  maxAverageMessageBytes: 1200,
  maxAverageLatencyMs: 16,
  maxP95LatencyMs: 16,
  maxMaxLatencyMs: 20,
  maxQueuedMessages: 0,
  maxDirectionalAverageLatencyMs: 16,
  maxDirectionalLatencySkewMs: 8,
  maxDirectionalByteLossRate: 0,
  maxDirectionalQueuedMessages: 0,
  maxEstimatedRoundTripP95LatencyMs: 32
})

const overBudgetFailure = (
  metric: SimulatedPeerTransportBudgetMetric,
  expected: string,
  actual: number
): SimulatedPeerTransportBudgetFailure => ({
  metric,
  expected,
  actual
})

export const evaluateSimulatedPeerTransportBudget = (
  metrics: AggregateSimulatedPeerTransportMetrics,
  budget: SimulatedPeerTransportBudget = STREAMING_SITE_TRANSPORT_BUDGET
): SimulatedPeerTransportBudgetResult => {
  const failures: SimulatedPeerTransportBudgetFailure[] = []

  if (metrics.combinedDeliveryRate < budget.minDeliveryRate) {
    failures.push(
      overBudgetFailure(
        'combinedDeliveryRate',
        `>= ${budget.minDeliveryRate}`,
        metrics.combinedDeliveryRate
      )
    )
  }

  if (metrics.combinedDroppedMessages > budget.maxDroppedMessages) {
    failures.push(
      overBudgetFailure(
        'combinedDroppedMessages',
        `<= ${budget.maxDroppedMessages}`,
        metrics.combinedDroppedMessages
      )
    )
  }

  if (metrics.combinedByteLossRate > budget.maxByteLossRate) {
    failures.push(
      overBudgetFailure(
        'combinedByteLossRate',
        `<= ${budget.maxByteLossRate}`,
        metrics.combinedByteLossRate
      )
    )
  }

  if (metrics.maxDirectionalByteLossRate > budget.maxDirectionalByteLossRate) {
    failures.push(
      overBudgetFailure(
        'maxDirectionalByteLossRate',
        `<= ${budget.maxDirectionalByteLossRate}`,
        metrics.maxDirectionalByteLossRate
      )
    )
  }

  if (metrics.combinedAverageMessageBytes > budget.maxAverageMessageBytes) {
    failures.push(
      overBudgetFailure(
        'combinedAverageMessageBytes',
        `<= ${budget.maxAverageMessageBytes}`,
        metrics.combinedAverageMessageBytes
      )
    )
  }

  if (metrics.combinedAverageLatencyMs > budget.maxAverageLatencyMs) {
    failures.push(
      overBudgetFailure(
        'combinedAverageLatencyMs',
        `<= ${budget.maxAverageLatencyMs}`,
        metrics.combinedAverageLatencyMs
      )
    )
  }

  if (metrics.maxDirectionalAverageLatencyMs > budget.maxDirectionalAverageLatencyMs) {
    failures.push(
      overBudgetFailure(
        'maxDirectionalAverageLatencyMs',
        `<= ${budget.maxDirectionalAverageLatencyMs}`,
        metrics.maxDirectionalAverageLatencyMs
      )
    )
  }

  if (metrics.directionalAverageLatencySkewMs > budget.maxDirectionalLatencySkewMs) {
    failures.push(
      overBudgetFailure(
        'directionalAverageLatencySkewMs',
        `<= ${budget.maxDirectionalLatencySkewMs}`,
        metrics.directionalAverageLatencySkewMs
      )
    )
  }

  if (metrics.combinedP95LatencyMs > budget.maxP95LatencyMs) {
    failures.push(
      overBudgetFailure(
        'combinedP95LatencyMs',
        `<= ${budget.maxP95LatencyMs}`,
        metrics.combinedP95LatencyMs
      )
    )
  }

  if (metrics.estimatedRoundTripP95LatencyMs > budget.maxEstimatedRoundTripP95LatencyMs) {
    failures.push(
      overBudgetFailure(
        'estimatedRoundTripP95LatencyMs',
        `<= ${budget.maxEstimatedRoundTripP95LatencyMs}`,
        metrics.estimatedRoundTripP95LatencyMs
      )
    )
  }

  if (metrics.combinedMaxLatencyMs > budget.maxMaxLatencyMs) {
    failures.push(
      overBudgetFailure(
        'combinedMaxLatencyMs',
        `<= ${budget.maxMaxLatencyMs}`,
        metrics.combinedMaxLatencyMs
      )
    )
  }

  if (metrics.maxDirectionalQueuedMessages > budget.maxDirectionalQueuedMessages) {
    failures.push(
      overBudgetFailure(
        'maxDirectionalQueuedMessages',
        `<= ${budget.maxDirectionalQueuedMessages}`,
        metrics.maxDirectionalQueuedMessages
      )
    )
  }

  if (metrics.combinedQueuedMessages > budget.maxQueuedMessages) {
    failures.push(
      overBudgetFailure(
        'combinedQueuedMessages',
        `<= ${budget.maxQueuedMessages}`,
        metrics.combinedQueuedMessages
      )
    )
  }

  return {
    ok: failures.length === 0,
    failures
  }
}

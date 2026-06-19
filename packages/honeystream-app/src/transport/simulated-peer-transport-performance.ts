import { AggregateSimulatedPeerTransportMetrics } from './simulated-peer-transport-pair'
import {
  STREAMING_SITE_TRANSPORT_BUDGET,
  SimulatedPeerTransportBudget,
  SimulatedPeerTransportBudgetFailure,
  SimulatedPeerTransportBudgetMetric,
  SimulatedPeerTransportBudgetResult
} from './simulated-peer-transport-budget'

export {
  STREAMING_SITE_TRANSPORT_BUDGET,
  SimulatedPeerTransportBudget,
  SimulatedPeerTransportBudgetFailure,
  SimulatedPeerTransportBudgetMetric,
  SimulatedPeerTransportBudgetResult
} from './simulated-peer-transport-budget'

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
      'maxDirectionalQueuedBytes',
      metrics.maxDirectionalQueuedBytes,
      budget.maxDirectionalQueuedBytes
    ),
    maxCheck(
      'combinedPeakQueuedMessages',
      metrics.combinedPeakQueuedMessages,
      budget.maxCombinedPeakQueuedMessages
    ),
    maxCheck(
      'combinedPeakQueuedBytes',
      metrics.combinedPeakQueuedBytes,
      budget.maxCombinedPeakQueuedBytes
    ),
    maxCheck(
      'maxDirectionalPeakQueuedMessages',
      metrics.maxDirectionalPeakQueuedMessages,
      budget.maxDirectionalPeakQueuedMessages
    ),
    maxCheck(
      'maxDirectionalPeakQueuedBytes',
      metrics.maxDirectionalPeakQueuedBytes,
      budget.maxDirectionalPeakQueuedBytes
    ),
    maxCheck('combinedQueuedMessages', metrics.combinedQueuedMessages, budget.maxQueuedMessages),
    maxCheck('combinedQueuedBytes', metrics.combinedQueuedBytes, budget.maxQueuedBytes)
  ]
  const failures = checks.filter(check => !check.passes).map(overBudgetFailure)

  return {
    ok: failures.length === 0,
    failures
  }
}

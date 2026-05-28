import { AggregateSimulatedPeerTransportMetrics } from './simulated-peer-transport-pair'

export interface SimulatedPeerTransportBudget {
  readonly minDeliveryRate: number
  readonly maxByteLossRate: number
  readonly maxAverageLatencyMs: number
  readonly maxP95LatencyMs: number
  readonly maxMaxLatencyMs: number
  readonly maxQueuedMessages: number
}

export type SimulatedPeerTransportBudgetMetric =
  | 'combinedDeliveryRate'
  | 'combinedByteLossRate'
  | 'combinedAverageLatencyMs'
  | 'combinedP95LatencyMs'
  | 'combinedMaxLatencyMs'
  | 'combinedQueuedMessages'

export interface SimulatedPeerTransportBudgetFailure {
  readonly metric: SimulatedPeerTransportBudgetMetric
  readonly expected: string
  readonly actual: number
}

export interface SimulatedPeerTransportBudgetResult {
  readonly ok: boolean
  readonly failures: readonly SimulatedPeerTransportBudgetFailure[]
}

export const STREAMING_SITE_TRANSPORT_BUDGET: SimulatedPeerTransportBudget = Object.freeze({
  minDeliveryRate: 1,
  maxByteLossRate: 0,
  maxAverageLatencyMs: 24,
  maxP95LatencyMs: 24,
  maxMaxLatencyMs: 32,
  maxQueuedMessages: 0
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

  if (metrics.combinedByteLossRate > budget.maxByteLossRate) {
    failures.push(
      overBudgetFailure(
        'combinedByteLossRate',
        `<= ${budget.maxByteLossRate}`,
        metrics.combinedByteLossRate
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

  if (metrics.combinedP95LatencyMs > budget.maxP95LatencyMs) {
    failures.push(
      overBudgetFailure(
        'combinedP95LatencyMs',
        `<= ${budget.maxP95LatencyMs}`,
        metrics.combinedP95LatencyMs
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

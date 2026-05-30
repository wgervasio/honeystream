import { StreamingSiteConnectionProfileOptimization } from './streaming-site-connection-profile-optimization'

type RankMetric = (profile: StreamingSiteConnectionProfileOptimization) => number

const compareMetric = (
  left: StreamingSiteConnectionProfileOptimization,
  right: StreamingSiteConnectionProfileOptimization,
  metric: RankMetric
): number => metric(left) - metric(right)

const compareOrderedMetrics = (
  left: StreamingSiteConnectionProfileOptimization,
  right: StreamingSiteConnectionProfileOptimization,
  metrics: readonly RankMetric[]
): number => {
  for (const metric of metrics) {
    const result = compareMetric(left, right, metric)
    if (result !== 0) return result
  }
  return 0
}

const RANKING_METRICS: readonly RankMetric[] = Object.freeze([
  profile => profile.maxFixtureByteLossRate,
  profile => profile.maxCombinedByteLossRate,
  profile => profile.maxFixtureMissingDirectionalDeliveryCount,
  profile => profile.maxFixtureDroppedMessages,
  profile => profile.maxCombinedDroppedMessages,
  profile => profile.maxCombinedRetransmissionRate,
  profile => profile.maxCombinedRetransmissionByteRate,
  profile => profile.maxFixtureRetransmissionByteRate,
  profile => profile.maxDirectionalRetransmissionRate,
  profile => profile.maxDirectionalRetransmissionByteRate,
  profile => profile.maxFixtureEstimatedRoundTripP95LatencyMs,
  profile => profile.maxFixtureDirectionalLatencySkewMs,
  profile => profile.maxEstimatedRoundTripP95LatencyMs,
  profile => profile.maxDirectionalAverageLatencyMs,
  profile => profile.maxDirectionalLatencySkewMs,
  profile => profile.maxCombinedAverageMessageBytes
])

/*
Context: Profile ranking should prefer zero loss, minimal repair overhead, then low latency.
Invariant: A passing profile with lower fixture loss, drops, retransmission cost, tail latency, or skew wins.
Options considered: Keep ranking inline with optimization, use opaque scores, or ordered pure metrics.
Decision: Use ordered scalar comparisons so the merge gate can diagnose the exact regressed dimension.
Performance impact: O(metric count) for a fixed, tiny profile list.
Memory/lifecycle ownership: No allocations outlive the sort call except this static metric list.
Failure mode: Exact ties fall back to stable profile id ordering.
Validation: Covered by streaming-site connection optimizer and merge gate tests.
*/
export const compareStreamingSiteConnectionProfileOptimizations = (
  left: StreamingSiteConnectionProfileOptimization,
  right: StreamingSiteConnectionProfileOptimization
): number => {
  if (left.allTrialsPassed !== right.allTrialsPassed) return left.allTrialsPassed ? -1 : 1
  if (left.passedTrials !== right.passedTrials) return right.passedTrials - left.passedTrials

  const metricResult = compareOrderedMetrics(left, right, RANKING_METRICS)
  return metricResult === 0 ? left.profile.id.localeCompare(right.profile.id) : metricResult
}

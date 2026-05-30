import { StreamingSiteConnectionOptimizationResult } from './streaming-site-connection-optimizer'
import {
  createStreamingSiteConnectionMergeGateFailures,
  getCoveredProviders,
  getProviderFixtureCount,
  getProviderFixtureCounts,
  hasCoveredProvider,
  maxProviderQualityValue,
  selectedMetric
} from './streaming-site-connection-merge-gate-helpers'
import {
  resolveStreamingSiteConnectionMergeGateOptions,
  StreamingSiteConnectionMergeGateOptions,
  StreamingSiteConnectionMergeGateSummary
} from './streaming-site-connection-merge-gate-types'

export type {
  StreamingSiteConnectionMergeGateOptions,
  StreamingSiteConnectionMergeGateSummary
} from './streaming-site-connection-merge-gate-types'

/*
Context: The streaming-site mock lab should produce a compact merge gate, not just raw ranks.
Invariant: A merge-ready lane covers the requested providers, loses zero control bytes, stays
within the deterministic P95 round-trip budget, and keeps both directions ordered and balanced.
Options considered: UI-only copy, live third-party checks, or a typed summary over lab observations.
Decision: Summarize optimizer output into a small pure value that tests and UI copy can assert.
Performance impact: O(provider count) over capped provider coverage and one selected profile.
Memory/lifecycle ownership: No resources are allocated; simulated transports are owned by the lab.
Failure mode: Missing coverage or over-budget metrics become explicit failure strings.
Validation: Covered by streaming-site connection optimizer tests.
*/
export const summarizeStreamingSiteConnectionMergeGate = (
  result: StreamingSiteConnectionOptimizationResult,
  options: StreamingSiteConnectionMergeGateOptions = {}
): StreamingSiteConnectionMergeGateSummary => {
  const requiredOptions = resolveStreamingSiteConnectionMergeGateOptions(options)
  const selectedProfile = result.bestProfile
  const observedProfile = selectedProfile || result.rankedProfiles[0]
  const missingProviders = requiredOptions.requiredProviders.filter(
    provider => !hasCoveredProvider(observedProfile, provider)
  )
  const undercoveredProviders = requiredOptions.requiredProviders.filter(provider => {
    const siteCount = getProviderFixtureCount(observedProfile, provider)
    return siteCount > 0 && siteCount < requiredOptions.minFixturesPerRequiredProvider
  })
  const providerFixtureCounts = getProviderFixtureCounts(observedProfile)
  const failures = createStreamingSiteConnectionMergeGateFailures(
    selectedProfile,
    missingProviders,
    undercoveredProviders,
    requiredOptions
  )

  return {
    coveredProviders: getCoveredProviders(observedProfile),
    failures,
    maxCombinedAverageMessageBytes: selectedMetric(
      selectedProfile,
      profile => profile.maxCombinedAverageMessageBytes
    ),
    maxCombinedByteLossRate: selectedMetric(
      selectedProfile,
      profile => profile.maxCombinedByteLossRate
    ),
    maxCombinedDroppedMessages: selectedMetric(
      selectedProfile,
      profile => profile.maxCombinedDroppedMessages
    ),
    maxCombinedRetransmissionByteRate: selectedMetric(
      selectedProfile,
      profile => profile.maxCombinedRetransmissionByteRate
    ),
    maxCombinedRetransmissionRate: selectedMetric(
      selectedProfile,
      profile => profile.maxCombinedRetransmissionRate
    ),
    maxDirectionalLatencySkewMs: selectedMetric(
      selectedProfile,
      profile => profile.maxDirectionalLatencySkewMs
    ),
    maxDirectionalRetransmissionByteRate: selectedMetric(
      selectedProfile,
      profile => profile.maxDirectionalRetransmissionByteRate
    ),
    maxEstimatedRoundTripP95LatencyMs: selectedMetric(
      selectedProfile,
      profile => profile.maxEstimatedRoundTripP95LatencyMs
    ),
    maxFixtureByteLossRate: selectedMetric(
      selectedProfile,
      profile => profile.maxFixtureByteLossRate
    ),
    maxFixtureDroppedMessages: selectedMetric(
      selectedProfile,
      profile => profile.maxFixtureDroppedMessages
    ),
    maxFixtureEstimatedRoundTripP95LatencyMs: selectedMetric(
      selectedProfile,
      profile => profile.maxFixtureEstimatedRoundTripP95LatencyMs
    ),
    maxFixtureRetransmissionByteRate: selectedMetric(
      selectedProfile,
      profile => profile.maxFixtureRetransmissionByteRate
    ),
    maxProviderOutOfOrderMessages: maxProviderQualityValue(
      selectedProfile,
      quality => quality.maxOutOfOrderMessages
    ),
    maxProviderSequenceGapMessages: maxProviderQualityValue(
      selectedProfile,
      quality => quality.maxSequenceGapMessages
    ),
    missingProviders,
    minFixturesPerRequiredProvider: requiredOptions.minFixturesPerRequiredProvider,
    ok: failures.length === 0,
    providerFixtureCounts,
    requiredProviders: requiredOptions.requiredProviders,
    selectedProfileId: selectedProfile ? selectedProfile.profile.id : undefined,
    selectedProfileLabel: selectedProfile ? selectedProfile.profile.label : undefined,
    siteCount: observedProfile ? observedProfile.siteCount : 0,
    trialCount: result.trialCount,
    undercoveredProviders
  }
}

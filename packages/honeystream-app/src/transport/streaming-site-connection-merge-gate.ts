import { MediaProvider } from 'protocol'
import {
  STREAMING_SITE_CONNECTION_BUDGET,
  STREAMING_SITE_CONNECTION_P95_ROUND_TRIP_BUDGET_MS
} from './streaming-site-connection-defaults'
import {
  StreamingSiteConnectionOptimizationResult,
  StreamingSiteConnectionProfileOptimization
} from './streaming-site-connection-optimizer'

export interface StreamingSiteConnectionMergeGateOptions {
  readonly maxByteLossRate?: number
  readonly maxDroppedMessages?: number
  readonly maxFixtureByteLossRate?: number
  readonly maxFixtureDroppedMessages?: number
  readonly maxFixtureRoundTripP95LatencyMs?: number
  readonly maxRetransmissionByteRate?: number
  readonly maxRoundTripP95LatencyMs?: number
  readonly maxDirectionalRetransmissionByteRate?: number
  readonly requiredProviders?: readonly MediaProvider[]
}

export interface StreamingSiteConnectionMergeGateSummary {
  readonly coveredProviders: readonly MediaProvider[]
  readonly failures: readonly string[]
  readonly maxCombinedAverageMessageBytes: number
  readonly maxCombinedByteLossRate: number
  readonly maxCombinedDroppedMessages: number
  readonly maxCombinedRetransmissionByteRate: number
  readonly maxCombinedRetransmissionRate: number
  readonly maxDirectionalRetransmissionByteRate: number
  readonly maxEstimatedRoundTripP95LatencyMs: number
  readonly maxFixtureByteLossRate: number
  readonly maxFixtureDroppedMessages: number
  readonly maxFixtureEstimatedRoundTripP95LatencyMs: number
  readonly maxFixtureRetransmissionByteRate: number
  readonly missingProviders: readonly MediaProvider[]
  readonly ok: boolean
  readonly requiredProviders: readonly MediaProvider[]
  readonly selectedProfileId?: string
  readonly selectedProfileLabel?: string
  readonly siteCount: number
  readonly trialCount: number
}

const DEFAULT_REQUIRED_PROVIDERS: readonly MediaProvider[] = Object.freeze([
  'youtube',
  'animepahe',
  'cineby',
  'miruro'
])

const resolveNumberOption = (
  value: number | undefined,
  inheritedValue: number | undefined,
  fallback: number
): number => {
  if (typeof value === 'number') return value
  if (typeof inheritedValue === 'number') return inheritedValue
  return fallback
}

const providerLabel = (provider: MediaProvider): string => {
  switch (provider) {
    case 'youtube':
      return 'YouTube'
    case 'animepahe':
      return 'AnimePahe'
    case 'cineby':
      return 'Cineby'
    case 'miruro':
      return 'Miruro'
    case 'unknown':
    default:
      return 'generic'
  }
}

const hasCoveredProvider = (
  profile: StreamingSiteConnectionProfileOptimization | undefined,
  provider: MediaProvider
): boolean =>
  Boolean(
    profile &&
      profile.providerCoverage.some(
        coverage => coverage.provider === provider && coverage.siteCount > 0
      )
  )

const getCoveredProviders = (
  profile: StreamingSiteConnectionProfileOptimization | undefined
): readonly MediaProvider[] =>
  profile
    ? profile.providerCoverage
        .filter(coverage => coverage.siteCount > 0)
        .map(coverage => coverage.provider)
    : []

const createFailureList = (
  profile: StreamingSiteConnectionProfileOptimization | undefined,
  missingProviders: readonly MediaProvider[],
  options: Required<StreamingSiteConnectionMergeGateOptions>
): readonly string[] => {
  const failures: string[] = []
  if (!profile) {
    failures.push('No streaming-site transport lane passed every deterministic trial.')
  }
  for (const provider of missingProviders) {
    failures.push(`${providerLabel(provider)} coverage is missing from the streaming-site matrix.`)
  }
  if (profile && profile.maxCombinedByteLossRate > options.maxByteLossRate) {
    failures.push(`Byte loss exceeded ${options.maxByteLossRate}.`)
  }
  if (profile && profile.maxCombinedDroppedMessages > options.maxDroppedMessages) {
    failures.push(`Dropped controls exceeded ${options.maxDroppedMessages}.`)
  }
  if (profile && profile.maxFixtureByteLossRate > options.maxFixtureByteLossRate) {
    failures.push(`A site fixture byte-loss rate exceeded ${options.maxFixtureByteLossRate}.`)
  }
  if (profile && profile.maxFixtureDroppedMessages > options.maxFixtureDroppedMessages) {
    failures.push(`A site fixture dropped more than ${options.maxFixtureDroppedMessages} controls.`)
  }
  if (profile && profile.maxCombinedRetransmissionByteRate > options.maxRetransmissionByteRate) {
    failures.push(`Recovered retry bytes exceeded ${options.maxRetransmissionByteRate}.`)
  }
  if (
    profile &&
    profile.maxDirectionalRetransmissionByteRate >
      options.maxDirectionalRetransmissionByteRate
  ) {
    failures.push(
      `Directional recovered retry bytes exceeded ${options.maxDirectionalRetransmissionByteRate}.`
    )
  }
  if (
    profile &&
    profile.maxFixtureEstimatedRoundTripP95LatencyMs >
      options.maxFixtureRoundTripP95LatencyMs
  ) {
    failures.push(
      `A site fixture P95 mock round trip exceeded ${options.maxFixtureRoundTripP95LatencyMs}ms.`
    )
  }
  if (profile && profile.maxEstimatedRoundTripP95LatencyMs > options.maxRoundTripP95LatencyMs) {
    failures.push(`P95 mock round trip exceeded ${options.maxRoundTripP95LatencyMs}ms.`)
  }
  return failures
}

/*
Context: The streaming-site mock lab should produce a compact merge gate, not just raw ranks.
Invariant: A merge-ready lane covers the requested providers, loses zero control bytes, and stays
within the deterministic P95 round-trip budget.
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
  const requiredOptions: Required<StreamingSiteConnectionMergeGateOptions> = {
    maxByteLossRate:
      typeof options.maxByteLossRate === 'number'
        ? options.maxByteLossRate
        : STREAMING_SITE_CONNECTION_BUDGET.maxByteLossRate,
    maxDroppedMessages:
      typeof options.maxDroppedMessages === 'number'
        ? options.maxDroppedMessages
        : STREAMING_SITE_CONNECTION_BUDGET.maxDroppedMessages,
    maxFixtureByteLossRate:
      resolveNumberOption(
        options.maxFixtureByteLossRate,
        options.maxByteLossRate,
        STREAMING_SITE_CONNECTION_BUDGET.maxByteLossRate
      ),
    maxFixtureDroppedMessages:
      resolveNumberOption(
        options.maxFixtureDroppedMessages,
        options.maxDroppedMessages,
        STREAMING_SITE_CONNECTION_BUDGET.maxDroppedMessages
      ),
    maxFixtureRoundTripP95LatencyMs:
      resolveNumberOption(
        options.maxFixtureRoundTripP95LatencyMs,
        options.maxRoundTripP95LatencyMs,
        STREAMING_SITE_CONNECTION_P95_ROUND_TRIP_BUDGET_MS
      ),
    maxRetransmissionByteRate:
      typeof options.maxRetransmissionByteRate === 'number'
        ? options.maxRetransmissionByteRate
        : STREAMING_SITE_CONNECTION_BUDGET.maxRetransmissionByteRate,
    maxRoundTripP95LatencyMs:
      typeof options.maxRoundTripP95LatencyMs === 'number'
        ? options.maxRoundTripP95LatencyMs
        : STREAMING_SITE_CONNECTION_P95_ROUND_TRIP_BUDGET_MS,
    maxDirectionalRetransmissionByteRate:
      typeof options.maxDirectionalRetransmissionByteRate === 'number'
        ? options.maxDirectionalRetransmissionByteRate
        : STREAMING_SITE_CONNECTION_BUDGET.maxDirectionalRetransmissionByteRate,
    requiredProviders: options.requiredProviders || DEFAULT_REQUIRED_PROVIDERS
  }
  const selectedProfile = result.bestProfile
  const observedProfile = selectedProfile || result.rankedProfiles[0]
  const missingProviders = requiredOptions.requiredProviders.filter(
    provider => !hasCoveredProvider(observedProfile, provider)
  )
  const failures = createFailureList(selectedProfile, missingProviders, requiredOptions)

  return {
    coveredProviders: getCoveredProviders(observedProfile),
    failures,
    maxCombinedAverageMessageBytes: selectedProfile
      ? selectedProfile.maxCombinedAverageMessageBytes
      : 0,
    maxCombinedByteLossRate: selectedProfile ? selectedProfile.maxCombinedByteLossRate : 0,
    maxCombinedDroppedMessages: selectedProfile ? selectedProfile.maxCombinedDroppedMessages : 0,
    maxCombinedRetransmissionByteRate: selectedProfile
      ? selectedProfile.maxCombinedRetransmissionByteRate
      : 0,
    maxCombinedRetransmissionRate: selectedProfile
      ? selectedProfile.maxCombinedRetransmissionRate
      : 0,
    maxDirectionalRetransmissionByteRate: selectedProfile
      ? selectedProfile.maxDirectionalRetransmissionByteRate
      : 0,
    maxEstimatedRoundTripP95LatencyMs: selectedProfile
      ? selectedProfile.maxEstimatedRoundTripP95LatencyMs
      : 0,
    maxFixtureByteLossRate: selectedProfile ? selectedProfile.maxFixtureByteLossRate : 0,
    maxFixtureDroppedMessages: selectedProfile ? selectedProfile.maxFixtureDroppedMessages : 0,
    maxFixtureEstimatedRoundTripP95LatencyMs: selectedProfile
      ? selectedProfile.maxFixtureEstimatedRoundTripP95LatencyMs
      : 0,
    maxFixtureRetransmissionByteRate: selectedProfile
      ? selectedProfile.maxFixtureRetransmissionByteRate
      : 0,
    missingProviders,
    ok: failures.length === 0,
    requiredProviders: requiredOptions.requiredProviders,
    selectedProfileId: selectedProfile ? selectedProfile.profile.id : undefined,
    selectedProfileLabel: selectedProfile ? selectedProfile.profile.label : undefined,
    siteCount: observedProfile ? observedProfile.siteCount : 0,
    trialCount: result.trialCount
  }
}

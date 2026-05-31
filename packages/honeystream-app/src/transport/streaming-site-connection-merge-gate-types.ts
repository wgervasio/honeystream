import { MediaProvider } from 'protocol'
import {
  STREAMING_SITE_CONNECTION_BUDGET,
  STREAMING_SITE_CONNECTION_P95_ROUND_TRIP_BUDGET_MS
} from './streaming-site-connection-defaults'

export interface StreamingSiteConnectionMergeGateOptions {
  readonly maxByteLossRate?: number
  readonly maxCombinedAverageMessageBytes?: number
  readonly maxCombinedMaxMessageBytes?: number
  readonly maxDroppedMessages?: number
  readonly maxFixtureAverageMessageBytes?: number
  readonly maxDirectionalLatencySkewMs?: number
  readonly maxFixtureDirectionalLatencySkewMs?: number
  readonly maxFixtureByteLossRate?: number
  readonly maxFixtureDroppedMessages?: number
  readonly maxFixtureLostBytes?: number
  readonly maxFixtureMaxMessageBytes?: number
  readonly maxFixtureMissingDirectionalDeliveryCount?: number
  readonly maxFixtureRoundTripP95LatencyMs?: number
  readonly minFixturesPerRequiredProvider?: number
  readonly maxProviderDirectionalLatencySkewMs?: number
  readonly maxProviderLostBytes?: number
  readonly maxProviderAverageMessageBytes?: number
  readonly maxProviderMaxMessageBytes?: number
  readonly maxProviderMissingDirectionalDeliveryCount?: number
  readonly maxProviderOutOfOrderMessages?: number
  readonly maxProviderRoundTripP95LatencyMs?: number
  readonly maxProviderSequenceGapMessages?: number
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
  readonly maxCombinedMaxMessageBytes: number
  readonly maxCombinedRetransmissionByteRate: number
  readonly maxCombinedRetransmissionRate: number
  readonly maxDirectionalLatencySkewMs: number
  readonly maxDirectionalRetransmissionByteRate: number
  readonly maxEstimatedRoundTripP95LatencyMs: number
  readonly maxFixtureByteLossRate: number
  readonly maxFixtureAverageMessageBytes: number
  readonly maxFixtureDirectionalLatencySkewMs: number
  readonly maxFixtureDroppedMessages: number
  readonly maxFixtureEstimatedRoundTripP95LatencyMs: number
  readonly maxFixtureLostBytes: number
  readonly maxFixtureMaxMessageBytes: number
  readonly maxFixtureMissingDirectionalDeliveryCount: number
  readonly maxFixtureRetransmissionByteRate: number
  readonly maxProviderAverageMessageBytes: number
  readonly maxProviderDirectionalLatencySkewMs: number
  readonly maxProviderLostBytes: number
  readonly maxProviderMaxMessageBytes: number
  readonly maxProviderMissingDirectionalDeliveryCount: number
  readonly maxProviderOutOfOrderMessages: number
  readonly maxProviderRoundTripP95LatencyMs: number
  readonly maxProviderSequenceGapMessages: number
  readonly missingProviders: readonly MediaProvider[]
  readonly minFixturesPerRequiredProvider: number
  readonly ok: boolean
  readonly providerFixtureCounts: readonly StreamingSiteProviderFixtureCount[]
  readonly requiredProviders: readonly MediaProvider[]
  readonly selectedProfileId?: string
  readonly selectedProfileLabel?: string
  readonly siteCount: number
  readonly trialCount: number
  readonly undercoveredProviders: readonly MediaProvider[]
}

export interface StreamingSiteProviderFixtureCount {
  readonly provider: MediaProvider
  readonly siteCount: number
}

export type ResolvedMergeGateOptions = Required<StreamingSiteConnectionMergeGateOptions>

export const PROVIDER_LABELS: Record<MediaProvider, string> = {
  youtube: 'YouTube',
  animepahe: 'AnimePahe',
  cineby: 'Cineby',
  miruro: 'Miruro',
  unknown: 'generic'
}

const DEFAULT_REQUIRED_PROVIDERS: readonly MediaProvider[] = Object.freeze([
  'youtube',
  'animepahe',
  'cineby',
  'miruro'
])
const DEFAULT_MIN_REQUIRED_PROVIDER_FIXTURES = 2

const resolveNumberOption = (
  value: number | undefined,
  inheritedValue: number | undefined,
  fallback: number
): number => {
  if (typeof value === 'number') return value
  if (typeof inheritedValue === 'number') return inheritedValue
  return fallback
}

const resolveMinimumFixtureCount = (value: number | undefined): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) {
    return DEFAULT_MIN_REQUIRED_PROVIDER_FIXTURES
  }
  return Math.floor(value)
}

export const resolveStreamingSiteConnectionMergeGateOptions = (
  options: StreamingSiteConnectionMergeGateOptions
): ResolvedMergeGateOptions => ({
  maxByteLossRate:
    typeof options.maxByteLossRate === 'number'
      ? options.maxByteLossRate
      : STREAMING_SITE_CONNECTION_BUDGET.maxByteLossRate,
  maxCombinedAverageMessageBytes: resolveNumberOption(
    options.maxCombinedAverageMessageBytes,
    undefined,
    STREAMING_SITE_CONNECTION_BUDGET.maxAverageMessageBytes
  ),
  maxCombinedMaxMessageBytes: resolveNumberOption(
    options.maxCombinedMaxMessageBytes,
    undefined,
    STREAMING_SITE_CONNECTION_BUDGET.maxMessageBytes
  ),
  maxDroppedMessages:
    typeof options.maxDroppedMessages === 'number'
      ? options.maxDroppedMessages
      : STREAMING_SITE_CONNECTION_BUDGET.maxDroppedMessages,
  maxDirectionalLatencySkewMs:
    typeof options.maxDirectionalLatencySkewMs === 'number'
      ? options.maxDirectionalLatencySkewMs
      : STREAMING_SITE_CONNECTION_BUDGET.maxDirectionalLatencySkewMs,
  maxFixtureAverageMessageBytes: resolveNumberOption(
    options.maxFixtureAverageMessageBytes,
    options.maxCombinedAverageMessageBytes,
    STREAMING_SITE_CONNECTION_BUDGET.maxAverageMessageBytes
  ),
  maxFixtureDirectionalLatencySkewMs: resolveNumberOption(
    options.maxFixtureDirectionalLatencySkewMs,
    options.maxDirectionalLatencySkewMs,
    STREAMING_SITE_CONNECTION_BUDGET.maxDirectionalLatencySkewMs
  ),
  maxFixtureByteLossRate: resolveNumberOption(
    options.maxFixtureByteLossRate,
    options.maxByteLossRate,
    STREAMING_SITE_CONNECTION_BUDGET.maxByteLossRate
  ),
  maxFixtureDroppedMessages: resolveNumberOption(
    options.maxFixtureDroppedMessages,
    options.maxDroppedMessages,
    STREAMING_SITE_CONNECTION_BUDGET.maxDroppedMessages
  ),
  maxFixtureLostBytes: resolveNumberOption(options.maxFixtureLostBytes, undefined, 0),
  maxFixtureMaxMessageBytes: resolveNumberOption(
    options.maxFixtureMaxMessageBytes,
    options.maxCombinedMaxMessageBytes,
    STREAMING_SITE_CONNECTION_BUDGET.maxMessageBytes
  ),
  maxFixtureMissingDirectionalDeliveryCount: resolveNumberOption(
    options.maxFixtureMissingDirectionalDeliveryCount,
    undefined,
    0
  ),
  maxFixtureRoundTripP95LatencyMs: resolveNumberOption(
    options.maxFixtureRoundTripP95LatencyMs,
    options.maxRoundTripP95LatencyMs,
    STREAMING_SITE_CONNECTION_P95_ROUND_TRIP_BUDGET_MS
  ),
  minFixturesPerRequiredProvider: resolveMinimumFixtureCount(
    options.minFixturesPerRequiredProvider
  ),
  maxProviderDirectionalLatencySkewMs: resolveNumberOption(
    options.maxProviderDirectionalLatencySkewMs,
    options.maxDirectionalLatencySkewMs,
    STREAMING_SITE_CONNECTION_BUDGET.maxDirectionalLatencySkewMs
  ),
  maxProviderLostBytes: resolveNumberOption(options.maxProviderLostBytes, undefined, 0),
  maxProviderAverageMessageBytes: resolveNumberOption(
    options.maxProviderAverageMessageBytes,
    options.maxCombinedAverageMessageBytes,
    STREAMING_SITE_CONNECTION_BUDGET.maxAverageMessageBytes
  ),
  maxProviderMaxMessageBytes: resolveNumberOption(
    options.maxProviderMaxMessageBytes,
    options.maxCombinedMaxMessageBytes,
    STREAMING_SITE_CONNECTION_BUDGET.maxMessageBytes
  ),
  maxProviderMissingDirectionalDeliveryCount: resolveNumberOption(
    options.maxProviderMissingDirectionalDeliveryCount,
    undefined,
    0
  ),
  maxProviderOutOfOrderMessages:
    typeof options.maxProviderOutOfOrderMessages === 'number'
      ? options.maxProviderOutOfOrderMessages
      : STREAMING_SITE_CONNECTION_BUDGET.maxOutOfOrderMessages,
  maxProviderRoundTripP95LatencyMs: resolveNumberOption(
    options.maxProviderRoundTripP95LatencyMs,
    options.maxRoundTripP95LatencyMs,
    STREAMING_SITE_CONNECTION_P95_ROUND_TRIP_BUDGET_MS
  ),
  maxProviderSequenceGapMessages:
    typeof options.maxProviderSequenceGapMessages === 'number'
      ? options.maxProviderSequenceGapMessages
      : STREAMING_SITE_CONNECTION_BUDGET.maxSequenceGapMessages,
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
})

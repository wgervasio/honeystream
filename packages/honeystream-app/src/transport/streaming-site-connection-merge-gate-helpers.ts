import { MediaProvider } from 'protocol'
import { StreamingSiteConnectionProfileOptimization } from './streaming-site-connection-optimizer'
import {
  PROVIDER_LABELS,
  ResolvedMergeGateOptions,
  StreamingSiteProviderFixtureCount
} from './streaming-site-connection-merge-gate-types'

type ProviderQuality = StreamingSiteConnectionProfileOptimization['providerQuality'][number]

export const hasCoveredProvider = (
  profile: StreamingSiteConnectionProfileOptimization | undefined,
  provider: MediaProvider
): boolean =>
  Boolean(
    profile &&
      profile.providerCoverage.some(
        coverage => coverage.provider === provider && coverage.siteCount > 0
      )
  )

export const getCoveredProviders = (
  profile: StreamingSiteConnectionProfileOptimization | undefined
): readonly MediaProvider[] =>
  profile
    ? profile.providerCoverage
        .filter(coverage => coverage.siteCount > 0)
        .map(coverage => coverage.provider)
    : []

export const getProviderFixtureCounts = (
  profile: StreamingSiteConnectionProfileOptimization | undefined
): readonly StreamingSiteProviderFixtureCount[] =>
  profile
    ? profile.providerCoverage
        .filter(coverage => coverage.siteCount > 0)
        .map(coverage => ({
          provider: coverage.provider,
          siteCount: coverage.siteCount
        }))
    : []

export const getProviderFixtureCount = (
  profile: StreamingSiteConnectionProfileOptimization | undefined,
  provider: MediaProvider
): number => {
  const coverage = profile
    ? profile.providerCoverage.find(item => item.provider === provider)
    : undefined
  return coverage ? coverage.siteCount : 0
}

export const selectedMetric = (
  profile: StreamingSiteConnectionProfileOptimization | undefined,
  selector: (profile: StreamingSiteConnectionProfileOptimization) => number
): number => (profile ? selector(profile) : 0)

export const maxProviderQualityValue = (
  profile: StreamingSiteConnectionProfileOptimization | undefined,
  selector: (quality: ProviderQuality) => number
): number =>
  profile
    ? profile.providerQuality.reduce((maxValue, quality) => Math.max(maxValue, selector(quality)), 0)
    : 0

const createProviderQualityFailures = (
  profile: StreamingSiteConnectionProfileOptimization | undefined,
  options: ResolvedMergeGateOptions
): readonly string[] => {
  if (!profile) return []

  const failures: string[] = []
  for (const quality of profile.providerQuality) {
    const label = PROVIDER_LABELS[quality.provider]
    if (quality.maxAverageMessageBytes > options.maxProviderAverageMessageBytes) {
      failures.push(
        `${label} provider average control frame exceeded ` +
          `${options.maxProviderAverageMessageBytes} bytes.`
      )
    }
    if (quality.maxMessageBytes > options.maxProviderMaxMessageBytes) {
      failures.push(
        `${label} provider control frame exceeded ${options.maxProviderMaxMessageBytes} bytes.`
      )
    }
    if (quality.maxOutOfOrderMessages > options.maxProviderOutOfOrderMessages) {
      failures.push(
        `${label} provider reordered more than ${options.maxProviderOutOfOrderMessages} controls.`
      )
    }
    if (quality.maxLostBytes > options.maxProviderLostBytes) {
      failures.push(
        `${label} provider lost more than ${options.maxProviderLostBytes} control bytes.`
      )
    }
    if (quality.maxRetransmissionRate > options.maxProviderRetransmissionRate) {
      failures.push(
        `${label} provider recovered retry rate exceeded ${options.maxProviderRetransmissionRate}.`
      )
    }
    if (quality.maxRetransmissionByteRate > options.maxProviderRetransmissionByteRate) {
      failures.push(
        `${label} provider recovered retry bytes exceeded ${
          options.maxProviderRetransmissionByteRate
        }.`
      )
    }
    if (
      quality.maxMissingDirectionalDeliveryCount >
      options.maxProviderMissingDirectionalDeliveryCount
    ) {
      failures.push(
        `${label} provider missed more than ` +
          `${options.maxProviderMissingDirectionalDeliveryCount} delivery directions.`
      )
    }
    if (quality.maxEstimatedRoundTripP95LatencyMs > options.maxProviderRoundTripP95LatencyMs) {
      failures.push(
        `${label} provider P95 mock round trip exceeded ` +
          `${options.maxProviderRoundTripP95LatencyMs}ms.`
      )
    }
    if (quality.maxDirectionalLatencySkewMs > options.maxProviderDirectionalLatencySkewMs) {
      failures.push(
        `${label} provider directional latency skew exceeded ` +
          `${options.maxProviderDirectionalLatencySkewMs}ms.`
      )
    }
    if (quality.maxSequenceGapMessages > options.maxProviderSequenceGapMessages) {
      failures.push(
        `${label} provider skipped more than ${options.maxProviderSequenceGapMessages} controls.`
      )
    }
  }
  return failures
}

export const createStreamingSiteConnectionMergeGateFailures = (
  profile: StreamingSiteConnectionProfileOptimization | undefined,
  missingProviders: readonly MediaProvider[],
  undercoveredProviders: readonly MediaProvider[],
  options: ResolvedMergeGateOptions
): readonly string[] => {
  const failures: string[] = []
  if (!profile) failures.push('No streaming-site transport lane passed every deterministic trial.')
  for (const provider of missingProviders) {
    failures.push(`${PROVIDER_LABELS[provider]} coverage is missing from the streaming-site matrix.`)
  }
  for (const provider of undercoveredProviders) {
    failures.push(
      `${PROVIDER_LABELS[provider]} coverage has fewer than ` +
        `${options.minFixturesPerRequiredProvider} streaming-site fixtures.`
    )
  }
  if (profile && profile.maxCombinedByteLossRate > options.maxByteLossRate) {
    failures.push(`Byte loss exceeded ${options.maxByteLossRate}.`)
  }
  if (
    profile &&
    profile.maxCombinedAverageMessageBytes > options.maxCombinedAverageMessageBytes
  ) {
    failures.push(
      `Average control frame exceeded ${options.maxCombinedAverageMessageBytes} bytes.`
    )
  }
  if (profile && profile.maxCombinedMaxMessageBytes > options.maxCombinedMaxMessageBytes) {
    failures.push(`A control frame exceeded ${options.maxCombinedMaxMessageBytes} bytes.`)
  }
  if (profile && profile.maxCombinedDroppedMessages > options.maxDroppedMessages) {
    failures.push(`Dropped controls exceeded ${options.maxDroppedMessages}.`)
  }
  if (
    profile &&
    profile.maxFixtureAverageMessageBytes > options.maxFixtureAverageMessageBytes
  ) {
    failures.push(
      `A site fixture average control frame exceeded ` +
        `${options.maxFixtureAverageMessageBytes} bytes.`
    )
  }
  if (profile && profile.maxFixtureByteLossRate > options.maxFixtureByteLossRate) {
    failures.push(`A site fixture byte-loss rate exceeded ${options.maxFixtureByteLossRate}.`)
  }
  if (profile && profile.maxFixtureDroppedMessages > options.maxFixtureDroppedMessages) {
    failures.push(`A site fixture dropped more than ${options.maxFixtureDroppedMessages} controls.`)
  }
  if (profile && profile.maxFixtureLostBytes > options.maxFixtureLostBytes) {
    failures.push(`A site fixture lost more than ${options.maxFixtureLostBytes} control bytes.`)
  }
  if (profile && profile.maxFixtureMaxMessageBytes > options.maxFixtureMaxMessageBytes) {
    failures.push(
      `A site fixture control frame exceeded ${options.maxFixtureMaxMessageBytes} bytes.`
    )
  }
  if (profile && profile.maxFixtureRetransmissionRate > options.maxFixtureRetransmissionRate) {
    failures.push(
      `A site fixture recovered retry rate exceeded ${options.maxFixtureRetransmissionRate}.`
    )
  }
  if (
    profile &&
    profile.maxFixtureRetransmissionByteRate > options.maxFixtureRetransmissionByteRate
  ) {
    failures.push(
      `A site fixture recovered retry bytes exceeded ${options.maxFixtureRetransmissionByteRate}.`
    )
  }
  if (
    profile &&
    profile.maxFixtureMissingDirectionalDeliveryCount >
      options.maxFixtureMissingDirectionalDeliveryCount
  ) {
    failures.push(
      `A site fixture missed more than ` +
        `${options.maxFixtureMissingDirectionalDeliveryCount} delivery directions.`
    )
  }
  if (
    profile &&
    profile.maxFixtureDirectionalLatencySkewMs > options.maxFixtureDirectionalLatencySkewMs
  ) {
    failures.push(
      `A site fixture directional latency skew exceeded ` +
        `${options.maxFixtureDirectionalLatencySkewMs}ms.`
    )
  }
  failures.push(...createProviderQualityFailures(profile, options))
  if (profile && profile.maxCombinedRetransmissionRate > options.maxRetransmissionRate) {
    failures.push(`Recovered retry rate exceeded ${options.maxRetransmissionRate}.`)
  }
  if (profile && profile.maxCombinedRetransmissionByteRate > options.maxRetransmissionByteRate) {
    failures.push(`Recovered retry bytes exceeded ${options.maxRetransmissionByteRate}.`)
  }
  if (profile && profile.maxDirectionalLatencySkewMs > options.maxDirectionalLatencySkewMs) {
    failures.push(`Directional latency skew exceeded ${options.maxDirectionalLatencySkewMs}ms.`)
  }
  if (
    profile &&
    profile.maxDirectionalRetransmissionByteRate > options.maxDirectionalRetransmissionByteRate
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

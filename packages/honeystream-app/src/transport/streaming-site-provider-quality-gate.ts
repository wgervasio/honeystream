import { MediaProvider } from 'protocol'
import {
  STREAMING_SITE_CONNECTION_BUDGET,
  STREAMING_SITE_CONNECTION_P95_ROUND_TRIP_BUDGET_MS
} from './streaming-site-connection-defaults'
import { StreamingSiteConnectionOptimizationResult } from './streaming-site-connection-optimizer'
import { StreamingSiteProviderQuality } from './streaming-site-provider-quality'

export interface StreamingSiteProviderQualityGateOptions {
  readonly maxProviderByteLossRate?: number
  readonly maxProviderDroppedMessages?: number
  readonly maxProviderLostBytes?: number
  readonly maxProviderOutOfOrderMessages?: number
  readonly maxProviderRetransmissionByteRate?: number
  readonly maxProviderRoundTripP95LatencyMs?: number
  readonly maxProviderSequenceGapMessages?: number
  readonly requiredProviders?: readonly MediaProvider[]
}

export interface StreamingSiteProviderQualityGateSummary {
  readonly failures: readonly string[]
  readonly maxProviderByteLossRate: number
  readonly maxProviderDroppedMessages: number
  readonly maxProviderLostBytes: number
  readonly maxProviderOutOfOrderMessages: number
  readonly maxProviderRetransmissionByteRate: number
  readonly maxProviderRoundTripP95LatencyMs: number
  readonly maxProviderSequenceGapMessages: number
  readonly missingProviders: readonly MediaProvider[]
  readonly ok: boolean
  readonly providerQuality: readonly StreamingSiteProviderQuality[]
  readonly requiredProviders: readonly MediaProvider[]
  readonly selectedProfileId?: string
  readonly selectedProfileLabel?: string
}

const DEFAULT_REQUIRED_PROVIDERS: readonly MediaProvider[] = Object.freeze([
  'youtube',
  'animepahe',
  'cineby',
  'miruro'
])

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

const maxQualityValue = (
  providerQuality: readonly StreamingSiteProviderQuality[],
  selector: (quality: StreamingSiteProviderQuality) => number
): number =>
  providerQuality.reduce((maxValue, quality) => Math.max(maxValue, selector(quality)), 0)

const hasProviderQuality = (
  providerQuality: readonly StreamingSiteProviderQuality[],
  provider: MediaProvider
): boolean =>
  providerQuality.some(quality => quality.provider === provider && quality.siteCount > 0)

const createFailureList = (
  providerQuality: readonly StreamingSiteProviderQuality[],
  missingProviders: readonly MediaProvider[],
  options: Required<StreamingSiteProviderQualityGateOptions>
): readonly string[] => {
  const failures: string[] = []
  if (providerQuality.length === 0) {
    failures.push('No selected streaming-site lane exposed provider quality observations.')
  }
  for (const provider of missingProviders) {
    failures.push(`${providerLabel(provider)} provider quality is missing from the merge gate.`)
  }
  for (const quality of providerQuality) {
    const label = providerLabel(quality.provider)
    if (quality.maxByteLossRate > options.maxProviderByteLossRate) {
      failures.push(`${label} provider byte-loss rate exceeded ${options.maxProviderByteLossRate}.`)
    }
    if (quality.maxDroppedMessages > options.maxProviderDroppedMessages) {
      failures.push(
        `${label} provider dropped more than ${options.maxProviderDroppedMessages} controls.`
      )
    }
    if (quality.maxLostBytes > options.maxProviderLostBytes) {
      failures.push(
        `${label} provider lost more than ${options.maxProviderLostBytes} control bytes.`
      )
    }
    if (quality.maxOutOfOrderMessages > options.maxProviderOutOfOrderMessages) {
      failures.push(
        `${label} provider reordered more than ${options.maxProviderOutOfOrderMessages} controls.`
      )
    }
    if (quality.maxSequenceGapMessages > options.maxProviderSequenceGapMessages) {
      failures.push(
        `${label} provider skipped more than ${options.maxProviderSequenceGapMessages} controls.`
      )
    }
    if (quality.maxRetransmissionByteRate > options.maxProviderRetransmissionByteRate) {
      failures.push(
        `${label} provider recovered retry bytes exceeded ${
          options.maxProviderRetransmissionByteRate
        }.`
      )
    }
    if (quality.maxEstimatedRoundTripP95LatencyMs > options.maxProviderRoundTripP95LatencyMs) {
      failures.push(
        `${label} provider P95 mock round trip exceeded ${
          options.maxProviderRoundTripP95LatencyMs
        }ms.`
      )
    }
  }
  return failures
}

/*
Context: The streaming merge gate should catch provider-specific regressions hidden by averages.
Invariant: Every named provider must expose zero byte loss, ordered controls, and bounded P95 latency.
Options considered: UI-only provider badges, live website probes, or a pure gate over lab summaries.
Decision: Gate selected optimizer provider-quality observations with explicit per-provider loss,
lost-byte, retry, ordering, and latency budgets.
Performance impact: O(provider count) over five provider buckets; no additional mock transport runs.
Memory/lifecycle ownership: No resources are allocated; optimizer owns and disposes simulations.
Failure mode: Missing observations or over-budget providers become explicit failure strings.
Validation: Covered by streaming-site provider quality gate tests.
*/
export const summarizeStreamingSiteProviderQualityGate = (
  result: StreamingSiteConnectionOptimizationResult,
  options: StreamingSiteProviderQualityGateOptions = {}
): StreamingSiteProviderQualityGateSummary => {
  const requiredOptions: Required<StreamingSiteProviderQualityGateOptions> = {
    maxProviderByteLossRate:
      typeof options.maxProviderByteLossRate === 'number'
        ? options.maxProviderByteLossRate
        : STREAMING_SITE_CONNECTION_BUDGET.maxByteLossRate,
    maxProviderDroppedMessages:
      typeof options.maxProviderDroppedMessages === 'number'
        ? options.maxProviderDroppedMessages
        : STREAMING_SITE_CONNECTION_BUDGET.maxDroppedMessages,
    maxProviderLostBytes:
      typeof options.maxProviderLostBytes === 'number'
        ? options.maxProviderLostBytes
        : 0,
    maxProviderOutOfOrderMessages:
      typeof options.maxProviderOutOfOrderMessages === 'number'
        ? options.maxProviderOutOfOrderMessages
        : STREAMING_SITE_CONNECTION_BUDGET.maxOutOfOrderMessages,
    maxProviderRetransmissionByteRate:
      typeof options.maxProviderRetransmissionByteRate === 'number'
        ? options.maxProviderRetransmissionByteRate
        : STREAMING_SITE_CONNECTION_BUDGET.maxRetransmissionByteRate,
    maxProviderRoundTripP95LatencyMs:
      typeof options.maxProviderRoundTripP95LatencyMs === 'number'
        ? options.maxProviderRoundTripP95LatencyMs
        : STREAMING_SITE_CONNECTION_P95_ROUND_TRIP_BUDGET_MS,
    maxProviderSequenceGapMessages:
      typeof options.maxProviderSequenceGapMessages === 'number'
        ? options.maxProviderSequenceGapMessages
        : STREAMING_SITE_CONNECTION_BUDGET.maxSequenceGapMessages,
    requiredProviders: options.requiredProviders || DEFAULT_REQUIRED_PROVIDERS
  }
  const providerQuality = result.bestProfile ? result.bestProfile.providerQuality : []
  const missingProviders = requiredOptions.requiredProviders.filter(
    provider => !hasProviderQuality(providerQuality, provider)
  )
  const failures = createFailureList(providerQuality, missingProviders, requiredOptions)

  return {
    failures,
    maxProviderByteLossRate: maxQualityValue(providerQuality, quality => quality.maxByteLossRate),
    maxProviderDroppedMessages: maxQualityValue(
      providerQuality,
      quality => quality.maxDroppedMessages
    ),
    maxProviderLostBytes: maxQualityValue(providerQuality, quality => quality.maxLostBytes),
    maxProviderOutOfOrderMessages: maxQualityValue(
      providerQuality,
      quality => quality.maxOutOfOrderMessages
    ),
    maxProviderRetransmissionByteRate: maxQualityValue(
      providerQuality,
      quality => quality.maxRetransmissionByteRate
    ),
    maxProviderRoundTripP95LatencyMs: maxQualityValue(
      providerQuality,
      quality => quality.maxEstimatedRoundTripP95LatencyMs
    ),
    maxProviderSequenceGapMessages: maxQualityValue(
      providerQuality,
      quality => quality.maxSequenceGapMessages
    ),
    missingProviders,
    ok: failures.length === 0,
    providerQuality,
    requiredProviders: requiredOptions.requiredProviders,
    selectedProfileId: result.bestProfile ? result.bestProfile.profile.id : undefined,
    selectedProfileLabel: result.bestProfile ? result.bestProfile.profile.label : undefined
  }
}

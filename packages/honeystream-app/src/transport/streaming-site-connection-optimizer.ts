import {
  runStreamingSiteConnectionLab,
  StreamingSiteConnectionFixture,
  StreamingSiteConnectionLabResult,
  StreamingSiteConnectionProfile
} from './streaming-site-connection-lab'
import { MediaProvider } from 'protocol'
import { SimulatedPeerTransportBudget } from './simulated-peer-transport-performance'
import { StreamingSiteProviderCoverage } from './streaming-site-provider-coverage'

export interface StreamingSiteConnectionOptimizationOptions {
  readonly budget?: SimulatedPeerTransportBudget
  readonly fixtures: readonly StreamingSiteConnectionFixture[]
  readonly nowStartMs?: number
  readonly profiles: readonly StreamingSiteConnectionProfile[]
  readonly randomSamples?: readonly number[]
  readonly trialCount?: number
}

export interface StreamingSiteConnectionProfileOptimization {
  readonly allTrialsPassed: boolean
  readonly averageEstimatedRoundTripP95LatencyMs: number
  readonly failedTrials: number
  readonly maxCombinedAverageMessageBytes: number
  readonly maxCombinedByteLossRate: number
  readonly maxCombinedDroppedMessages: number
  readonly maxCombinedPeakQueuedMessages: number
  readonly maxCombinedRetransmissionRate: number
  readonly maxDirectionalAverageLatencyMs: number
  readonly maxDirectionalLatencyJitterMs: number
  readonly maxDirectionalRetransmissionRate: number
  readonly maxEstimatedRoundTripMaxLatencyMs: number
  readonly maxEstimatedRoundTripP95LatencyMs: number
  readonly passedTrials: number
  readonly profile: StreamingSiteConnectionProfile
  readonly providerCoverage: readonly StreamingSiteProviderCoverage[]
  readonly providers: readonly MediaProvider[]
  readonly siteCount: number
  readonly trialCount: number
}

export interface StreamingSiteConnectionOptimizationResult {
  readonly bestProfile?: StreamingSiteConnectionProfileOptimization
  readonly rankedProfiles: readonly StreamingSiteConnectionProfileOptimization[]
  readonly trialCount: number
}

const DEFAULT_OPTIMIZATION_TRIALS = 3
const MAX_OPTIMIZATION_TRIALS = 16
const TRIAL_CLOCK_OFFSET_MS = 100000
const DEFAULT_RANDOM_SAMPLES: readonly number[] = Object.freeze([0.13, 0.5, 0.87, 0.29, 0.71])

const clampUnitSample = (value: number): number => {
  if (!Number.isFinite(value) || value <= 0) return 0
  if (value >= 1) return 0.999999
  return value
}

const normalizeTrialCount = (value: number | undefined): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_OPTIMIZATION_TRIALS
  return Math.min(MAX_OPTIMIZATION_TRIALS, Math.max(1, Math.floor(value)))
}

const normalizeRandomSamples = (samples: readonly number[] | undefined): readonly number[] => {
  if (!samples || samples.length === 0) return DEFAULT_RANDOM_SAMPLES
  const normalizedSamples = samples
    .filter(sample => typeof sample === 'number' && Number.isFinite(sample))
    .map(clampUnitSample)
  return normalizedSamples.length > 0 ? normalizedSamples : DEFAULT_RANDOM_SAMPLES
}

const createTrialRandom = (samples: readonly number[], trialIndex: number): (() => number) => {
  let sampleOffset = 0
  return () => {
    const sample = samples[(trialIndex + sampleOffset) % samples.length]
    sampleOffset += 1
    return sample
  }
}

const findProfileRank = (
  result: StreamingSiteConnectionLabResult,
  profileId: string
): StreamingSiteConnectionLabResult['rankedProfiles'][number] => {
  const rank = result.rankedProfiles.find(item => item.profile.id === profileId)
  if (!rank) throw new Error(`Streaming connection optimizer missed profile "${profileId}".`)
  return rank
}

const createProfileOptimization = (
  profile: StreamingSiteConnectionProfile,
  trialResults: readonly StreamingSiteConnectionLabResult[]
): StreamingSiteConnectionProfileOptimization => {
  let passedTrials = 0
  let maxCombinedAverageMessageBytes = 0
  let maxCombinedByteLossRate = 0
  let maxCombinedDroppedMessages = 0
  let maxCombinedPeakQueuedMessages = 0
  let maxCombinedRetransmissionRate = 0
  let maxDirectionalAverageLatencyMs = 0
  let maxDirectionalLatencyJitterMs = 0
  let maxDirectionalRetransmissionRate = 0
  let maxEstimatedRoundTripMaxLatencyMs = 0
  let maxEstimatedRoundTripP95LatencyMs = 0
  let totalEstimatedRoundTripP95LatencyMs = 0

  for (const result of trialResults) {
    const rank = findProfileRank(result, profile.id)
    const metrics = rank.candidate.metrics
    if (rank.budgetResult.ok) passedTrials += 1
    maxCombinedAverageMessageBytes = Math.max(
      maxCombinedAverageMessageBytes,
      metrics.combinedAverageMessageBytes
    )
    maxCombinedByteLossRate = Math.max(maxCombinedByteLossRate, metrics.combinedByteLossRate)
    maxCombinedDroppedMessages = Math.max(
      maxCombinedDroppedMessages,
      metrics.combinedDroppedMessages
    )
    maxCombinedRetransmissionRate = Math.max(
      maxCombinedRetransmissionRate,
      metrics.combinedRetransmissionRate
    )
    maxCombinedPeakQueuedMessages = Math.max(
      maxCombinedPeakQueuedMessages,
      metrics.combinedPeakQueuedMessages
    )
    maxDirectionalAverageLatencyMs = Math.max(
      maxDirectionalAverageLatencyMs,
      metrics.maxDirectionalAverageLatencyMs
    )
    maxDirectionalLatencyJitterMs = Math.max(
      maxDirectionalLatencyJitterMs,
      metrics.maxDirectionalLatencyJitterMs
    )
    maxDirectionalRetransmissionRate = Math.max(
      maxDirectionalRetransmissionRate,
      metrics.maxDirectionalRetransmissionRate
    )
    maxEstimatedRoundTripMaxLatencyMs = Math.max(
      maxEstimatedRoundTripMaxLatencyMs,
      metrics.estimatedRoundTripMaxLatencyMs
    )
    maxEstimatedRoundTripP95LatencyMs = Math.max(
      maxEstimatedRoundTripP95LatencyMs,
      metrics.estimatedRoundTripP95LatencyMs
    )
    totalEstimatedRoundTripP95LatencyMs += metrics.estimatedRoundTripP95LatencyMs
  }

  const trialCount = trialResults.length
  const firstRank =
    trialResults.length === 0 ? undefined : findProfileRank(trialResults[0], profile.id)

  return {
    allTrialsPassed: passedTrials === trialCount,
    averageEstimatedRoundTripP95LatencyMs:
      trialCount === 0 ? 0 : totalEstimatedRoundTripP95LatencyMs / trialCount,
    failedTrials: trialCount - passedTrials,
    maxCombinedAverageMessageBytes,
    maxCombinedByteLossRate,
    maxCombinedDroppedMessages,
    maxCombinedPeakQueuedMessages,
    maxCombinedRetransmissionRate,
    maxDirectionalAverageLatencyMs,
    maxDirectionalLatencyJitterMs,
    maxDirectionalRetransmissionRate,
    maxEstimatedRoundTripMaxLatencyMs,
    maxEstimatedRoundTripP95LatencyMs,
    passedTrials,
    profile,
    providerCoverage: firstRank ? firstRank.providerCoverage : [],
    providers: firstRank ? firstRank.providers : [],
    siteCount: firstRank ? firstRank.siteCount : 0,
    trialCount
  }
}

const compareOptimizedProfiles = (
  left: StreamingSiteConnectionProfileOptimization,
  right: StreamingSiteConnectionProfileOptimization
): number => {
  if (left.allTrialsPassed !== right.allTrialsPassed) return left.allTrialsPassed ? -1 : 1
  if (left.passedTrials !== right.passedTrials) return right.passedTrials - left.passedTrials
  if (left.maxCombinedByteLossRate !== right.maxCombinedByteLossRate) {
    return left.maxCombinedByteLossRate - right.maxCombinedByteLossRate
  }
  if (left.maxCombinedDroppedMessages !== right.maxCombinedDroppedMessages) {
    return left.maxCombinedDroppedMessages - right.maxCombinedDroppedMessages
  }
  if (left.maxCombinedRetransmissionRate !== right.maxCombinedRetransmissionRate) {
    return left.maxCombinedRetransmissionRate - right.maxCombinedRetransmissionRate
  }
  if (left.maxDirectionalRetransmissionRate !== right.maxDirectionalRetransmissionRate) {
    return left.maxDirectionalRetransmissionRate - right.maxDirectionalRetransmissionRate
  }
  if (left.maxEstimatedRoundTripP95LatencyMs !== right.maxEstimatedRoundTripP95LatencyMs) {
    return left.maxEstimatedRoundTripP95LatencyMs - right.maxEstimatedRoundTripP95LatencyMs
  }
  if (left.maxDirectionalAverageLatencyMs !== right.maxDirectionalAverageLatencyMs) {
    return left.maxDirectionalAverageLatencyMs - right.maxDirectionalAverageLatencyMs
  }
  if (left.maxCombinedAverageMessageBytes !== right.maxCombinedAverageMessageBytes) {
    return left.maxCombinedAverageMessageBytes - right.maxCombinedAverageMessageBytes
  }
  return left.profile.id.localeCompare(right.profile.id)
}

/*
Context: Streaming-site merge gates need more than one lucky mock-network pass.
Invariant: A selected lane must stay zero-loss, low-retry, and low-latency across bounded
jitter/drop samples.
Options considered: Live third-party smoke tests, unbounded random fuzzing, or deterministic trials.
Decision: Run the existing host/guest lab over capped deterministic samples and rank by loss,
retry overhead, then latency.
Performance impact: Work is bounded by profile count, fixture count, and MAX_OPTIMIZATION_TRIALS.
Memory/lifecycle ownership: No persistent resources; each lab run disposes its simulated transports.
Failure mode: If every profile fails a trial, bestProfile is undefined and rankedProfiles exposes why.
Validation: Covered by streaming-site-connection-optimizer tests.
*/
export const optimizeStreamingSiteConnectionProfiles = async (
  options: StreamingSiteConnectionOptimizationOptions
): Promise<StreamingSiteConnectionOptimizationResult> => {
  const trialCount = normalizeTrialCount(options.trialCount)
  const randomSamples = normalizeRandomSamples(options.randomSamples)
  const trialResults: StreamingSiteConnectionLabResult[] = []

  for (let trialIndex = 0; trialIndex < trialCount; trialIndex += 1) {
    trialResults.push(
      await runStreamingSiteConnectionLab({
        budget: options.budget,
        fixtures: options.fixtures,
        nowStartMs: (options.nowStartMs || 10000) + trialIndex * TRIAL_CLOCK_OFFSET_MS,
        profiles: options.profiles,
        random: createTrialRandom(randomSamples, trialIndex)
      })
    )
  }

  const rankedProfiles = options.profiles
    .map(profile => createProfileOptimization(profile, trialResults))
    .sort(compareOptimizedProfiles)

  return {
    bestProfile: rankedProfiles.find(profile => profile.allTrialsPassed),
    rankedProfiles,
    trialCount
  }
}

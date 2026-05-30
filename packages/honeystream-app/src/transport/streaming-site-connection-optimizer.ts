import {
  runStreamingSiteConnectionLab,
  StreamingSiteConnectionFixture,
  StreamingSiteConnectionLabResult,
  StreamingSiteConnectionProfile
} from './streaming-site-connection-lab'
import { SimulatedPeerTransportBudget } from './simulated-peer-transport-performance'
import {
  compareStreamingSiteConnectionProfileOptimizations,
  createStreamingSiteConnectionProfileOptimization,
  StreamingSiteConnectionProfileOptimization
} from './streaming-site-connection-profile-optimization'

export { StreamingSiteConnectionProfileOptimization }

export interface StreamingSiteConnectionOptimizationOptions {
  readonly budget?: SimulatedPeerTransportBudget
  readonly fixtures: readonly StreamingSiteConnectionFixture[]
  readonly nowStartMs?: number
  readonly profiles: readonly StreamingSiteConnectionProfile[]
  readonly randomSamples?: readonly number[]
  readonly trialCount?: number
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

/*
Context: Streaming-site merge gates need more than one lucky mock-network pass.
Invariant: A selected lane must stay zero-loss, low-retry, and low-latency across bounded
jitter/drop samples and every site fixture.
Options considered: Live third-party smoke tests, unbounded random fuzzing, or deterministic trials.
Decision: Run the host/guest lab over capped samples, rank by per-fixture loss, then latency.
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
    .map(profile => createStreamingSiteConnectionProfileOptimization(profile, trialResults))
    .sort(compareStreamingSiteConnectionProfileOptimizations)

  return {
    bestProfile: rankedProfiles.find(profile => profile.allTrialsPassed),
    rankedProfiles,
    trialCount
  }
}

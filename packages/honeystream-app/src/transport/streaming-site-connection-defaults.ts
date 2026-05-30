import { classifyMediaProvider } from 'protocol'
import { StreamingSiteConnectionProfile } from './streaming-site-connection-lab'
import {
  SimulatedPeerTransportBudget,
  STREAMING_SITE_TRANSPORT_BUDGET
} from './simulated-peer-transport-performance'
import { STREAMING_SITE_CONNECTION_FIXTURES } from './streaming-site-connection-fixtures'
import { countStreamingSiteProviders } from './streaming-site-provider-coverage'

export { STREAMING_SITE_CONNECTION_FIXTURES } from './streaming-site-connection-fixtures'

export const STREAMING_SITE_CONNECTION_PROFILES: readonly StreamingSiteConnectionProfile[] = Object.freeze(
  [
    /*
    Context: The optimizer should visibly reject fast lanes that lose controls and slower lanes
    that exceed the mock round-trip budget.
    Invariant: The selected streaming profile must have zero byte loss before latency ranking.
    Options considered: One happy-path profile only, random live-network probes, or explicit lanes.
    Decision: Keep failing lossy/slow lanes beside clean/retry lanes so tests prove selection behavior.
    Performance impact: Profile count is fixed and small; lab work remains bounded by fixture count.
    Memory/lifecycle ownership: No resources are allocated by these static profiles.
    Failure mode: If budgets drift, the optimizer returns no selected profile instead of guessing.
    Validation: Covered by streaming-site connection lab and optimizer tests.
    */
    {
      id: 'lossy-fast',
      label: 'Lossy fast lane',
      network: { latencyMs: 3, dropEveryNthMessage: 7, maxQueuedFrames: 128 }
    },
    {
      id: 'slow-safe',
      label: 'Slow reliable lane',
      network: { latencyMs: 24, maxQueuedFrames: 128 }
    },
    {
      id: 'retry-guarded',
      label: 'Retry guarded lane',
      network: {
        latencyMs: 3,
        dropEveryNthMessage: 5,
        maxQueuedFrames: 128,
        retransmitDroppedFrames: true,
        retransmitDelayMs: 2
      }
    },
    {
      id: 'clean-ultra-low-latency',
      label: 'Clean ultra-low latency lane',
      network: { latencyMs: 1, maxQueuedFrames: 128 }
    },
    {
      id: 'clean-realtime',
      label: 'Clean realtime lane',
      network: { latencyMs: 2, maxQueuedFrames: 128 }
    },
    {
      id: 'clean-fast',
      label: 'Clean fast lane',
      network: { latencyMs: 4, jitterMs: 1, maxQueuedFrames: 128 }
    },
    {
      id: 'balanced-low-latency',
      label: 'Balanced low-latency lane',
      network: { latencyMs: 8, jitterMs: 2, maxQueuedFrames: 128 }
    }
  ]
)

export const STREAMING_SITE_CONNECTION_TRIAL_COUNT = 3
export const STREAMING_SITE_CONNECTION_PROVIDER_COVERAGE = Object.freeze(
  countStreamingSiteProviders(
    STREAMING_SITE_CONNECTION_FIXTURES.map(fixture => classifyMediaProvider(fixture.source))
  )
)
export const STREAMING_SITE_CONNECTION_RANDOM_SAMPLES: readonly number[] = Object.freeze([
  0.25,
  0.75,
  0.5
])
export const STREAMING_SITE_CONNECTION_FASTEST_ROUND_TRIP_MS = 2
export const STREAMING_SITE_CONNECTION_P95_ROUND_TRIP_BUDGET_MS = 10
export const STREAMING_SITE_CONNECTION_BUDGET: SimulatedPeerTransportBudget = Object.freeze({
  ...STREAMING_SITE_TRANSPORT_BUDGET,
  maxAverageLatencyMs: 5,
  maxAverageLatencyJitterMs: 2,
  maxP95LatencyMs: 5,
  maxMaxLatencyMs: 5,
  maxMaxLatencyJitterMs: 4,
  maxDirectionalAverageLatencyMs: 5,
  maxDirectionalLatencySkewMs: 4,
  maxEstimatedRoundTripP95LatencyMs: STREAMING_SITE_CONNECTION_P95_ROUND_TRIP_BUDGET_MS,
  maxEstimatedRoundTripMaxLatencyMs: STREAMING_SITE_CONNECTION_P95_ROUND_TRIP_BUDGET_MS
})

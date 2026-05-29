import { classifyMediaProvider } from 'protocol'
import {
  StreamingSiteConnectionFixture,
  StreamingSiteConnectionProfile
} from './streaming-site-connection-lab'
import {
  SimulatedPeerTransportBudget,
  STREAMING_SITE_TRANSPORT_BUDGET
} from './simulated-peer-transport-performance'
import { countStreamingSiteProviders } from './streaming-site-provider-coverage'

export const STREAMING_SITE_CONNECTION_FIXTURES: readonly StreamingSiteConnectionFixture[] = Object.freeze(
  [
    {
      id: 'youtube-watch',
      source: 'https://www.youtube.com/watch?v=honeystream-sync',
      title: 'YouTube watch page'
    },
    {
      id: 'youtube-bare-watch',
      source: 'https://youtube.com/watch?v=honeystream-sync',
      title: 'YouTube bare watch page'
    },
    {
      id: 'youtube-mobile-shorts',
      source: 'https://m.youtube.com/shorts/honeystream-sync',
      title: 'YouTube mobile short',
      durationMs: 45000
    },
    {
      id: 'youtube-short',
      source: 'https://youtu.be/honeystream-sync',
      title: 'YouTube short link'
    },
    {
      id: 'youtube-nocookie',
      source: 'https://www.youtube-nocookie.com/embed/honeystream-sync',
      title: 'YouTube no-cookie embed'
    },
    {
      id: 'youtube-embed',
      source: 'https://www.youtube.com/embed/honeystream-sync',
      title: 'YouTube embed page'
    },
    {
      id: 'youtube-live',
      source: 'https://www.youtube.com/live/honeystream-sync',
      title: 'YouTube live page',
      durationMs: null
    },
    {
      id: 'youtube-music',
      source: 'https://music.youtube.com/watch?v=honeystream-sync',
      title: 'YouTube Music watch page',
      durationMs: 7200000
    },
    {
      id: 'animepahe-ru',
      source: 'https://animepahe.ru/play/honeystream-test',
      title: 'AnimePahe RU episode',
      durationMs: 1440000
    },
    {
      id: 'animepahe-si',
      source: 'https://animepahe.si/anime/honeystream-test',
      title: 'AnimePahe SI episode'
    },
    {
      id: 'animepahe-com',
      source: 'https://animepahe.com/watch/honeystream-test',
      title: 'AnimePahe COM episode'
    },
    {
      id: 'animepahe-www-ru',
      source: 'https://www.animepahe.ru/play/honeystream-test',
      title: 'AnimePahe RU www episode'
    },
    {
      id: 'animepahe-si-query',
      source: 'https://animepahe.si/play/honeystream-test?episode=2',
      title: 'AnimePahe SI episode query',
      durationMs: 1500000
    },
    {
      id: 'cineby-app',
      source: 'https://cineby.app/movie/honeystream-test',
      title: 'Cineby movie',
      durationMs: 7200000
    },
    {
      id: 'cineby-to',
      source: 'https://watch.cineby.to/tv/honeystream-test',
      title: 'Cineby TV'
    },
    {
      id: 'cineby-ru',
      source: 'https://www.cineby.ru/tv/honeystream-test',
      title: 'Cineby RU show'
    },
    {
      id: 'cineby-subdomain',
      source: 'https://video.cineby.app/movie/honeystream-test',
      title: 'Cineby subdomain movie'
    },
    {
      id: 'cineby-app-tv-episode',
      source: 'https://cineby.app/tv/honeystream-test/season/1/episode/1',
      title: 'Cineby app episode',
      durationMs: 3300000
    },
    {
      id: 'cineby-watch-subdomain',
      source: 'https://watch.cineby.app/movie/honeystream-test?server=alpha',
      title: 'Cineby watch subdomain'
    },
    {
      id: 'miruro-to',
      source: 'https://miruro.to/watch/honeystream-test',
      title: 'Miruro watch page',
      durationMs: 1500000
    },
    {
      id: 'miruro-tv',
      source: 'https://www.miruro.tv/watch/honeystream-test',
      title: 'Miruro TV watch page'
    },
    {
      id: 'miruro-query',
      source: 'https://miruro.tv/watch/honeystream-test?episode=1',
      title: 'Miruro episode query'
    },
    {
      id: 'miruro-watch-subdomain',
      source: 'https://watch.miruro.tv/watch/honeystream-test?episode=2',
      title: 'Miruro watch subdomain'
    },
    {
      id: 'generic-site',
      source: 'https://streaming.example.test/watch/honeystream-night',
      title: 'Generic streaming page',
      durationMs: 5400000
    }
  ]
)

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
export const STREAMING_SITE_CONNECTION_FASTEST_ROUND_TRIP_MS = 4
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

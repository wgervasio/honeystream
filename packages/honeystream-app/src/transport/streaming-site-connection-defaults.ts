import {
  StreamingSiteConnectionFixture,
  StreamingSiteConnectionProfile
} from './streaming-site-connection-lab'

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
      title: 'YouTube mobile short'
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
      id: 'animepahe-ru',
      source: 'https://animepahe.ru/play/honeystream-test',
      title: 'AnimePahe RU episode'
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
      id: 'cineby-app',
      source: 'https://cineby.app/movie/honeystream-test',
      title: 'Cineby movie'
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
      id: 'miruro-to',
      source: 'https://miruro.to/watch/honeystream-test',
      title: 'Miruro watch page'
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
      id: 'generic-site',
      source: 'https://streaming.example.test/watch/honeystream-night',
      title: 'Generic streaming page'
    }
  ]
)

export const STREAMING_SITE_CONNECTION_PROFILES: readonly StreamingSiteConnectionProfile[] = Object.freeze(
  [
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
        latencyMs: 4,
        dropEveryNthMessage: 5,
        maxQueuedFrames: 128,
        retransmitDroppedFrames: true,
        retransmitDelayMs: 8
      }
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
export const STREAMING_SITE_CONNECTION_RANDOM_SAMPLES: readonly number[] = Object.freeze([
  0.25,
  0.75,
  0.5
])
export const STREAMING_SITE_CONNECTION_P95_ROUND_TRIP_BUDGET_MS = 10

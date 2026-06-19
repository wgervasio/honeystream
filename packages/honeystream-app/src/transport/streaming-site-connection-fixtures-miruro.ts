import type { StreamingSiteConnectionFixture } from './streaming-site-connection-lab'

export const STREAMING_SITE_MIRURO_FIXTURES: readonly StreamingSiteConnectionFixture[] = Object.freeze(
  [
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
      id: 'miruro-to-anime',
      source: 'https://miruro.to/anime/honeystream-test'
    },
    {
      id: 'miruro-anime-subdomain',
      source: 'https://anime.miruro.tv/watch/honeystream-test'
    },
    {
      id: 'miruro-root',
      source: 'https://miruro.to',
      title: 'Miruro root page'
    },
    {
      id: 'miruro-tv-anime',
      source: 'https://miruro.tv/anime/honeystream-test'
    },
    {
      id: 'miruro-to-watch-time',
      source: 'https://miruro.to/watch/honeystream-test?t=90'
    },
    {
      id: 'miruro-www-to-dub',
      source: 'https://www.miruro.to/watch/honeystream-test?dub=1',
      title: 'Miruro TO dub watch page'
    },
    {
      id: 'miruro-beta-subdomain',
      source: 'https://beta.miruro.tv/watch/honeystream-test?episode=3',
      title: 'Miruro beta subdomain watch page'
    },
    {
      id: 'miruro-tv-dub-episode',
      source: 'https://miruro.tv/watch/honeystream-test?episode=4&dub=1'
    },
    {
      id: 'miruro-www-tv-anime',
      source: 'https://www.miruro.tv/anime/honeystream-test?watch=1',
      title: 'Miruro TV www anime page'
    },
    {
      id: 'miruro-to-autoplay-episode',
      source: 'https://miruro.to/watch/honeystream-test?episode=5&autoplay=1',
      title: 'Miruro autoplay watch page'
    }
  ]
)

import type { StreamingSiteConnectionFixture } from './streaming-site-connection-lab'

export const STREAMING_SITE_CINEBY_FIXTURES: readonly StreamingSiteConnectionFixture[] = Object.freeze(
  [
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
      id: 'cineby-to-movie',
      source: 'https://cineby.to/movie/honeystream-test'
    },
    {
      id: 'cineby-www-app-watch',
      source: 'https://www.cineby.app/watch/honeystream-test'
    },
    {
      id: 'cineby-root',
      source: 'https://cineby.app',
      title: 'Cineby root page'
    },
    {
      id: 'cineby-app-server',
      source: 'https://cineby.app/movie/honeystream-test?server=gamma&autoplay=true'
    },
    {
      id: 'cineby-app-watch-episode',
      source: 'https://cineby.app/watch/honeystream-test?episode=1',
      title: 'Cineby watch episode'
    },
    {
      id: 'cineby-to-tv-episode',
      source: 'https://cineby.to/tv/honeystream-test/season/2/episode/3',
      title: 'Cineby TO episode'
    },
    {
      id: 'cineby-cdn-subdomain',
      source: 'https://cdn.cineby.app/movie/honeystream-test?server=beta',
      title: 'Cineby CDN subdomain movie'
    },
    {
      id: 'cineby-watch-to-movie',
      source: 'https://watch.cineby.to/movie/honeystream-test?server=delta'
    },
    {
      id: 'cineby-watch-to-quality',
      source: 'https://watch.cineby.to/movie/honeystream-test?quality=auto',
      title: 'Cineby watch quality page'
    },
    {
      id: 'cineby-www-to-episode',
      source: 'https://www.cineby.to/tv/honeystream-test/season/1/episode/2',
      title: 'Cineby TO www episode'
    }
  ]
)

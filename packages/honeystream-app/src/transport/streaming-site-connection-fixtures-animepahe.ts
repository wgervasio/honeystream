import type { StreamingSiteConnectionFixture } from './streaming-site-connection-lab'

export const STREAMING_SITE_ANIMEPAHE_FIXTURES: readonly StreamingSiteConnectionFixture[] = Object.freeze(
  [
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
      id: 'animepahe-ru-anime',
      source: 'https://animepahe.ru/anime/honeystream-test'
    },
    {
      id: 'animepahe-com-play',
      source: 'https://animepahe.com/play/honeystream-test?episode=3'
    },
    {
      id: 'animepahe-root',
      source: 'https://animepahe.ru',
      title: 'AnimePahe root page'
    },
    {
      id: 'animepahe-ru-watch',
      source: 'https://animepahe.ru/watch/honeystream-test'
    },
    {
      id: 'animepahe-si-watch',
      source: 'https://animepahe.si/watch/honeystream-test?episode=5'
    },
    {
      id: 'animepahe-www-si-play',
      source: 'https://www.animepahe.si/play/honeystream-test?episode=4',
      title: 'AnimePahe SI www episode'
    },
    {
      id: 'animepahe-com-anime',
      source: 'https://animepahe.com/anime/honeystream-test'
    },
    {
      id: 'animepahe-ru-play-session',
      source: 'https://animepahe.ru/play/honeystream-test?session=alpha'
    },
    {
      id: 'animepahe-www-com-watch',
      source: 'https://www.animepahe.com/watch/honeystream-test?episode=6',
      title: 'AnimePahe COM www watch page'
    },
    {
      id: 'animepahe-si-anime-filter',
      source: 'https://animepahe.si/anime/honeystream-test?sort=recent',
      title: 'AnimePahe SI anime filter'
    }
  ]
)

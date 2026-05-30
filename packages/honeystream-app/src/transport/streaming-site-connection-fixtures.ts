import { StreamingSiteConnectionFixture } from './streaming-site-connection-lab'

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
    { id: 'youtube-root', source: 'https://youtube.com', title: 'YouTube root page' },
    { id: 'youtube-timestamp', source: 'https://www.youtube.com/watch?v=sync&t=42s' },
    { id: 'youtube-tv', source: 'https://tv.youtube.com/watch/honeystream-sync' },
    { id: 'youtube-watch-list', source: 'https://youtube.com/watch?v=sync&list=PLhoneystream' },
    {
      id: 'youtube-playlist',
      source: 'https://www.youtube.com/playlist?list=honeystream-sync',
      title: 'YouTube playlist page'
    },
    {
      id: 'youtube-channel',
      source: 'https://www.youtube.com/@honeystream/videos',
      title: 'YouTube channel videos page'
    },
    {
      id: 'youtube-short-timestamp',
      source: 'https://youtu.be/honeystream-sync?t=42',
      title: 'YouTube short link timestamp'
    },
    {
      id: 'youtube-www-shorts-share',
      source: 'https://www.youtube.com/shorts/honeystream-sync?feature=share'
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
    { id: 'animepahe-ru-anime', source: 'https://animepahe.ru/anime/honeystream-test' },
    { id: 'animepahe-com-play', source: 'https://animepahe.com/play/honeystream-test?episode=3' },
    { id: 'animepahe-root', source: 'https://animepahe.ru', title: 'AnimePahe root page' },
    { id: 'animepahe-ru-watch', source: 'https://animepahe.ru/watch/honeystream-test' },
    { id: 'animepahe-si-watch', source: 'https://animepahe.si/watch/honeystream-test?episode=5' },
    {
      id: 'animepahe-www-si-play',
      source: 'https://www.animepahe.si/play/honeystream-test?episode=4',
      title: 'AnimePahe SI www episode'
    },
    { id: 'animepahe-com-anime', source: 'https://animepahe.com/anime/honeystream-test' },
    {
      id: 'animepahe-ru-play-session',
      source: 'https://animepahe.ru/play/honeystream-test?session=alpha'
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
    { id: 'cineby-to-movie', source: 'https://cineby.to/movie/honeystream-test' },
    { id: 'cineby-www-app-watch', source: 'https://www.cineby.app/watch/honeystream-test' },
    { id: 'cineby-root', source: 'https://cineby.app', title: 'Cineby root page' },
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
    { id: 'miruro-to-anime', source: 'https://miruro.to/anime/honeystream-test' },
    { id: 'miruro-anime-subdomain', source: 'https://anime.miruro.tv/watch/honeystream-test' },
    { id: 'miruro-root', source: 'https://miruro.to', title: 'Miruro root page' },
    { id: 'miruro-tv-anime', source: 'https://miruro.tv/anime/honeystream-test' },
    { id: 'miruro-to-watch-time', source: 'https://miruro.to/watch/honeystream-test?t=90' },
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
      id: 'generic-site',
      source: 'https://streaming.example.test/watch/honeystream-night',
      title: 'Generic streaming page',
      durationMs: 5400000
    },
    {
      id: 'generic-show-episode',
      source: 'https://shows.example.test/title/honeystream-night?episode=1',
      title: 'Generic show episode'
    },
    {
      id: 'generic-video-room',
      source: 'https://video.example.test/room/watch-party',
      title: 'Generic video room'
    }
  ]
)

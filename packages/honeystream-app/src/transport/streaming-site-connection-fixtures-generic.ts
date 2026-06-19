import type { StreamingSiteConnectionFixture } from './streaming-site-connection-lab'

export const STREAMING_SITE_GENERIC_FIXTURES: readonly StreamingSiteConnectionFixture[] = Object.freeze(
  [
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
    },
    {
      id: 'generic-video-quality',
      source: 'https://video.example.test/watch/honeystream-night?quality=auto',
      title: 'Generic video quality page'
    },
    {
      id: 'generic-cinema-room',
      source: 'https://cinema.example.test/movie/honeystream-night?room=two',
      title: 'Generic cinema room'
    },
    {
      id: 'generic-vimeo-watch',
      source: 'https://vimeo.com/123456789',
      title: 'Vimeo generic watch page'
    },
    {
      id: 'generic-twitch-channel',
      source: 'https://www.twitch.tv/honeystreamsync',
      title: 'Twitch generic channel page'
    },
    {
      id: 'generic-netflix-title',
      source: 'https://www.netflix.com/title/80057281',
      title: 'Netflix generic title page'
    },
    {
      id: 'generic-disneyplus-movie',
      source: 'https://www.disneyplus.com/movies/honeystream-test/abc123',
      title: 'Disney+ generic movie page'
    },
    {
      id: 'generic-crunchyroll-watch',
      source: 'https://www.crunchyroll.com/watch/honeystream-test',
      title: 'Crunchyroll generic watch page'
    }
  ]
)

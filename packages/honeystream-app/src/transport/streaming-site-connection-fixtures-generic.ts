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
    }
  ]
)

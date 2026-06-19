import type { StreamingSiteConnectionFixture } from './streaming-site-connection-lab'

export const STREAMING_SITE_YOUTUBE_FIXTURES: readonly StreamingSiteConnectionFixture[] = Object.freeze(
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
      id: 'youtube-root',
      source: 'https://youtube.com',
      title: 'YouTube root page'
    },
    {
      id: 'youtube-timestamp',
      source: 'https://www.youtube.com/watch?v=sync&t=42s'
    },
    {
      id: 'youtube-tv',
      source: 'https://tv.youtube.com/watch/honeystream-sync'
    },
    {
      id: 'youtube-watch-list',
      source: 'https://youtube.com/watch?v=sync&list=PLhoneystream'
    },
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
      id: 'youtube-mobile-watch-share',
      source: 'https://m.youtube.com/watch?v=honeystream-sync&feature=youtu.be',
      title: 'YouTube mobile watch share'
    },
    {
      id: 'youtube-channel-param',
      source: 'https://www.youtube.com/watch?v=sync&ab_channel=honeystream',
      title: 'YouTube channel parameter watch'
    }
  ]
)

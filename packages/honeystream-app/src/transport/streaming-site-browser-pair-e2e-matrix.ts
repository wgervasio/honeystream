export type StreamingSiteBrowserPairE2ELane =
  | 'youtube'
  | 'animepahe'
  | 'cineby'
  | 'miruro'
  | 'generic'

export interface StreamingSiteBrowserPairE2ESource {
  readonly expectedText: string
  readonly exerciseControls: boolean
  readonly lane: StreamingSiteBrowserPairE2ELane
  readonly title: string
  readonly url: string
}

const genericSource = (
  url: string,
  title: string,
  exerciseControls = false
): StreamingSiteBrowserPairE2ESource => ({
  expectedText: title,
  exerciseControls,
  lane: 'generic',
  title,
  url
})

export const STREAMING_SITE_BROWSER_PAIR_E2E_LANES: readonly StreamingSiteBrowserPairE2ELane[] = Object.freeze(
  ['youtube', 'animepahe', 'cineby', 'miruro', 'generic']
)

export const STREAMING_SITE_BROWSER_PAIR_E2E_SOURCES: readonly StreamingSiteBrowserPairE2ESource[] = Object.freeze(
  [
    {
      lane: 'youtube',
      url: 'youtube.com/watch?v=two-browser-youtube',
      title: 'YouTube watch page',
      expectedText: 'YouTube watch page',
      exerciseControls: true
    },
    {
      lane: 'youtube',
      url: 'youtu.be/two-browser-youtube-short?t=42',
      title: 'YouTube watch page',
      expectedText: 'YouTube watch page',
      exerciseControls: false
    },
    {
      lane: 'youtube',
      url: 'youtube.com',
      title: 'YouTube watch page',
      expectedText: 'YouTube watch page',
      exerciseControls: false
    },
    {
      lane: 'youtube',
      url: 'www.youtube.com/playlist?list=two-browser-sync-list',
      title: 'YouTube watch page',
      expectedText: 'YouTube watch page',
      exerciseControls: false
    },
    {
      lane: 'youtube',
      url: 'm.youtube.com/watch?v=two-browser-youtube-mobile&feature=share',
      title: 'YouTube watch page',
      expectedText: 'YouTube watch page',
      exerciseControls: false
    },
    {
      lane: 'youtube',
      url: 'music.youtube.com/watch?v=two-browser-youtube-music',
      title: 'YouTube watch page',
      expectedText: 'YouTube watch page',
      exerciseControls: false
    },
    {
      lane: 'youtube',
      url: 'www.youtube-nocookie.com/embed/two-browser-youtube-nocookie',
      title: 'YouTube watch page',
      expectedText: 'YouTube watch page',
      exerciseControls: false
    },
    {
      lane: 'youtube',
      url: 'www.youtube.com/shorts/two-browser-youtube-short',
      title: 'YouTube watch page',
      expectedText: 'YouTube watch page',
      exerciseControls: false
    },
    {
      lane: 'youtube',
      url: 'www.youtube.com/live/two-browser-youtube-live?feature=share',
      title: 'YouTube watch page',
      expectedText: 'YouTube watch page',
      exerciseControls: false
    },
    {
      lane: 'animepahe',
      url: 'animepahe.ru/play/two-browser-animepahe',
      title: 'AnimePahe watch page',
      expectedText: 'AnimePahe watch page',
      exerciseControls: true
    },
    {
      lane: 'animepahe',
      url: 'animepahe.si/watch/two-browser-animepahe?episode=2',
      title: 'AnimePahe watch page',
      expectedText: 'AnimePahe watch page',
      exerciseControls: false
    },
    {
      lane: 'animepahe',
      url: 'animepahe.ru',
      title: 'AnimePahe watch page',
      expectedText: 'AnimePahe watch page',
      exerciseControls: false
    },
    {
      lane: 'animepahe',
      url: 'animepahe.com/play/two-browser-animepahe?episode=3',
      title: 'AnimePahe watch page',
      expectedText: 'AnimePahe watch page',
      exerciseControls: false
    },
    {
      lane: 'animepahe',
      url: 'www.animepahe.com/watch/two-browser-animepahe?episode=4',
      title: 'AnimePahe watch page',
      expectedText: 'AnimePahe watch page',
      exerciseControls: false
    },
    {
      lane: 'cineby',
      url: 'cineby.app/movie/two-browser-cineby',
      title: 'Cineby watch page',
      expectedText: 'Cineby watch page',
      exerciseControls: true
    },
    {
      lane: 'cineby',
      url: 'watch.cineby.to/tv/two-browser-cineby/season/1/episode/1',
      title: 'Cineby watch page',
      expectedText: 'Cineby watch page',
      exerciseControls: false
    },
    {
      lane: 'cineby',
      url: 'cineby.app',
      title: 'Cineby watch page',
      expectedText: 'Cineby watch page',
      exerciseControls: false
    },
    {
      lane: 'cineby',
      url: 'cdn.cineby.app/movie/two-browser-cineby?server=beta',
      title: 'Cineby watch page',
      expectedText: 'Cineby watch page',
      exerciseControls: false
    },
    {
      lane: 'cineby',
      url: 'www.cineby.to/movie/two-browser-cineby?quality=auto',
      title: 'Cineby watch page',
      expectedText: 'Cineby watch page',
      exerciseControls: false
    },
    {
      lane: 'miruro',
      url: 'miruro.to/watch/two-browser-miruro',
      title: 'Miruro watch page',
      expectedText: 'Miruro watch page',
      exerciseControls: true
    },
    {
      lane: 'miruro',
      url: 'www.miruro.tv/watch/two-browser-miruro?episode=3',
      title: 'Miruro watch page',
      expectedText: 'Miruro watch page',
      exerciseControls: false
    },
    {
      lane: 'miruro',
      url: 'miruro.to',
      title: 'Miruro watch page',
      expectedText: 'Miruro watch page',
      exerciseControls: false
    },
    {
      lane: 'miruro',
      url: 'beta.miruro.tv/watch/two-browser-miruro?episode=4',
      title: 'Miruro watch page',
      expectedText: 'Miruro watch page',
      exerciseControls: false
    },
    {
      lane: 'miruro',
      url: 'anime.miruro.tv/watch/two-browser-miruro?episode=5',
      title: 'Miruro watch page',
      expectedText: 'Miruro watch page',
      exerciseControls: false
    },
    genericSource(
      'streaming.example.test/watch/two-browser-generic',
      'streaming.example.test page',
      true
    ),
    genericSource(
      'shows.example.test/title/two-browser-generic?episode=1',
      'shows.example.test page'
    ),
    genericSource('video.example.test/room/two-browser-generic', 'video.example.test page'),
    genericSource('watch.example.test', 'watch.example.test page'),
    genericSource(
      'cinema.example.test/movie/two-browser-generic?room=cozy',
      'cinema.example.test page'
    ),
    genericSource('vimeo.com/123456789', 'vimeo.com page'),
    genericSource('www.twitch.tv/honeystreamsync', 'www.twitch.tv page'),
    genericSource('www.netflix.com/title/80057281', 'www.netflix.com page'),
    genericSource('www.hulu.com/watch/two-browser-generic', 'www.hulu.com page'),
    genericSource(
      'www.primevideo.com/detail/two-browser-generic/0ABC123',
      'www.primevideo.com page'
    ),
    genericSource('tubitv.com/movies/two-browser-generic', 'tubitv.com page'),
    genericSource('www.dailymotion.com/video/xtwo-browser-generic', 'www.dailymotion.com page'),
    genericSource(
      'www.tiktok.com/@honeystream/video/two-browser-generic',
      'www.tiktok.com page'
    ),
    genericSource('www.instagram.com/reel/two-browser-generic', 'www.instagram.com page'),
    genericSource('watch.plex.tv/movie/two-browser-generic', 'watch.plex.tv page'),
    genericSource('www.disneyplus.com/movies/honeystream-test/abc123', 'www.disneyplus.com page'),
    genericSource('www.crunchyroll.com/watch/honeystream-test', 'www.crunchyroll.com page'),
    genericSource(
      'tv.apple.com/us/movie/honeystream-test/umc.cmc.honeystream',
      'tv.apple.com page'
    ),
    genericSource('www.peacocktv.com/watch/playback/honeystream-test', 'www.peacocktv.com page'),
    genericSource('www.max.com/watch/movie/honeystream-test', 'www.max.com page'),
    genericSource(
      'www.paramountplus.com/movies/video/honeystream-test',
      'www.paramountplus.com page'
    ),
    genericSource('therokuchannel.roku.com/watch/honeystream-test', 'therokuchannel.roku.com page'),
    genericSource('www.kanopy.com/en/product/honeystream-test', 'www.kanopy.com page')
  ]
)

export const STREAMING_SITE_BROWSER_PAIR_E2E_LANE_COUNT =
  STREAMING_SITE_BROWSER_PAIR_E2E_LANES.length
export const STREAMING_SITE_BROWSER_PAIR_E2E_PATH_COUNT =
  STREAMING_SITE_BROWSER_PAIR_E2E_SOURCES.length

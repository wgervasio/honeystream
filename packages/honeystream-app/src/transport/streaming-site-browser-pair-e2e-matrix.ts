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
      lane: 'generic',
      url: 'streaming.example.test/watch/two-browser-generic',
      title: 'streaming.example.test page',
      expectedText: 'streaming.example.test page',
      exerciseControls: true
    },
    {
      lane: 'generic',
      url: 'shows.example.test/title/two-browser-generic?episode=1',
      title: 'shows.example.test page',
      expectedText: 'shows.example.test page',
      exerciseControls: false
    },
    {
      lane: 'generic',
      url: 'video.example.test/room/two-browser-generic',
      title: 'video.example.test page',
      expectedText: 'video.example.test page',
      exerciseControls: false
    },
    {
      lane: 'generic',
      url: 'watch.example.test',
      title: 'watch.example.test page',
      expectedText: 'watch.example.test page',
      exerciseControls: false
    }
  ]
)

export const STREAMING_SITE_BROWSER_PAIR_E2E_LANE_COUNT =
  STREAMING_SITE_BROWSER_PAIR_E2E_LANES.length
export const STREAMING_SITE_BROWSER_PAIR_E2E_PATH_COUNT =
  STREAMING_SITE_BROWSER_PAIR_E2E_SOURCES.length

import { StreamingSiteConnectionFixture } from './streaming-site-connection-lab'

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
      id: 'generic-hulu-watch',
      source: 'https://www.hulu.com/watch/honeystream-test',
      title: 'Hulu generic watch page'
    },
    {
      id: 'generic-primevideo-detail',
      source: 'https://www.primevideo.com/detail/honeystream-test/0ABC123',
      title: 'Prime Video generic detail page'
    },
    {
      id: 'generic-tubi-movie',
      source: 'https://tubitv.com/movies/honeystream-test',
      title: 'Tubi generic movie page',
      durationMs: 6300000
    },
    {
      id: 'generic-dailymotion-video',
      source: 'https://www.dailymotion.com/video/xhoneystream',
      title: 'Dailymotion generic video page'
    },
    {
      id: 'generic-plex-watch',
      source: 'https://watch.plex.tv/movie/honeystream-test',
      title: 'Plex generic watch page'
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
    },
    {
      id: 'generic-apple-tv-watch',
      source: 'https://tv.apple.com/us/movie/honeystream-test/umc.cmc.honeystream',
      title: 'Apple TV+ generic movie page'
    },
    {
      id: 'generic-peacock-watch',
      source: 'https://www.peacocktv.com/watch/playback/honeystream-test',
      title: 'Peacock generic watch page'
    },
    {
      id: 'generic-max-title',
      source: 'https://www.max.com/watch/movie/honeystream-test',
      title: 'Max generic movie page'
    },
    {
      id: 'generic-paramountplus-video',
      source: 'https://www.paramountplus.com/movies/video/honeystream-test',
      title: 'Paramount+ generic movie page'
    },
    {
      id: 'generic-roku-channel-watch',
      source: 'https://therokuchannel.roku.com/watch/honeystream-test',
      title: 'Roku Channel generic watch page'
    },
    {
      id: 'generic-kanopy-product',
      source: 'https://www.kanopy.com/en/product/honeystream-test',
      title: 'Kanopy generic product page'
    },
    {
      id: 'generic-bilibili-video',
      source: 'https://www.bilibili.tv/en/video/honeystream-test',
      title: 'Bilibili generic video page'
    },
    {
      id: 'generic-rumble-watch',
      source: 'https://rumble.com/vhoneystream-test.html',
      title: 'Rumble generic watch page'
    },
    {
      id: 'generic-soundcloud-track',
      source: 'https://soundcloud.com/honeystream/night-drive',
      title: 'SoundCloud generic track page'
    },
    {
      id: 'generic-facebook-watch',
      source: 'https://www.facebook.com/watch/?v=honeystream-test',
      title: 'Facebook Watch generic page'
    }
  ]
)

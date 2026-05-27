import { classifyMediaUrl } from './url-classifier'

describe('runtime/protocol URL classifier', () => {
  it('classifies local files, direct media URLs, and browser website pages', () => {
    expect(classifyMediaUrl('honeystream-local://clip-1')).toBe('localFile')
    expect(classifyMediaUrl('https://cdn.example.com/video.MP4?token=abc')).toBe('url')
    expect(classifyMediaUrl('https://stream.example.com/live/playlist.m3u8')).toBe('url')
    expect(classifyMediaUrl('not-a-url')).toBe('url')
    expect(classifyMediaUrl('ftp://example.com/video.mp4')).toBe('url')

    const websitePages = [
      'https://www.youtube.com/watch?v=abc123',
      'https://youtu.be/abc123',
      'https://m.youtube.com/shorts/abc123',
      'https://www.youtube.com/shorts/abc123',
      'https://youtube.com/watch?v=abc123&list=watch-party',
      'https://animepahe.ru/play/example',
      'https://animepahe.si/anime/example',
      'https://animepahe.com/watch/example',
      'https://cineby.app/movie/example',
      'https://www.cineby.ru/tv/example',
      'https://www.miruro.tv/watch/example',
      'https://miruro.to/watch/example',
      'https://miruro.tv/watch/example?episode=1'
    ]

    for (const url of websitePages) {
      expect(classifyMediaUrl(url)).toBe('website')
    }
  })
})

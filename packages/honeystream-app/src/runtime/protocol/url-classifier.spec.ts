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
      'https://animepahe.ru/play/example',
      'https://animepahe.si/anime/example',
      'https://cineby.app/movie/example',
      'https://www.cineby.ru/tv/example',
      'https://www.miruro.tv/watch/example',
      'https://miruro.to/watch/example'
    ]

    for (const url of websitePages) {
      expect(classifyMediaUrl(url)).toBe('website')
    }
  })
})

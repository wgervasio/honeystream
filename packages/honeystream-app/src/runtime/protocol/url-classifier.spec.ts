import { classifyMediaUrl } from './url-classifier'

describe('runtime/protocol URL classifier', () => {
  it('classifies local files, direct media URLs, and browser website pages', () => {
    expect(classifyMediaUrl('honeystream-local://clip-1')).toBe('localFile')
    expect(classifyMediaUrl('https://cdn.example.com/video.MP4?token=abc')).toBe('url')
    expect(classifyMediaUrl('https://stream.example.com/live/playlist.m3u8')).toBe('url')
    expect(classifyMediaUrl('not-a-url')).toBe('url')
    expect(classifyMediaUrl('ftp://example.com/video.mp4')).toBe('url')

    expect(classifyMediaUrl('https://www.youtube.com/watch?v=abc123')).toBe('website')
    expect(classifyMediaUrl('https://animepahe.ru/play/example')).toBe('website')
    expect(classifyMediaUrl('https://cineby.app/movie/example')).toBe('website')
    expect(classifyMediaUrl('https://www.miruro.tv/watch/example')).toBe('website')
  })
})

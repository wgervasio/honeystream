import { classifyMediaProvider, classifyMediaUrl } from './url-classifier'

describe('protocol URL classifier', () => {
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
      'https://watch.cineby.app/movie/example',
      'https://www.cineby.ru/tv/example',
      'https://www.miruro.tv/watch/example',
      'https://miruro.to/watch/example',
      'https://miruro.tv/watch/example?episode=1',
      'https://streaming.example.test/watch/honeystream-night',
      'https://shows.example.test/title/honeystream-night?episode=1',
      'https://video.example.test/room/watch-party',
      'https://www.youtube.com/watch/demo.mp4',
      'https://animepahe.ru/play/demo.m3u8',
      'https://cineby.app/movie/demo.webm',
      'https://miruro.to/watch/demo.mp4'
    ]

    for (const url of websitePages) {
      expect(classifyMediaUrl(url)).toBe('website')
    }
  })

  it('identifies supported streaming providers without trusting unrelated hosts', () => {
    expect(classifyMediaProvider('https://www.youtube.com/watch?v=abc123')).toBe('youtube')
    expect(classifyMediaProvider('https://youtu.be/abc123')).toBe('youtube')
    expect(classifyMediaProvider('https://www.youtube-nocookie.com/embed/abc123')).toBe('youtube')
    expect(classifyMediaProvider('https://animepahe.si/anime/example')).toBe('animepahe')
    expect(classifyMediaProvider('https://animepahe.com/watch/example')).toBe('animepahe')
    expect(classifyMediaProvider('https://video.cineby.app/movie/example')).toBe('cineby')
    expect(classifyMediaProvider('https://www.cineby.ru/tv/example')).toBe('cineby')
    expect(classifyMediaProvider('https://miruro.tv/watch/example')).toBe('miruro')
    expect(classifyMediaProvider('https://miruro.to/watch/example')).toBe('miruro')
    expect(classifyMediaProvider('https://youtube.com.evil/watch?v=abc123')).toBe('unknown')
    expect(classifyMediaProvider('https://animepahe.evil/play/example')).toBe('unknown')
    expect(classifyMediaProvider('https://animepahe.example.com/play/example')).toBe('unknown')
    expect(classifyMediaProvider('https://cineby.example/movie/example')).toBe('unknown')
    expect(classifyMediaProvider('https://miruro.example/watch/example')).toBe('unknown')
    expect(classifyMediaProvider('not-a-url')).toBe('unknown')
  })
})

import { isSafeBrowseHost } from './safeBrowse'

describe('SafeBrowse supported streaming hosts', () => {
  it('permits supported watch-site domains and their tested subdomains', () => {
    const supportedHosts = [
      'www.youtube.com',
      'm.youtube.com',
      'youtube.com:443',
      'www.youtube-nocookie.com',
      'youtu.be',
      'animepahe.com',
      'animepahe.ru',
      'animepahe.si',
      'watch.animepahe.ru',
      'cineby.app',
      'watch.cineby.to',
      'www.cineby.ru',
      'video.cineby.app',
      'miruro.to',
      'miruro.tv',
      'www.miruro.tv'
    ]

    for (const host of supportedHosts) {
      expect(isSafeBrowseHost(host)).toBe(true)
    }
  })

  it('does not trust lookalike domains for supported watch sites', () => {
    const rejectedHosts = [
      'youtube.com.evil',
      'animepahe.evil',
      'animepahe.example.com',
      'cineby.example',
      'cineby.example.com',
      'miruro.example',
      'miruro.example.com'
    ]

    for (const host of rejectedHosts) {
      expect(isSafeBrowseHost(host)).toBe(false)
    }
  })
})

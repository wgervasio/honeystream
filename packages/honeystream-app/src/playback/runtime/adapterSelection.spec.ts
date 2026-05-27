import { DesiredPlaybackMedia } from '../adapters/shared/playbackAdapter'
import { classifyMediaUrl } from 'runtime/protocol/url-classifier'
import { selectPlaybackAdapterKind } from './adapterSelection'

const createMedia = (
  mediaId: string,
  source: DesiredPlaybackMedia['source'],
  url: string
): DesiredPlaybackMedia => ({
  mediaId,
  source,
  url
})

const createClassifiedMedia = (mediaId: string, url: string): DesiredPlaybackMedia => {
  const kind = classifyMediaUrl(url)
  const source: DesiredPlaybackMedia['source'] =
    kind === 'localFile' ? 'local-file' : kind === 'website' ? 'website' : 'direct-media'
  return createMedia(mediaId, source, url)
}

describe('selectPlaybackAdapterKind', () => {
  it('always routes local-file media to the local-file adapter', () => {
    const media = createMedia('local-1', 'local-file', 'honeystream-local://video-key')
    expect(selectPlaybackAdapterKind(media, { forcePopup: true })).toBe('local-file')
  })

  it('routes blocked embed hosts and mixed-content websites to popup', () => {
    expect(
      selectPlaybackAdapterKind(createMedia('blocked', 'website', 'https://blocked.example/watch'), {
        blockedEmbedHosts: new Set<string>(['blocked.example'])
      })
    ).toBe('popup')

    expect(selectPlaybackAdapterKind(createMedia('http', 'website', 'http://example.com/watch'))).toBe(
      'popup'
    )
  })

  it('allows http embeds when mixed-content blocking is disabled', () => {
    expect(
      selectPlaybackAdapterKind(createMedia('http', 'website', 'http://example.com/watch'), {
        blockHttpEmbeds: false
      })
    ).toBe('embed-extension')
  })

  it('routes embeddable media to embed-extension by default, including non-URL strings', () => {
    expect(selectPlaybackAdapterKind(createMedia('embed-1', 'website', 'https://example.com/watch'))).toBe(
      'embed-extension'
    )
    expect(selectPlaybackAdapterKind(createMedia('embed-2', 'direct-media', 'not-a-valid-url'))).toBe(
      'embed-extension'
    )
  })

  it('routes classified website pages through the embed adapter when HTTPS is allowed', () => {
    const urls = [
      'https://www.youtube.com/watch?v=abc123',
      'https://animepahe.ru/play/example',
      'https://cineby.app/movie/example',
      'https://www.miruro.tv/watch/example'
    ]

    for (let index = 0; index < urls.length; index += 1) {
      expect(selectPlaybackAdapterKind(createClassifiedMedia(`site-${index}`, urls[index]))).toBe(
        'embed-extension'
      )
    }
  })

  it('keeps direct media URLs classified separately while selecting the embed adapter', () => {
    const media = createClassifiedMedia('direct-mp4', 'https://cdn.example.com/video.mp4')

    expect(media.source).toBe('direct-media')
    expect(selectPlaybackAdapterKind(media)).toBe('embed-extension')
  })

  it('falls back to popup for classified websites on blocked hosts', () => {
    expect(
      selectPlaybackAdapterKind(createClassifiedMedia('blocked-site', 'https://cineby.app/movie/example'), {
        blockedEmbedHosts: new Set<string>(['cineby.app'])
      })
    ).toBe('popup')
  })

  it('forces popup selection for non-local media when forcePopup is enabled', () => {
    expect(
      selectPlaybackAdapterKind(createMedia('site-1', 'website', 'https://example.com/watch'), {
        forcePopup: true
      })
    ).toBe('popup')
  })
})

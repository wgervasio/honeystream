import { DesiredPlaybackMedia } from '../adapters/shared/playbackAdapter'
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

  it('forces popup selection for non-local media when forcePopup is enabled', () => {
    expect(
      selectPlaybackAdapterKind(createMedia('site-1', 'website', 'https://example.com/watch'), {
        forcePopup: true
      })
    ).toBe('popup')
  })
})

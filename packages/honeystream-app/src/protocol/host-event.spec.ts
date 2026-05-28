import { parseHostEvent } from './parsers'

const media = {
  mediaId: 'media-1',
  kind: 'url' as const,
  source: 'https://example.com/video',
  title: 'Example Video',
  durationMs: 120000
}

describe('protocol host event parsers', () => {
  it('accepts compact current-media events with metadata for guest projection updates', () => {
    const result = parseHostEvent({
      type: 'currentMediaChanged',
      mediaId: media.mediaId,
      media
    })

    expect(result.ok).toBeTruthy()
    if (result.ok) {
      expect(result.value).toEqual({
        type: 'currentMediaChanged',
        mediaId: media.mediaId,
        media
      })
    }
  })

  it('rejects compact current-media events whose metadata id does not match mediaId', () => {
    const result = parseHostEvent({
      type: 'currentMediaChanged',
      mediaId: media.mediaId,
      media: {
        ...media,
        mediaId: 'other-media'
      }
    })

    expect(result.ok).toBeFalsy()
    if (!result.ok) expect(result.error.path).toBe('event.media.mediaId')
  })
})

import {
  createRuntimeAddMediaConfidenceItems,
  createRuntimeAddMediaSourcePreview
} from './RuntimeAddMediaSourcePreview'

describe('RuntimeAddMediaSourcePreview', () => {
  it('marks supported streaming providers as covered by low-latency mock tests', () => {
    const providerCases = [
      {
        provider: 'youtube',
        label: 'YouTube',
        url: 'https://www.youtube.com/watch?v=honeystream-test'
      },
      {
        provider: 'animepahe',
        label: 'AnimePahe',
        url: 'https://animepahe.ru/play/honeystream-test'
      },
      {
        provider: 'cineby',
        label: 'Cineby',
        url: 'https://cineby.app/movie/honeystream-test'
      },
      {
        provider: 'miruro',
        label: 'Miruro',
        url: 'https://www.miruro.tv/watch/honeystream-test'
      }
    ] as const

    for (const providerCase of providerCases) {
      const preview = createRuntimeAddMediaSourcePreview(providerCase.url)
      expect(preview).toEqual(
        expect.objectContaining({
          kind: 'website',
          provider: providerCase.provider,
          label: `${providerCase.label} lane`
        })
      )

      const confidenceDetails = createRuntimeAddMediaConfidenceItems(preview).map(
        item => item.detail
      )
      expect(confidenceDetails).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            `${providerCase.label} is covered by the low-latency streaming-site mock tests`
          ),
          expect.stringContaining('not the video bytes'),
          expect.stringContaining('mock round trip budgeted under 10ms'),
          expect.stringContaining('visible recovered retries'),
          expect.stringContaining('no skipped controls'),
          expect.stringContaining('peak queues'),
          expect.stringContaining('max control-frame size')
        ])
      )
    }
  })

  it('previews exact provider root domains without requiring a deep watch path', () => {
    const rootDomainCases = [
      { provider: 'youtube', label: 'YouTube', url: 'youtube.com' },
      { provider: 'animepahe', label: 'AnimePahe', url: 'animepahe.ru' },
      { provider: 'cineby', label: 'Cineby', url: 'cineby.app' },
      { provider: 'miruro', label: 'Miruro', url: 'miruro.to' }
    ] as const

    for (const providerCase of rootDomainCases) {
      const preview = createRuntimeAddMediaSourcePreview(providerCase.url)

      expect(preview).toEqual(
        expect.objectContaining({
          kind: 'website',
          normalizedFromShorthand: true,
          provider: providerCase.provider,
          label: `${providerCase.label} lane`
        })
      )
      expect(preview && preview.detail).toContain(`${providerCase.label} page detected`)
      expect(preview && preview.detail).toContain('Honeystream will add https:// automatically')
    }
  })

  it('keeps unknown websites honest without claiming provider coverage', () => {
    const preview = createRuntimeAddMediaSourcePreview('https://youtube.com.evil/watch')
    const confidenceDetails = createRuntimeAddMediaConfidenceItems(preview).map(item => item.detail)

    expect(preview).toEqual(
      expect.objectContaining({
        kind: 'website',
        provider: 'unknown',
        label: 'Website lane'
      })
    )
    expect(confidenceDetails.join(' ')).toContain('test the exact page before movie time')
    expect(confidenceDetails.join(' ')).not.toContain('YouTube is covered')
  })
})

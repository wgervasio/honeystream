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
          expect.stringContaining('mock round trip budgeted under 32ms')
        ])
      )
    }
  })

  it('keeps unknown websites honest without claiming provider coverage', () => {
    const preview = createRuntimeAddMediaSourcePreview('https://youtube.com.evil/watch')
    const confidenceDetails = createRuntimeAddMediaConfidenceItems(preview).map(
      item => item.detail
    )

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

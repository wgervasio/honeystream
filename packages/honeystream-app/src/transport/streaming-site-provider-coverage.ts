import { MediaProvider } from 'protocol'

export interface StreamingSiteProviderCoverage {
  readonly provider: MediaProvider
  readonly siteCount: number
}

const PROVIDER_ORDER: readonly MediaProvider[] = Object.freeze([
  'youtube',
  'animepahe',
  'cineby',
  'miruro',
  'unknown'
])

const createEmptyProviderCounts = (): Record<MediaProvider, number> => ({
  youtube: 0,
  animepahe: 0,
  cineby: 0,
  miruro: 0,
  unknown: 0
})

export const countStreamingSiteProviders = (
  providers: readonly MediaProvider[]
): readonly StreamingSiteProviderCoverage[] => {
  const counts = createEmptyProviderCounts()
  for (const provider of providers) {
    counts[provider] += 1
  }

  return PROVIDER_ORDER.map(provider => ({
    provider,
    siteCount: counts[provider]
  })).filter(coverage => coverage.siteCount > 0)
}

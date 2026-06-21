import {
  STREAMING_SITE_BROWSER_PAIR_E2E_LANES,
  STREAMING_SITE_BROWSER_PAIR_E2E_SOURCES,
  StreamingSiteBrowserPairE2ESource
} from './streaming-site-browser-pair-e2e-matrix'
import {
  STREAMING_SITE_CONNECTION_BUDGET,
  STREAMING_SITE_CONNECTION_FASTEST_ROUND_TRIP_MS,
  STREAMING_SITE_CONNECTION_P95_ROUND_TRIP_BUDGET_MS,
  STREAMING_SITE_CONNECTION_PROFILES,
  STREAMING_SITE_CONNECTION_RANDOM_SAMPLES,
  STREAMING_SITE_CONNECTION_TRIAL_COUNT
} from './streaming-site-connection-defaults'
import { summarizeStreamingSiteConnectionMergeGate } from './streaming-site-connection-merge-gate'
import { StreamingSiteConnectionFixture } from './streaming-site-connection-lab'
import { optimizeStreamingSiteConnectionProfiles } from './streaming-site-connection-optimizer'
import { summarizeStreamingSiteProviderQualityGate } from './streaming-site-provider-quality-gate'

const normalizeSourceUrl = (source: string): string =>
  /^https?:\/\//.test(source) ? source : `https://${source}`

const browserPairFixtures: readonly StreamingSiteConnectionFixture[] = STREAMING_SITE_BROWSER_PAIR_E2E_SOURCES.map(
  (source, index) => ({
    id: `browser-pair-${source.lane}-${index}`,
    source: normalizeSourceUrl(source.url),
    title: source.title
  })
)

const findControlBurstSource = (lane: string): StreamingSiteBrowserPairE2ESource => {
  const source = STREAMING_SITE_BROWSER_PAIR_E2E_SOURCES.find(
    item => item.lane === lane && item.exerciseControls
  )
  if (!source) throw new Error(`Missing browser-pair control burst source for "${lane}".`)
  return source
}

describe('streaming site browser-pair reliability gate', () => {
  it('keeps the two-browser e2e URL matrix lossless and under latency budget', async () => {
    const result = await optimizeStreamingSiteConnectionProfiles({
      budget: STREAMING_SITE_CONNECTION_BUDGET,
      fixtures: browserPairFixtures,
      profiles: STREAMING_SITE_CONNECTION_PROFILES,
      nowStartMs: 24000,
      randomSamples: STREAMING_SITE_CONNECTION_RANDOM_SAMPLES,
      trialCount: STREAMING_SITE_CONNECTION_TRIAL_COUNT
    })
    const bestProfile = result.bestProfile
    if (!bestProfile) throw new Error('Expected a selected browser-pair streaming profile.')

    const mergeGate = summarizeStreamingSiteConnectionMergeGate(result)
    const providerGate = summarizeStreamingSiteProviderQualityGate(result)

    expect(result.trialCount).toBe(STREAMING_SITE_CONNECTION_TRIAL_COUNT)
    expect(bestProfile.profile.id).toBe('clean-ultra-low-latency')
    expect(bestProfile.siteCount).toBe(STREAMING_SITE_BROWSER_PAIR_E2E_SOURCES.length)
    expect(bestProfile.providerCoverage).toEqual(
      expect.arrayContaining([
        { provider: 'youtube', siteCount: 7 },
        { provider: 'animepahe', siteCount: 5 },
        { provider: 'cineby', siteCount: 5 },
        { provider: 'miruro', siteCount: 5 },
        { provider: 'unknown', siteCount: 21 }
      ])
    )
    expect(bestProfile.maxCombinedByteLossRate).toBe(0)
    expect(bestProfile.maxCombinedDroppedMessages).toBe(0)
    expect(bestProfile.maxCombinedRetransmissionByteRate).toBe(0)
    expect(bestProfile.maxDirectionalLatencySkewMs).toBe(0)
    expect(bestProfile.maxFixtureByteLossRate).toBe(0)
    expect(bestProfile.maxFixtureDroppedMessages).toBe(0)
    expect(bestProfile.maxFixtureLostBytes).toBe(0)
    expect(bestProfile.maxFixtureMissingDirectionalDeliveryCount).toBe(0)
    expect(bestProfile.maxEstimatedRoundTripP95LatencyMs).toBeLessThanOrEqual(
      STREAMING_SITE_CONNECTION_P95_ROUND_TRIP_BUDGET_MS
    )
    expect(bestProfile.maxEstimatedRoundTripP95LatencyMs).toBeLessThanOrEqual(
      STREAMING_SITE_CONNECTION_FASTEST_ROUND_TRIP_MS
    )
    expect(bestProfile.maxCombinedPeakQueuedBytes).toBeLessThanOrEqual(
      STREAMING_SITE_CONNECTION_BUDGET.maxCombinedPeakQueuedBytes
    )
    expect(mergeGate).toEqual(
      expect.objectContaining({
        ok: true,
        selectedProfileId: 'clean-ultra-low-latency',
        siteCount: STREAMING_SITE_BROWSER_PAIR_E2E_SOURCES.length,
        failures: []
      })
    )
    expect(providerGate).toEqual(
      expect.objectContaining({
        ok: true,
        maxProviderLostBytes: 0,
        selectedProfileId: 'clean-ultra-low-latency',
        failures: []
      })
    )
  })

  it('keeps one full playback-control burst source in every two-browser site lane', () => {
    const burstSources = STREAMING_SITE_BROWSER_PAIR_E2E_LANES.map(findControlBurstSource)

    expect(burstSources.map(source => source.lane)).toEqual(STREAMING_SITE_BROWSER_PAIR_E2E_LANES)
    expect(burstSources.map(source => normalizeSourceUrl(source.url))).toEqual([
      'https://youtube.com/watch?v=two-browser-youtube',
      'https://animepahe.ru/play/two-browser-animepahe',
      'https://cineby.app/movie/two-browser-cineby',
      'https://miruro.to/watch/two-browser-miruro',
      'https://streaming.example.test/watch/two-browser-generic'
    ])
  })
})

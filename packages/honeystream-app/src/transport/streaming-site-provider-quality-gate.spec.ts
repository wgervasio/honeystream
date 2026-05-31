import {
  STREAMING_SITE_CONNECTION_BUDGET,
  STREAMING_SITE_CONNECTION_FASTEST_ROUND_TRIP_MS,
  STREAMING_SITE_CONNECTION_FIXTURES,
  STREAMING_SITE_CONNECTION_PROFILES,
  STREAMING_SITE_CONNECTION_RANDOM_SAMPLES,
  STREAMING_SITE_CONNECTION_TRIAL_COUNT
} from './streaming-site-connection-defaults'
import { optimizeStreamingSiteConnectionProfiles } from './streaming-site-connection-optimizer'
import { summarizeStreamingSiteProviderQualityGate } from './streaming-site-provider-quality-gate'

describe('streaming site provider quality gate', () => {
  it('keeps default named providers lossless under the selected low-latency lane', async () => {
    const result = await optimizeStreamingSiteConnectionProfiles({
      budget: STREAMING_SITE_CONNECTION_BUDGET,
      fixtures: STREAMING_SITE_CONNECTION_FIXTURES,
      profiles: STREAMING_SITE_CONNECTION_PROFILES,
      nowStartMs: 2000,
      randomSamples: STREAMING_SITE_CONNECTION_RANDOM_SAMPLES,
      trialCount: STREAMING_SITE_CONNECTION_TRIAL_COUNT
    })

    const providerGate = summarizeStreamingSiteProviderQualityGate(result)

    expect(providerGate).toEqual(
      expect.objectContaining({
        ok: true,
        selectedProfileId: 'clean-ultra-low-latency',
        maxProviderByteLossRate: 0,
        maxProviderDirectionalLatencySkewMs: 0,
        maxProviderDroppedMessages: 0,
        maxProviderLostBytes: 0,
        maxProviderMissingDirectionalDeliveryCount: 0,
        maxProviderOutOfOrderMessages: 0,
        maxProviderRetransmissionByteRate: 0,
        maxProviderRetransmissionRate: 0,
        maxProviderSequenceGapMessages: 0,
        maxProviderRoundTripP95LatencyMs: STREAMING_SITE_CONNECTION_FASTEST_ROUND_TRIP_MS,
        missingProviders: [],
        failures: []
      })
    )
    expect(providerGate.providerQuality).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ provider: 'youtube', siteCount: 16 }),
        expect.objectContaining({ provider: 'animepahe', siteCount: 13 }),
        expect.objectContaining({ provider: 'cineby', siteCount: 14 }),
        expect.objectContaining({ provider: 'miruro', siteCount: 12 })
      ])
    )
  })

  it('fails when a passing lane hides provider-specific retry overhead', async () => {
    const result = await optimizeStreamingSiteConnectionProfiles({
      budget: STREAMING_SITE_CONNECTION_BUDGET,
      fixtures: STREAMING_SITE_CONNECTION_FIXTURES,
      profiles: STREAMING_SITE_CONNECTION_PROFILES.filter(profile => profile.id === 'retry-guarded'),
      nowStartMs: 4000,
      randomSamples: STREAMING_SITE_CONNECTION_RANDOM_SAMPLES,
      trialCount: 1
    })

    const providerGate = summarizeStreamingSiteProviderQualityGate(result, {
      maxProviderRetransmissionByteRate: 0,
      maxProviderRetransmissionRate: 0
    })

    expect(result.bestProfile && result.bestProfile.profile.id).toBe('retry-guarded')
    expect(providerGate.ok).toBe(false)
    expect(providerGate.maxProviderByteLossRate).toBe(0)
    expect(providerGate.maxProviderRetransmissionByteRate).toBeGreaterThan(0)
    expect(providerGate.maxProviderRetransmissionRate).toBeGreaterThan(0)
    expect(providerGate.failures).toEqual(
      expect.arrayContaining([
        'YouTube provider recovered retry bytes exceeded 0.',
        'YouTube provider recovered retry rate exceeded 0.',
        'AnimePahe provider recovered retry bytes exceeded 0.',
        'AnimePahe provider recovered retry rate exceeded 0.',
        'Cineby provider recovered retry bytes exceeded 0.',
        'Cineby provider recovered retry rate exceeded 0.',
        'Miruro provider recovered retry bytes exceeded 0.',
        'Miruro provider recovered retry rate exceeded 0.'
      ])
    )
  })

  it('fails when a passing lane hides provider-specific directional latency skew', async () => {
    const result = await optimizeStreamingSiteConnectionProfiles({
      budget: {
        ...STREAMING_SITE_CONNECTION_BUDGET,
        maxDirectionalAverageLatencyMs: 10,
        maxDirectionalLatencySkewMs: 10,
        maxEstimatedRoundTripMaxLatencyMs: 20,
        maxEstimatedRoundTripP95LatencyMs: 20,
        maxMaxLatencyMs: 10,
        maxP95LatencyMs: 10
      },
      fixtures: STREAMING_SITE_CONNECTION_FIXTURES,
      profiles: [
        {
          id: 'provider-skewed',
          label: 'Provider skewed lane',
          hostNetwork: { latencyMs: 1, maxQueuedFrames: 128 },
          guestNetwork: { latencyMs: 8, maxQueuedFrames: 128 }
        }
      ],
      nowStartMs: 8000,
      randomSamples: STREAMING_SITE_CONNECTION_RANDOM_SAMPLES,
      trialCount: 1
    })

    const providerGate = summarizeStreamingSiteProviderQualityGate(result, {
      maxProviderDirectionalLatencySkewMs: 2
    })

    expect(result.bestProfile && result.bestProfile.profile.id).toBe('provider-skewed')
    expect(providerGate.ok).toBe(false)
    expect(providerGate.maxProviderDirectionalLatencySkewMs).toBe(7)
    expect(providerGate.failures).toEqual(
      expect.arrayContaining([
        'YouTube provider directional latency skew exceeded 2ms.',
        'AnimePahe provider directional latency skew exceeded 2ms.',
        'Cineby provider directional latency skew exceeded 2ms.',
        'Miruro provider directional latency skew exceeded 2ms.'
      ])
    )
  })
})

import {
  STREAMING_SITE_CONNECTION_BUDGET,
  STREAMING_SITE_CONNECTION_FIXTURES,
  STREAMING_SITE_CONNECTION_RANDOM_SAMPLES
} from './streaming-site-connection-defaults'
import { summarizeStreamingSiteConnectionMergeGate } from './streaming-site-connection-merge-gate'
import { optimizeStreamingSiteConnectionProfiles } from './streaming-site-connection-optimizer'

const ASYMMETRIC_PASSING_BUDGET = Object.freeze({
  ...STREAMING_SITE_CONNECTION_BUDGET,
  maxDirectionalAverageLatencyMs: 10,
  maxDirectionalLatencySkewMs: 10,
  maxEstimatedRoundTripMaxLatencyMs: 20,
  maxEstimatedRoundTripP95LatencyMs: 20,
  maxMaxLatencyMs: 10,
  maxP95LatencyMs: 10
})

describe('streaming site directional merge gates', () => {
  it('fails when a selected lane hides directional latency skew behind round-trip averages', async () => {
    const result = await optimizeStreamingSiteConnectionProfiles({
      budget: ASYMMETRIC_PASSING_BUDGET,
      fixtures: STREAMING_SITE_CONNECTION_FIXTURES,
      profiles: [
        {
          id: 'skewed-safe',
          label: 'Skewed safe lane',
          hostNetwork: { latencyMs: 1, maxQueuedFrames: 128 },
          guestNetwork: { latencyMs: 8, maxQueuedFrames: 128 }
        }
      ],
      nowStartMs: 7500,
      randomSamples: STREAMING_SITE_CONNECTION_RANDOM_SAMPLES,
      trialCount: 1
    })
    const mergeGate = summarizeStreamingSiteConnectionMergeGate(result, {
      maxDirectionalLatencySkewMs: 2,
      maxFixtureDirectionalLatencySkewMs: 10,
      maxProviderDirectionalLatencySkewMs: 10
    })

    expect(result.bestProfile && result.bestProfile.profile.id).toBe('skewed-safe')
    expect(mergeGate.ok).toBe(false)
    expect(mergeGate.maxDirectionalLatencySkewMs).toBeGreaterThan(2)
    expect(mergeGate.failures).toEqual(['Directional latency skew exceeded 2ms.'])
  })

  it('fails when a selected lane hides per-site and provider directional latency skew', async () => {
    const result = await optimizeStreamingSiteConnectionProfiles({
      budget: ASYMMETRIC_PASSING_BUDGET,
      fixtures: STREAMING_SITE_CONNECTION_FIXTURES,
      profiles: [
        {
          id: 'fixture-provider-skewed-safe',
          label: 'Fixture provider skewed safe lane',
          hostNetwork: { latencyMs: 1, maxQueuedFrames: 128 },
          guestNetwork: { latencyMs: 8, maxQueuedFrames: 128 }
        }
      ],
      nowStartMs: 7800,
      randomSamples: STREAMING_SITE_CONNECTION_RANDOM_SAMPLES,
      trialCount: 1
    })
    const mergeGate = summarizeStreamingSiteConnectionMergeGate(result, {
      maxDirectionalLatencySkewMs: 10,
      maxFixtureDirectionalLatencySkewMs: 2,
      maxProviderDirectionalLatencySkewMs: 2
    })

    expect(result.bestProfile && result.bestProfile.profile.id).toBe(
      'fixture-provider-skewed-safe'
    )
    expect(mergeGate.ok).toBe(false)
    expect(mergeGate.maxFixtureDirectionalLatencySkewMs).toBe(7)
    expect(mergeGate.maxProviderDirectionalLatencySkewMs).toBe(7)
    expect(mergeGate.failures).toEqual(
      expect.arrayContaining([
        'A site fixture directional latency skew exceeded 2ms.',
        'YouTube provider directional latency skew exceeded 2ms.',
        'AnimePahe provider directional latency skew exceeded 2ms.',
        'Cineby provider directional latency skew exceeded 2ms.',
        'Miruro provider directional latency skew exceeded 2ms.'
      ])
    )
  })
})

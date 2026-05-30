import {
  STREAMING_SITE_CONNECTION_BUDGET,
  STREAMING_SITE_CONNECTION_FASTEST_ROUND_TRIP_MS,
  STREAMING_SITE_CONNECTION_FIXTURES,
  STREAMING_SITE_CONNECTION_P95_ROUND_TRIP_BUDGET_MS,
  STREAMING_SITE_CONNECTION_PROFILES,
  STREAMING_SITE_CONNECTION_RANDOM_SAMPLES,
  STREAMING_SITE_CONNECTION_TRIAL_COUNT
} from './streaming-site-connection-defaults'
import { runStreamingSiteConnectionLab } from './streaming-site-connection-lab'
import { summarizeStreamingSiteConnectionMergeGate } from './streaming-site-connection-merge-gate'
import { optimizeStreamingSiteConnectionProfiles } from './streaming-site-connection-optimizer'

describe('streaming site connection merge gate', () => {
  it('keeps every selected site fixture observation lossless and under latency budget', async () => {
    const result = await runStreamingSiteConnectionLab({
      budget: STREAMING_SITE_CONNECTION_BUDGET,
      fixtures: STREAMING_SITE_CONNECTION_FIXTURES,
      profiles: STREAMING_SITE_CONNECTION_PROFILES,
      nowStartMs: 5000,
      random: () => 0.5
    })
    const observation = result.observations.find(
      item => item.profile.id === 'clean-ultra-low-latency'
    )

    if (!observation) throw new Error('Expected clean-ultra-low-latency observation.')
    expect(observation.fixtureObservations).toHaveLength(STREAMING_SITE_CONNECTION_FIXTURES.length)
    expect(
      observation.fixtureObservations.every(
        fixture =>
          fixture.sentMessages > 0 &&
          fixture.deliveredMessages === fixture.sentMessages &&
          fixture.droppedMessages === 0 &&
          fixture.lostBytes === 0 &&
          fixture.byteLossRate === 0 &&
          fixture.outOfOrderMessages === 0 &&
          fixture.sequenceGapMessages === 0 &&
          fixture.estimatedRoundTripP95LatencyMs <=
            STREAMING_SITE_CONNECTION_P95_ROUND_TRIP_BUDGET_MS
      )
    ).toBe(true)
  })

  it('surfaces per-site fixture loss and latency metrics for the selected lane', async () => {
    const result = await optimizeStreamingSiteConnectionProfiles({
      budget: STREAMING_SITE_CONNECTION_BUDGET,
      fixtures: STREAMING_SITE_CONNECTION_FIXTURES,
      profiles: STREAMING_SITE_CONNECTION_PROFILES,
      nowStartMs: 6000,
      randomSamples: STREAMING_SITE_CONNECTION_RANDOM_SAMPLES,
      trialCount: STREAMING_SITE_CONNECTION_TRIAL_COUNT
    })
    const selectedProfile = result.bestProfile
    const mergeGate = summarizeStreamingSiteConnectionMergeGate(result)

    expect(selectedProfile && selectedProfile.profile.id).toBe('clean-ultra-low-latency')
    expect(selectedProfile && selectedProfile.maxFixtureByteLossRate).toBe(0)
    expect(selectedProfile && selectedProfile.maxFixtureDroppedMessages).toBe(0)
    expect(selectedProfile && selectedProfile.maxFixtureLostBytes).toBe(0)
    expect(selectedProfile && selectedProfile.maxFixtureEstimatedRoundTripP95LatencyMs).toBe(
      STREAMING_SITE_CONNECTION_FASTEST_ROUND_TRIP_MS
    )
    expect(mergeGate).toEqual(
      expect.objectContaining({
        ok: true,
        maxFixtureByteLossRate: 0,
        maxFixtureDroppedMessages: 0,
        maxFixtureEstimatedRoundTripP95LatencyMs: STREAMING_SITE_CONNECTION_FASTEST_ROUND_TRIP_MS
      })
    )
  })

  it('fails when recovered retry bytes exceed the configured merge budget', async () => {
    const retryProfiles = STREAMING_SITE_CONNECTION_PROFILES.filter(
      profile => profile.id === 'retry-guarded'
    )
    const result = await optimizeStreamingSiteConnectionProfiles({
      budget: STREAMING_SITE_CONNECTION_BUDGET,
      fixtures: STREAMING_SITE_CONNECTION_FIXTURES,
      profiles: retryProfiles,
      nowStartMs: 6500,
      randomSamples: STREAMING_SITE_CONNECTION_RANDOM_SAMPLES,
      trialCount: 1
    })
    const mergeGate = summarizeStreamingSiteConnectionMergeGate(result, {
      maxRetransmissionByteRate: 0,
      maxDirectionalRetransmissionByteRate: 0
    })

    expect(result.bestProfile && result.bestProfile.profile.id).toBe('retry-guarded')
    expect(mergeGate.ok).toBe(false)
    expect(mergeGate.maxCombinedRetransmissionByteRate).toBeGreaterThan(0)
    expect(mergeGate.maxFixtureRetransmissionByteRate).toBeGreaterThan(0)
    expect(mergeGate.failures).toEqual([
      'Recovered retry bytes exceeded 0.',
      'Directional recovered retry bytes exceeded 0.'
    ])
  })

  it('fails when a selected lane hides a per-site latency regression', async () => {
    const maxFixtureRoundTripP95LatencyMs = STREAMING_SITE_CONNECTION_FASTEST_ROUND_TRIP_MS - 1
    const result = await optimizeStreamingSiteConnectionProfiles({
      budget: STREAMING_SITE_CONNECTION_BUDGET,
      fixtures: STREAMING_SITE_CONNECTION_FIXTURES,
      profiles: STREAMING_SITE_CONNECTION_PROFILES,
      nowStartMs: 7000,
      randomSamples: STREAMING_SITE_CONNECTION_RANDOM_SAMPLES,
      trialCount: STREAMING_SITE_CONNECTION_TRIAL_COUNT
    })
    const mergeGate = summarizeStreamingSiteConnectionMergeGate(result, {
      maxFixtureRoundTripP95LatencyMs
    })

    expect(result.bestProfile && result.bestProfile.profile.id).toBe('clean-ultra-low-latency')
    expect(mergeGate.ok).toBe(false)
    expect(mergeGate.maxFixtureEstimatedRoundTripP95LatencyMs).toBe(
      STREAMING_SITE_CONNECTION_FASTEST_ROUND_TRIP_MS
    )
    expect(mergeGate.failures).toEqual([
      `A site fixture P95 mock round trip exceeded ${maxFixtureRoundTripP95LatencyMs}ms.`
    ])
  })

  it('fails when a selected lane hides directional latency skew behind round-trip averages', async () => {
    const result = await optimizeStreamingSiteConnectionProfiles({
      budget: {
        ...STREAMING_SITE_CONNECTION_BUDGET,
        maxDirectionalAverageLatencyMs: 10,
        maxDirectionalLatencySkewMs: 10,
        maxMaxLatencyMs: 10,
        maxP95LatencyMs: 10
      },
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
      maxDirectionalLatencySkewMs: 2
    })

    expect(result.bestProfile && result.bestProfile.profile.id).toBe('skewed-safe')
    expect(mergeGate.ok).toBe(false)
    expect(mergeGate.maxDirectionalLatencySkewMs).toBeGreaterThan(2)
    expect(mergeGate.failures).toEqual(['Directional latency skew exceeded 2ms.'])
  })
})

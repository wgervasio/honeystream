import { STREAMING_SITE_TRANSPORT_BUDGET } from './simulated-peer-transport-performance'
import {
  runStreamingSiteConnectionLab,
  StreamingSiteConnectionObservation,
  StreamingSiteConnectionProfileRank
} from './streaming-site-connection-lab'
import {
  STREAMING_SITE_CONNECTION_BUDGET,
  STREAMING_SITE_CONNECTION_FIXTURES,
  STREAMING_SITE_CONNECTION_P95_ROUND_TRIP_BUDGET_MS,
  STREAMING_SITE_CONNECTION_PROFILES
} from './streaming-site-connection-defaults'

const findObservation = (
  observations: readonly StreamingSiteConnectionObservation[],
  id: string
): StreamingSiteConnectionObservation => {
  const observation = observations.find(item => item.profile.id === id)
  if (!observation) throw new Error(`Expected observation for profile "${id}".`)
  return observation
}

const findRank = (
  ranks: readonly StreamingSiteConnectionProfileRank[],
  id: string
): StreamingSiteConnectionProfileRank => {
  const rank = ranks.find(item => item.profile.id === id)
  if (!rank) throw new Error(`Expected rank for profile "${id}".`)
  return rank
}

describe('streaming site connection lab', () => {
  it('selects the lowest-latency zero-loss mock connection across supported sites', async () => {
    const result = await runStreamingSiteConnectionLab({
      budget: STREAMING_SITE_CONNECTION_BUDGET,
      fixtures: STREAMING_SITE_CONNECTION_FIXTURES,
      profiles: STREAMING_SITE_CONNECTION_PROFILES,
      nowStartMs: 5000,
      random: () => 0.5
    })

    expect(result.bestProfile && result.bestProfile.profile.id).toBe('clean-realtime')
    expect(result.rankedProfiles[0].profile.id).toBe('clean-realtime')
    expect(result.rankedProfiles[0].siteCount).toBe(STREAMING_SITE_CONNECTION_FIXTURES.length)
    expect(result.rankedProfiles[0].providers).toEqual([
      'youtube',
      'youtube',
      'youtube',
      'youtube',
      'youtube',
      'youtube',
      'youtube',
      'youtube',
      'animepahe',
      'animepahe',
      'animepahe',
      'animepahe',
      'animepahe',
      'cineby',
      'cineby',
      'cineby',
      'cineby',
      'cineby',
      'cineby',
      'miruro',
      'miruro',
      'miruro',
      'miruro',
      'unknown'
    ])

    const bestObservation = findObservation(result.observations, 'clean-realtime')
    const metrics = bestObservation.metrics
    expect(bestObservation.budgetResult).toEqual({ ok: true, failures: [] })
    expect(metrics.combinedSentMessages).toBeGreaterThan(STREAMING_SITE_CONNECTION_FIXTURES.length)
    expect(metrics.combinedDeliveredMessages).toBe(metrics.combinedSentMessages)
    expect(metrics.combinedDroppedMessages).toBe(0)
    expect(metrics.combinedRetransmittedMessages).toBe(0)
    expect(metrics.combinedOutOfOrderMessages).toBe(0)
    expect(metrics.combinedSequenceGapMessages).toBe(0)
    expect(metrics.combinedLostBytes).toBe(0)
    expect(metrics.combinedByteLossRate).toBe(0)
    expect(metrics.maxDirectionalByteLossRate).toBe(0)
    expect(metrics.combinedRetransmissionRate).toBe(0)
    expect(metrics.combinedQueuedMessages).toBe(0)
    expect(metrics.maxDirectionalQueuedMessages).toBe(0)
    expect(metrics.combinedPeakQueuedMessages).toBeGreaterThanOrEqual(3)
    expect(metrics.maxDirectionalAverageLatencyMs).toBeLessThanOrEqual(2)
    expect(metrics.estimatedRoundTripP95LatencyMs).toBeLessThanOrEqual(
      STREAMING_SITE_CONNECTION_P95_ROUND_TRIP_BUDGET_MS
    )
    expect(metrics.estimatedRoundTripMaxLatencyMs).toBeLessThanOrEqual(
      STREAMING_SITE_CONNECTION_P95_ROUND_TRIP_BUDGET_MS
    )
    expect(metrics.combinedMaxMessageBytes).toBeLessThanOrEqual(
      STREAMING_SITE_TRANSPORT_BUDGET.maxMessageBytes
    )
    expect(metrics.combinedAverageMessageBytes).toBeLessThan(
      STREAMING_SITE_TRANSPORT_BUDGET.maxAverageMessageBytes
    )
  })

  it('covers the requested streaming-site matrix before selecting a transport lane', () => {
    const sources = STREAMING_SITE_CONNECTION_FIXTURES.map(fixture => fixture.source)

    expect(STREAMING_SITE_CONNECTION_FIXTURES).toHaveLength(24)
    expect(sources.some(source => source.includes('youtube.com'))).toBe(true)
    expect(sources.some(source => source.includes('youtu.be'))).toBe(true)
    expect(sources.some(source => source.includes('animepahe'))).toBe(true)
    expect(sources.some(source => source.includes('cineby'))).toBe(true)
    expect(sources.some(source => source.includes('miruro'))).toBe(true)
    expect(sources.some(source => source.includes('streaming.example.test'))).toBe(true)
    expect(STREAMING_SITE_CONNECTION_FIXTURES.some(fixture => fixture.durationMs === null)).toBe(
      true
    )
    expect(
      STREAMING_SITE_CONNECTION_FIXTURES.some(
        fixture => typeof fixture.durationMs === 'number' && fixture.durationMs < 60000
      )
    ).toBe(true)
    expect(
      STREAMING_SITE_CONNECTION_FIXTURES.some(
        fixture => typeof fixture.durationMs === 'number' && fixture.durationMs > 3600000
      )
    ).toBe(true)
  })

  it('keeps lossy and slow mock profiles out of the selected streaming lane', async () => {
    const result = await runStreamingSiteConnectionLab({
      budget: STREAMING_SITE_CONNECTION_BUDGET,
      fixtures: STREAMING_SITE_CONNECTION_FIXTURES,
      profiles: STREAMING_SITE_CONNECTION_PROFILES,
      nowStartMs: 9000,
      random: () => 0.5
    })
    const lossyRank = findRank(result.rankedProfiles, 'lossy-fast')
    const slowRank = findRank(result.rankedProfiles, 'slow-safe')
    const retryRank = findRank(result.rankedProfiles, 'retry-guarded')

    expect(lossyRank.budgetResult.ok).toBe(false)
    expect(lossyRank.budgetResult.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ metric: 'combinedDroppedMessages' }),
        expect.objectContaining({ metric: 'combinedByteLossRate' })
      ])
    )
    expect(slowRank.budgetResult.ok).toBe(false)
    expect(slowRank.budgetResult.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ metric: 'combinedP95LatencyMs' }),
        expect.objectContaining({ metric: 'estimatedRoundTripP95LatencyMs' })
      ])
    )
    expect(retryRank.budgetResult.ok).toBe(true)
    expect(retryRank.candidate.metrics.combinedDroppedMessages).toBe(0)
    expect(retryRank.candidate.metrics.combinedRetransmittedMessages).toBeGreaterThan(0)
    expect(retryRank.candidate.metrics.combinedRetransmissionRate).toBeGreaterThan(0)
    expect(retryRank.candidate.metrics.estimatedRoundTripP95LatencyMs).toBeLessThanOrEqual(
      STREAMING_SITE_CONNECTION_P95_ROUND_TRIP_BUDGET_MS
    )
  })

  it('observes asymmetric host and guest latency before ranking a mock lane', async () => {
    const asymmetricBudget = {
      ...STREAMING_SITE_CONNECTION_BUDGET,
      maxAverageLatencyMs: 4,
      maxP95LatencyMs: 4,
      maxMaxLatencyMs: 4,
      maxDirectionalAverageLatencyMs: 4,
      maxDirectionalLatencySkewMs: 2,
      maxEstimatedRoundTripP95LatencyMs: 6,
      maxEstimatedRoundTripMaxLatencyMs: 6
    }
    const result = await runStreamingSiteConnectionLab({
      budget: asymmetricBudget,
      fixtures: STREAMING_SITE_CONNECTION_FIXTURES.slice(0, 4),
      profiles: [
        {
          id: 'asymmetric-clean',
          label: 'Asymmetric clean lane',
          hostNetwork: { latencyMs: 2, maxQueuedFrames: 128 },
          guestNetwork: { latencyMs: 4, maxQueuedFrames: 128 }
        },
        {
          id: 'symmetric-too-slow',
          label: 'Symmetric slow lane',
          network: { latencyMs: 5, maxQueuedFrames: 128 }
        }
      ],
      nowStartMs: 12000,
      random: () => 0.5
    })

    const asymmetricObservation = findObservation(result.observations, 'asymmetric-clean')
    const slowRank = findRank(result.rankedProfiles, 'symmetric-too-slow')

    expect(result.bestProfile && result.bestProfile.profile.id).toBe('asymmetric-clean')
    expect(asymmetricObservation.budgetResult).toEqual({ ok: true, failures: [] })
    expect(asymmetricObservation.metrics.host.averageLatencyMs).toBeLessThanOrEqual(2)
    expect(asymmetricObservation.metrics.guest.averageLatencyMs).toBeLessThanOrEqual(4)
    expect(asymmetricObservation.metrics.directionalAverageLatencySkewMs).toBe(2)
    expect(asymmetricObservation.metrics.estimatedRoundTripP95LatencyMs).toBe(6)
    expect(asymmetricObservation.metrics.combinedByteLossRate).toBe(0)
    expect(slowRank.budgetResult.ok).toBe(false)
    expect(slowRank.budgetResult.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ metric: 'maxDirectionalAverageLatencyMs' }),
        expect.objectContaining({ metric: 'estimatedRoundTripP95LatencyMs' })
      ])
    )
  })
})

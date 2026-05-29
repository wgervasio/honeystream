import { STREAMING_SITE_TRANSPORT_BUDGET } from './simulated-peer-transport-performance'
import {
  runStreamingSiteConnectionLab,
  StreamingSiteConnectionObservation,
  StreamingSiteConnectionProfileRank
} from './streaming-site-connection-lab'
import {
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
      fixtures: STREAMING_SITE_CONNECTION_FIXTURES,
      profiles: STREAMING_SITE_CONNECTION_PROFILES,
      nowStartMs: 5000,
      random: () => 0.5
    })

    expect(result.bestProfile && result.bestProfile.profile.id).toBe('clean-fast')
    expect(result.rankedProfiles[0].profile.id).toBe('clean-fast')
    expect(result.rankedProfiles[0].siteCount).toBe(STREAMING_SITE_CONNECTION_FIXTURES.length)
    expect(result.rankedProfiles[0].providers).toEqual([
      'youtube',
      'youtube',
      'youtube',
      'youtube',
      'youtube',
      'animepahe',
      'animepahe',
      'animepahe',
      'cineby',
      'cineby',
      'cineby',
      'cineby',
      'miruro',
      'miruro',
      'miruro',
      'unknown'
    ])

    const bestObservation = findObservation(result.observations, 'clean-fast')
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
    expect(metrics.maxDirectionalAverageLatencyMs).toBeLessThanOrEqual(4)
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

  it('keeps lossy and slow mock profiles out of the selected streaming lane', async () => {
    const result = await runStreamingSiteConnectionLab({
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
  })
})

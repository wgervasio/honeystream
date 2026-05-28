import { STREAMING_SITE_TRANSPORT_BUDGET } from './simulated-peer-transport-performance'
import {
  runStreamingSiteConnectionLab,
  StreamingSiteConnectionFixture,
  StreamingSiteConnectionObservation,
  StreamingSiteConnectionProfile,
  StreamingSiteConnectionProfileRank
} from './streaming-site-connection-lab'

const STREAMING_SITE_FIXTURES: readonly StreamingSiteConnectionFixture[] = [
  {
    id: 'youtube-watch',
    source: 'https://www.youtube.com/watch?v=honeystream-sync',
    title: 'YouTube watch page'
  },
  {
    id: 'youtube-short',
    source: 'https://youtu.be/honeystream-sync',
    title: 'YouTube short link'
  },
  {
    id: 'youtube-nocookie',
    source: 'https://www.youtube-nocookie.com/embed/honeystream-sync',
    title: 'YouTube no-cookie embed'
  },
  {
    id: 'animepahe-ru',
    source: 'https://animepahe.ru/play/honeystream-test',
    title: 'AnimePahe RU episode'
  },
  {
    id: 'animepahe-si',
    source: 'https://animepahe.si/anime/honeystream-test',
    title: 'AnimePahe SI episode'
  },
  {
    id: 'animepahe-com',
    source: 'https://animepahe.com/watch/honeystream-test',
    title: 'AnimePahe COM episode'
  },
  {
    id: 'cineby-app',
    source: 'https://cineby.app/movie/honeystream-test',
    title: 'Cineby movie'
  },
  {
    id: 'cineby-to',
    source: 'https://watch.cineby.to/tv/honeystream-test',
    title: 'Cineby TV'
  },
  {
    id: 'cineby-subdomain',
    source: 'https://video.cineby.app/movie/honeystream-test',
    title: 'Cineby subdomain movie'
  },
  {
    id: 'miruro-to',
    source: 'https://miruro.to/watch/honeystream-test',
    title: 'Miruro watch page'
  },
  {
    id: 'miruro-tv',
    source: 'https://www.miruro.tv/watch/honeystream-test',
    title: 'Miruro TV watch page'
  },
  {
    id: 'generic-site',
    source: 'https://streaming.example.test/watch/honeystream-night',
    title: 'Generic streaming page'
  }
]

const CONNECTION_PROFILES: readonly StreamingSiteConnectionProfile[] = [
  {
    id: 'lossy-fast',
    label: 'Lossy fast lane',
    network: { latencyMs: 4, dropEveryNthMessage: 7, maxQueuedFrames: 128 }
  },
  {
    id: 'slow-safe',
    label: 'Slow reliable lane',
    network: { latencyMs: 24, maxQueuedFrames: 128 }
  },
  {
    id: 'balanced-low-latency',
    label: 'Balanced low-latency lane',
    network: { latencyMs: 8, jitterMs: 2, maxQueuedFrames: 128 }
  }
]

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
      fixtures: STREAMING_SITE_FIXTURES,
      profiles: CONNECTION_PROFILES,
      nowStartMs: 5000,
      random: () => 0.5
    })

    expect(result.bestProfile && result.bestProfile.profile.id).toBe('balanced-low-latency')
    expect(result.rankedProfiles[0].profile.id).toBe('balanced-low-latency')
    expect(result.rankedProfiles[0].siteCount).toBe(STREAMING_SITE_FIXTURES.length)
    expect(result.rankedProfiles[0].providers).toEqual([
      'youtube',
      'youtube',
      'youtube',
      'animepahe',
      'animepahe',
      'animepahe',
      'cineby',
      'cineby',
      'cineby',
      'miruro',
      'miruro',
      'unknown'
    ])

    const bestObservation = findObservation(result.observations, 'balanced-low-latency')
    const metrics = bestObservation.metrics
    expect(bestObservation.budgetResult).toEqual({ ok: true, failures: [] })
    expect(metrics.combinedSentMessages).toBeGreaterThan(STREAMING_SITE_FIXTURES.length)
    expect(metrics.combinedDeliveredMessages).toBe(metrics.combinedSentMessages)
    expect(metrics.combinedDroppedMessages).toBe(0)
    expect(metrics.combinedOutOfOrderMessages).toBe(0)
    expect(metrics.combinedSequenceGapMessages).toBe(0)
    expect(metrics.combinedLostBytes).toBe(0)
    expect(metrics.combinedByteLossRate).toBe(0)
    expect(metrics.maxDirectionalByteLossRate).toBe(0)
    expect(metrics.combinedQueuedMessages).toBe(0)
    expect(metrics.maxDirectionalQueuedMessages).toBe(0)
    expect(metrics.maxDirectionalAverageLatencyMs).toBeLessThanOrEqual(8)
    expect(metrics.estimatedRoundTripP95LatencyMs).toBeLessThanOrEqual(16)
    expect(metrics.estimatedRoundTripMaxLatencyMs).toBeLessThanOrEqual(16)
    expect(metrics.combinedMaxMessageBytes).toBeLessThanOrEqual(
      STREAMING_SITE_TRANSPORT_BUDGET.maxMessageBytes
    )
    expect(metrics.combinedAverageMessageBytes).toBeLessThan(
      STREAMING_SITE_TRANSPORT_BUDGET.maxAverageMessageBytes
    )
  })

  it('keeps lossy and slow mock profiles out of the selected streaming lane', async () => {
    const result = await runStreamingSiteConnectionLab({
      fixtures: STREAMING_SITE_FIXTURES,
      profiles: CONNECTION_PROFILES,
      nowStartMs: 9000,
      random: () => 0.5
    })
    const lossyRank = findRank(result.rankedProfiles, 'lossy-fast')
    const slowRank = findRank(result.rankedProfiles, 'slow-safe')

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
  })
})

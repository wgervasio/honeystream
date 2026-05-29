import {
  StreamingSiteConnectionFixture,
  StreamingSiteConnectionProfile
} from './streaming-site-connection-lab'
import {
  STREAMING_SITE_CONNECTION_FIXTURES,
  STREAMING_SITE_CONNECTION_P95_ROUND_TRIP_BUDGET_MS,
  STREAMING_SITE_CONNECTION_PROFILES,
  STREAMING_SITE_CONNECTION_RANDOM_SAMPLES,
  STREAMING_SITE_CONNECTION_TRIAL_COUNT
} from './streaming-site-connection-defaults'
import { optimizeStreamingSiteConnectionProfiles } from './streaming-site-connection-optimizer'

const STREAMING_FIXTURES: readonly StreamingSiteConnectionFixture[] = [
  {
    id: 'youtube-watch',
    source: 'https://www.youtube.com/watch?v=honeystream-sync',
    title: 'YouTube watch page'
  },
  {
    id: 'animepahe-play',
    source: 'https://animepahe.ru/play/honeystream-test',
    title: 'AnimePahe episode'
  },
  {
    id: 'cineby-movie',
    source: 'https://cineby.app/movie/honeystream-test',
    title: 'Cineby movie'
  },
  {
    id: 'miruro-watch',
    source: 'https://miruro.to/watch/honeystream-test',
    title: 'Miruro watch page'
  },
  {
    id: 'generic-site',
    source: 'https://watch.example.test/honeystream-night',
    title: 'Generic watch page'
  }
]

const CONNECTION_PROFILES: readonly StreamingSiteConnectionProfile[] = [
  {
    id: 'fast-lossy',
    label: 'Fast but lossy',
    network: { latencyMs: 3, dropRate: 0.5, maxQueuedFrames: 128 }
  },
  {
    id: 'reliable-low-latency',
    label: 'Reliable low latency',
    network: { latencyMs: 8, jitterMs: 2, maxQueuedFrames: 128 }
  },
  {
    id: 'retry-safe',
    label: 'Retry safe',
    network: {
      latencyMs: 6,
      dropRate: 0.5,
      maxQueuedFrames: 128,
      retransmitDroppedFrames: true,
      retransmitDelayMs: 4
    }
  },
  {
    id: 'slow-safe',
    label: 'Slow safe',
    network: { latencyMs: 24, maxQueuedFrames: 128 }
  }
]

describe('streaming site connection optimizer', () => {
  it('keeps the default streaming matrix on the clean fast zero-loss lane', async () => {
    const result = await optimizeStreamingSiteConnectionProfiles({
      fixtures: STREAMING_SITE_CONNECTION_FIXTURES,
      profiles: STREAMING_SITE_CONNECTION_PROFILES,
      nowStartMs: 2000,
      randomSamples: STREAMING_SITE_CONNECTION_RANDOM_SAMPLES,
      trialCount: STREAMING_SITE_CONNECTION_TRIAL_COUNT
    })

    expect(result.trialCount).toBe(STREAMING_SITE_CONNECTION_TRIAL_COUNT)
    expect(result.bestProfile && result.bestProfile.profile.id).toBe('clean-fast')
    expect(result.rankedProfiles[0].profile.id).toBe('clean-fast')
    expect(result.rankedProfiles[0].allTrialsPassed).toBe(true)
    expect(result.rankedProfiles[0].siteCount).toBe(STREAMING_SITE_CONNECTION_FIXTURES.length)
    expect(result.rankedProfiles[0].maxCombinedByteLossRate).toBe(0)
    expect(result.rankedProfiles[0].maxCombinedDroppedMessages).toBe(0)
    expect(result.rankedProfiles[0].maxEstimatedRoundTripP95LatencyMs).toBeLessThanOrEqual(
      STREAMING_SITE_CONNECTION_P95_ROUND_TRIP_BUDGET_MS
    )

    const retryRank = result.rankedProfiles.find(rank => rank.profile.id === 'retry-guarded')
    if (!retryRank) throw new Error('Expected retry-guarded profile rank.')
    expect(retryRank.allTrialsPassed).toBe(true)
    expect(retryRank.maxCombinedByteLossRate).toBe(0)
    expect(retryRank.maxEstimatedRoundTripP95LatencyMs).toBeGreaterThan(
      result.rankedProfiles[0].maxEstimatedRoundTripP95LatencyMs
    )
  })

  it('selects the fastest profile that stays zero-loss across deterministic trials', async () => {
    const result = await optimizeStreamingSiteConnectionProfiles({
      fixtures: STREAMING_FIXTURES,
      profiles: CONNECTION_PROFILES,
      nowStartMs: 1000,
      randomSamples: [0.25, 0.75, 0.5],
      trialCount: 3
    })

    expect(result.trialCount).toBe(3)
    expect(result.bestProfile && result.bestProfile.profile.id).toBe('reliable-low-latency')
    expect(result.rankedProfiles[0].profile.id).toBe('reliable-low-latency')
    expect(result.rankedProfiles[0].allTrialsPassed).toBe(true)
    expect(result.rankedProfiles[0].passedTrials).toBe(3)
    expect(result.rankedProfiles[0].siteCount).toBe(STREAMING_FIXTURES.length)
    expect(result.rankedProfiles[0].maxCombinedByteLossRate).toBe(0)
    expect(result.rankedProfiles[0].maxCombinedDroppedMessages).toBe(0)
    expect(result.rankedProfiles[0].maxEstimatedRoundTripP95LatencyMs).toBeLessThanOrEqual(20)

    const retryRank = result.rankedProfiles.find(rank => rank.profile.id === 'retry-safe')
    if (!retryRank) throw new Error('Expected retry-safe profile rank.')
    expect(retryRank.allTrialsPassed).toBe(true)
    expect(retryRank.maxCombinedByteLossRate).toBe(0)
    expect(retryRank.maxEstimatedRoundTripP95LatencyMs).toBeGreaterThan(
      result.rankedProfiles[0].maxEstimatedRoundTripP95LatencyMs
    )

    const lossyRank = result.rankedProfiles.find(rank => rank.profile.id === 'fast-lossy')
    if (!lossyRank) throw new Error('Expected fast-lossy profile rank.')
    expect(lossyRank.allTrialsPassed).toBe(false)
    expect(lossyRank.maxCombinedDroppedMessages).toBeGreaterThan(0)
    expect(lossyRank.maxCombinedByteLossRate).toBeGreaterThan(0)
  })

  it('does not select a profile when every mock lane loses bytes or misses latency budget', async () => {
    const result = await optimizeStreamingSiteConnectionProfiles({
      fixtures: STREAMING_FIXTURES,
      profiles: [
        {
          id: 'always-lossy',
          label: 'Always lossy',
          network: { latencyMs: 2, dropEveryNthMessage: 2, maxQueuedFrames: 128 }
        },
        {
          id: 'too-slow',
          label: 'Too slow',
          network: { latencyMs: 40, maxQueuedFrames: 128 }
        }
      ],
      randomSamples: [0.2, 0.8],
      trialCount: 2
    })

    expect(result.bestProfile).toBeUndefined()
    expect(result.rankedProfiles.every(rank => !rank.allTrialsPassed)).toBe(true)
    expect(result.rankedProfiles[0].passedTrials).toBe(0)
  })
})

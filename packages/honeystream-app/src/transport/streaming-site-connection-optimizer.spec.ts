import {
  StreamingSiteConnectionFixture,
  StreamingSiteConnectionProfile
} from './streaming-site-connection-lab'
import {
  STREAMING_SITE_CONNECTION_BUDGET,
  STREAMING_SITE_CONNECTION_FASTEST_ROUND_TRIP_MS,
  STREAMING_SITE_CONNECTION_FIXTURES,
  STREAMING_SITE_CONNECTION_P95_ROUND_TRIP_BUDGET_MS,
  STREAMING_SITE_CONNECTION_PROFILES,
  STREAMING_SITE_CONNECTION_RANDOM_SAMPLES,
  STREAMING_SITE_CONNECTION_TRIAL_COUNT
} from './streaming-site-connection-defaults'
import { summarizeStreamingSiteConnectionMergeGate } from './streaming-site-connection-merge-gate'
import { optimizeStreamingSiteConnectionProfiles } from './streaming-site-connection-optimizer'
const STREAMING_FIXTURES: readonly StreamingSiteConnectionFixture[] = [
  { id: 'youtube-watch', source: 'https://www.youtube.com/watch?v=honeystream-sync' },
  { id: 'animepahe-play', source: 'https://animepahe.ru/play/honeystream-test' },
  { id: 'cineby-movie', source: 'https://cineby.app/movie/honeystream-test' },
  { id: 'miruro-watch', source: 'https://miruro.to/watch/honeystream-test' },
  { id: 'generic-site', source: 'https://watch.example.test/honeystream-night' }
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
  it('keeps the default streaming matrix on the ultra-low-latency zero-loss lane', async () => {
    const result = await optimizeStreamingSiteConnectionProfiles({
      budget: STREAMING_SITE_CONNECTION_BUDGET,
      fixtures: STREAMING_SITE_CONNECTION_FIXTURES,
      profiles: STREAMING_SITE_CONNECTION_PROFILES,
      nowStartMs: 2000,
      randomSamples: STREAMING_SITE_CONNECTION_RANDOM_SAMPLES,
      trialCount: STREAMING_SITE_CONNECTION_TRIAL_COUNT
    })

    expect(result.trialCount).toBe(STREAMING_SITE_CONNECTION_TRIAL_COUNT)
    expect(result.bestProfile && result.bestProfile.profile.id).toBe('clean-ultra-low-latency')
    expect(result.rankedProfiles[0].profile.id).toBe('clean-ultra-low-latency')
    expect(result.rankedProfiles[0].allTrialsPassed).toBe(true)
    expect(result.rankedProfiles[0].siteCount).toBe(STREAMING_SITE_CONNECTION_FIXTURES.length)
    expect(result.rankedProfiles[0].maxCombinedByteLossRate).toBe(0)
    expect(result.rankedProfiles[0].maxCombinedDroppedMessages).toBe(0)
    expect(result.rankedProfiles[0].maxCombinedRetransmissionRate).toBe(0)
    expect(result.rankedProfiles[0].maxCombinedPeakQueuedBytes).toBeGreaterThan(0)
    expect(result.rankedProfiles[0].maxDirectionalPeakQueuedBytes).toBeGreaterThan(0)
    expect(result.rankedProfiles[0].maxDirectionalRetransmissionRate).toBe(0)
    expect(result.rankedProfiles[0].maxDirectionalLatencySkewMs).toBe(0)
    expect(result.rankedProfiles[0].maxEstimatedRoundTripP95LatencyMs).toBeLessThanOrEqual(
      STREAMING_SITE_CONNECTION_P95_ROUND_TRIP_BUDGET_MS
    )
    expect(result.rankedProfiles[0].maxEstimatedRoundTripP95LatencyMs).toBeLessThanOrEqual(
      STREAMING_SITE_CONNECTION_FASTEST_ROUND_TRIP_MS
    )
    const mergeGate = summarizeStreamingSiteConnectionMergeGate(result)
    expect(mergeGate).toEqual(
      expect.objectContaining({
        ok: true,
        selectedProfileId: 'clean-ultra-low-latency',
        selectedProfileLabel: 'Clean ultra-low latency lane',
        siteCount: STREAMING_SITE_CONNECTION_FIXTURES.length,
        trialCount: STREAMING_SITE_CONNECTION_TRIAL_COUNT,
        maxCombinedByteLossRate: 0,
        maxCombinedDroppedMessages: 0,
        maxCombinedMaxMessageBytes: result.rankedProfiles[0].maxCombinedMaxMessageBytes,
        maxCombinedRetransmissionRate: 0,
        maxCombinedRetransmissionByteRate: 0,
        maxDirectionalLatencySkewMs: 0,
        maxEstimatedRoundTripP95LatencyMs: STREAMING_SITE_CONNECTION_FASTEST_ROUND_TRIP_MS,
        missingProviders: [],
        failures: []
      })
    )
    expect(mergeGate.coveredProviders).toEqual([
      'youtube',
      'animepahe',
      'cineby',
      'miruro',
      'unknown'
    ])
    expect(mergeGate.requiredProviders).toEqual(['youtube', 'animepahe', 'cineby', 'miruro'])
    expect(mergeGate.maxCombinedAverageMessageBytes).toBeLessThanOrEqual(
      STREAMING_SITE_CONNECTION_BUDGET.maxAverageMessageBytes
    )
    expect(mergeGate.maxCombinedMaxMessageBytes).toBeLessThanOrEqual(
      STREAMING_SITE_CONNECTION_BUDGET.maxMessageBytes
    )
    expect(mergeGate.maxFixtureMaxMessageBytes).toBeLessThanOrEqual(
      STREAMING_SITE_CONNECTION_BUDGET.maxMessageBytes
    )
    expect(mergeGate.maxProviderMaxMessageBytes).toBeLessThanOrEqual(
      STREAMING_SITE_CONNECTION_BUDGET.maxMessageBytes
    )

    const retryRank = result.rankedProfiles.find(rank => rank.profile.id === 'retry-guarded')
    if (!retryRank) throw new Error('Expected retry-guarded profile rank.')
    expect(retryRank.allTrialsPassed).toBe(true)
    expect(retryRank.maxCombinedByteLossRate).toBe(0)
    expect(retryRank.maxCombinedRetransmissionRate).toBeGreaterThan(0)
    expect(retryRank.maxCombinedRetransmissionRate).toBeLessThanOrEqual(
      STREAMING_SITE_CONNECTION_BUDGET.maxRetransmissionRate
    )
    expect(retryRank.maxCombinedRetransmissionByteRate).toBeGreaterThan(0)
    expect(retryRank.maxCombinedRetransmissionByteRate).toBeLessThanOrEqual(
      STREAMING_SITE_CONNECTION_BUDGET.maxRetransmissionByteRate
    )
    expect(retryRank.maxFixtureRetransmissionByteRate).toBeGreaterThan(0)
    expect(retryRank.maxDirectionalRetransmissionRate).toBeLessThanOrEqual(
      STREAMING_SITE_CONNECTION_BUDGET.maxDirectionalRetransmissionRate
    )
    expect(retryRank.maxDirectionalRetransmissionByteRate).toBeLessThanOrEqual(
      STREAMING_SITE_CONNECTION_BUDGET.maxDirectionalRetransmissionByteRate
    )
    expect(retryRank.maxEstimatedRoundTripP95LatencyMs).toBeLessThanOrEqual(
      STREAMING_SITE_CONNECTION_P95_ROUND_TRIP_BUDGET_MS
    )
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
    expect(result.rankedProfiles[0].maxCombinedRetransmissionRate).toBe(0)
    expect(result.rankedProfiles[0].maxEstimatedRoundTripP95LatencyMs).toBeLessThanOrEqual(20)

    const retryRank = result.rankedProfiles.find(rank => rank.profile.id === 'retry-safe')
    if (!retryRank) throw new Error('Expected retry-safe profile rank.')
    expect(retryRank.allTrialsPassed).toBe(true)
    expect(retryRank.maxCombinedByteLossRate).toBe(0)
    expect(retryRank.maxCombinedRetransmissionRate).toBeGreaterThan(0)
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

    const mergeGate = summarizeStreamingSiteConnectionMergeGate(result, {
      maxRoundTripP95LatencyMs: 20,
      requiredProviders: ['youtube', 'miruro']
    })
    expect(mergeGate.ok).toBe(false)
    expect(mergeGate.selectedProfileId).toBeUndefined()
    expect(mergeGate.coveredProviders).toEqual([
      'youtube',
      'animepahe',
      'cineby',
      'miruro',
      'unknown'
    ])
    expect(mergeGate.missingProviders).toEqual([])
    expect(mergeGate.failures).toEqual(
      expect.arrayContaining(['No streaming-site transport lane passed every deterministic trial.'])
    )
  })

  it('fails the merge gate when a passing lane does not cover requested providers', async () => {
    const result = await optimizeStreamingSiteConnectionProfiles({
      fixtures: STREAMING_FIXTURES.slice(0, 1),
      profiles: [CONNECTION_PROFILES[1]],
      nowStartMs: 3000,
      randomSamples: [0.5],
      trialCount: 1
    })

    const mergeGate = summarizeStreamingSiteConnectionMergeGate(result, {
      maxRoundTripP95LatencyMs: 20,
      requiredProviders: ['youtube', 'miruro']
    })

    expect(result.bestProfile && result.bestProfile.profile.id).toBe('reliable-low-latency')
    expect(mergeGate.ok).toBe(false)
    expect(mergeGate.selectedProfileId).toBe('reliable-low-latency')
    expect(mergeGate.coveredProviders).toEqual(['youtube'])
    expect(mergeGate.missingProviders).toEqual(['miruro'])
    expect(mergeGate.failures).toEqual([
      'Miruro coverage is missing from the streaming-site matrix.',
      'YouTube coverage has fewer than 2 streaming-site fixtures.'
    ])
  })
})

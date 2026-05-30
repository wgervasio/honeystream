import {
  StreamingSiteConnectionFixture,
  StreamingSiteConnectionProfile
} from './streaming-site-connection-lab'
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
  }
]

const CONNECTION_PROFILES: readonly StreamingSiteConnectionProfile[] = [
  {
    id: 'faster-repaired',
    label: 'Faster repaired lane',
    network: {
      latencyMs: 1,
      dropEveryNthMessage: 5,
      maxQueuedFrames: 128,
      retransmitDroppedFrames: true,
      retransmitDelayMs: 1
    }
  },
  {
    id: 'clean-slightly-slower',
    label: 'Clean slightly slower lane',
    network: { latencyMs: 3, maxQueuedFrames: 128 }
  }
]

describe('streaming site connection profile ranking', () => {
  it('prefers a clean zero-retry lane over a faster repaired lane', async () => {
    const result = await optimizeStreamingSiteConnectionProfiles({
      fixtures: STREAMING_FIXTURES,
      profiles: CONNECTION_PROFILES,
      nowStartMs: 5000,
      randomSamples: [0.5],
      trialCount: 1
    })

    const repairedRank = result.rankedProfiles.find(rank => rank.profile.id === 'faster-repaired')
    if (!repairedRank) throw new Error('Expected faster-repaired profile rank.')
    expect(result.bestProfile && result.bestProfile.profile.id).toBe('clean-slightly-slower')
    expect(result.rankedProfiles[0].profile.id).toBe('clean-slightly-slower')
    expect(result.rankedProfiles[0].maxCombinedRetransmissionRate).toBe(0)
    expect(repairedRank.allTrialsPassed).toBe(true)
    expect(repairedRank.maxEstimatedRoundTripP95LatencyMs).toBeLessThan(
      result.rankedProfiles[0].maxEstimatedRoundTripP95LatencyMs
    )
    expect(repairedRank.maxCombinedRetransmissionByteRate).toBeGreaterThan(0)
  })
})

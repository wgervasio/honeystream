import { STREAMING_SITE_CONNECTION_FASTEST_ROUND_TRIP_MS } from './streaming-site-connection-defaults'
import { summarizeStreamingSiteConnectionMergeGate } from './streaming-site-connection-merge-gate'
import {
  StreamingSiteConnectionOptimizationResult,
  StreamingSiteConnectionProfileOptimization
} from './streaming-site-connection-optimizer'

const createProviderRegressionResult = (
  missingDirectionalDeliveryCount = 0
): StreamingSiteConnectionOptimizationResult => {
  const selectedProfile: StreamingSiteConnectionProfileOptimization = {
    allTrialsPassed: true,
    averageEstimatedRoundTripP95LatencyMs: STREAMING_SITE_CONNECTION_FASTEST_ROUND_TRIP_MS,
    failedTrials: 0,
    maxCombinedAverageMessageBytes: 512,
    maxCombinedByteLossRate: 0,
    maxCombinedDroppedMessages: 0,
    maxCombinedMaxMessageBytes: 700,
    maxCombinedRetransmissionByteRate: 0,
    maxCombinedPeakQueuedMessages: 1,
    maxCombinedRetransmissionRate: 0,
    maxDirectionalAverageLatencyMs: 1,
    maxDirectionalLatencyJitterMs: 0,
    maxDirectionalLatencySkewMs: 0,
    maxDirectionalRetransmissionByteRate: 0,
    maxDirectionalRetransmissionRate: 0,
    maxEstimatedRoundTripMaxLatencyMs: STREAMING_SITE_CONNECTION_FASTEST_ROUND_TRIP_MS,
    maxEstimatedRoundTripP95LatencyMs: STREAMING_SITE_CONNECTION_FASTEST_ROUND_TRIP_MS,
    maxFixtureAverageMessageBytes: 512,
    maxFixtureByteLossRate: 0,
    maxFixtureDirectionalLatencySkewMs: 0,
    maxFixtureDroppedMessages: 0,
    maxFixtureEstimatedRoundTripP95LatencyMs: STREAMING_SITE_CONNECTION_FASTEST_ROUND_TRIP_MS,
    maxFixtureLostBytes: 0,
    maxFixtureMaxMessageBytes: 700,
    maxFixtureMissingDirectionalDeliveryCount: missingDirectionalDeliveryCount,
    maxFixtureRetransmissionByteRate: 0,
    maxFixtureRetransmissionRate: 0,
    passedTrials: 1,
    profile: { id: 'provider-regression', label: 'Provider regression' },
    providerCoverage: [{ provider: 'youtube', siteCount: 1 }],
    providerQuality: [
      {
        provider: 'youtube',
        siteCount: 1,
        maxAverageMessageBytes: 512,
        maxByteLossRate: 0,
        maxDirectionalLatencySkewMs: 0,
        maxDroppedMessages: 0,
        maxEstimatedRoundTripP95LatencyMs: STREAMING_SITE_CONNECTION_FASTEST_ROUND_TRIP_MS,
        maxGuestToHostP95LatencyMs: 1,
        maxHostToGuestP95LatencyMs: 1,
        maxLostBytes: 0,
        maxMessageBytes: 700,
        maxMissingDirectionalDeliveryCount: missingDirectionalDeliveryCount,
        maxOutOfOrderMessages: 1,
        maxRetransmissionByteRate: 0,
        maxRetransmissionRate: 0,
        maxSequenceGapMessages: 2
      }
    ],
    providers: ['youtube'],
    siteCount: 1,
    trialCount: 1
  }
  return { bestProfile: selectedProfile, rankedProfiles: [selectedProfile], trialCount: 1 }
}

describe('streaming site connection provider regression gate', () => {
  it('fails when selected provider quality hides skipped or reordered controls', () => {
    const mergeGate = summarizeStreamingSiteConnectionMergeGate(createProviderRegressionResult(), {
      minFixturesPerRequiredProvider: 1,
      maxProviderOutOfOrderMessages: 0,
      maxProviderRoundTripP95LatencyMs: STREAMING_SITE_CONNECTION_FASTEST_ROUND_TRIP_MS - 1,
      maxProviderSequenceGapMessages: 0,
      requiredProviders: ['youtube']
    })

    expect(mergeGate.ok).toBe(false)
    expect(mergeGate.maxProviderOutOfOrderMessages).toBe(1)
    expect(mergeGate.maxProviderSequenceGapMessages).toBe(2)
    expect(mergeGate.failures).toEqual([
      'YouTube provider reordered more than 0 controls.',
      'YouTube provider P95 mock round trip exceeded 1ms.',
      'YouTube provider skipped more than 0 controls.'
    ])
  })

  it('fails when a selected lane hides an oversized site or provider control frame', () => {
    const mergeGate = summarizeStreamingSiteConnectionMergeGate(createProviderRegressionResult(), {
      maxCombinedMaxMessageBytes: 256,
      maxFixtureMaxMessageBytes: 256,
      maxProviderMaxMessageBytes: 256,
      maxProviderOutOfOrderMessages: 1,
      maxProviderRoundTripP95LatencyMs: STREAMING_SITE_CONNECTION_FASTEST_ROUND_TRIP_MS,
      maxProviderSequenceGapMessages: 2,
      minFixturesPerRequiredProvider: 1,
      requiredProviders: ['youtube']
    })

    expect(mergeGate.ok).toBe(false)
    expect(mergeGate.maxCombinedMaxMessageBytes).toBe(700)
    expect(mergeGate.maxFixtureMaxMessageBytes).toBe(700)
    expect(mergeGate.maxProviderMaxMessageBytes).toBe(700)
    expect(mergeGate.failures).toEqual([
      'A control frame exceeded 256 bytes.',
      'A site fixture control frame exceeded 256 bytes.',
      'YouTube provider control frame exceeded 256 bytes.'
    ])
  })

  it('fails when selected site fixtures do not prove both transport directions', () => {
    const mergeGate = summarizeStreamingSiteConnectionMergeGate(createProviderRegressionResult(1), {
      maxProviderOutOfOrderMessages: 1,
      maxProviderSequenceGapMessages: 2,
      requiredProviders: ['youtube']
    })

    expect(mergeGate.ok).toBe(false)
    expect(mergeGate.maxFixtureMissingDirectionalDeliveryCount).toBe(1)
    expect(mergeGate.maxProviderMissingDirectionalDeliveryCount).toBe(1)
    expect(mergeGate.failures).toEqual([
      'YouTube coverage has fewer than 2 streaming-site fixtures.',
      'A site fixture missed more than 0 delivery directions.',
      'YouTube provider missed more than 0 delivery directions.'
    ])
  })

  it('fails when a required provider has too few streaming-site fixtures to prove coverage', () => {
    const mergeGate = summarizeStreamingSiteConnectionMergeGate(createProviderRegressionResult(), {
      minFixturesPerRequiredProvider: 2,
      maxProviderOutOfOrderMessages: 1,
      maxProviderSequenceGapMessages: 2,
      requiredProviders: ['youtube']
    })

    expect(mergeGate.ok).toBe(false)
    expect(mergeGate.providerFixtureCounts).toEqual([{ provider: 'youtube', siteCount: 1 }])
    expect(mergeGate.failures).toEqual(['YouTube coverage has fewer than 2 streaming-site fixtures.'])
  })
})

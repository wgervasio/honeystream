import { MediaProvider } from 'protocol'
import {
  StreamingSiteConnectionLabResult,
  StreamingSiteConnectionProfile
} from './streaming-site-connection-lab'
import {
  StreamingSiteProviderQuality,
  summarizeStreamingSiteProviderQuality
} from './streaming-site-provider-quality'
import { StreamingSiteProviderCoverage } from './streaming-site-provider-coverage'

export interface StreamingSiteConnectionProfileOptimization {
  readonly allTrialsPassed: boolean
  readonly averageEstimatedRoundTripP95LatencyMs: number
  readonly failedTrials: number
  readonly maxCombinedAverageMessageBytes: number
  readonly maxCombinedByteLossRate: number
  readonly maxCombinedDroppedMessages: number
  readonly maxCombinedRetransmissionByteRate: number
  readonly maxCombinedPeakQueuedMessages: number
  readonly maxCombinedRetransmissionRate: number
  readonly maxDirectionalAverageLatencyMs: number
  readonly maxDirectionalLatencyJitterMs: number
  readonly maxDirectionalLatencySkewMs: number
  readonly maxDirectionalRetransmissionByteRate: number
  readonly maxDirectionalRetransmissionRate: number
  readonly maxEstimatedRoundTripMaxLatencyMs: number
  readonly maxEstimatedRoundTripP95LatencyMs: number
  readonly maxFixtureAverageMessageBytes: number
  readonly maxFixtureByteLossRate: number
  readonly maxFixtureDirectionalLatencySkewMs: number
  readonly maxFixtureDroppedMessages: number
  readonly maxFixtureEstimatedRoundTripP95LatencyMs: number
  readonly maxFixtureLostBytes: number
  readonly maxFixtureRetransmissionByteRate: number
  readonly maxFixtureRetransmissionRate: number
  readonly passedTrials: number
  readonly profile: StreamingSiteConnectionProfile
  readonly providerCoverage: readonly StreamingSiteProviderCoverage[]
  readonly providerQuality: readonly StreamingSiteProviderQuality[]
  readonly providers: readonly MediaProvider[]
  readonly siteCount: number
  readonly trialCount: number
}
const findProfileRank = (
  result: StreamingSiteConnectionLabResult,
  profileId: string
): StreamingSiteConnectionLabResult['rankedProfiles'][number] => {
  const rank = result.rankedProfiles.find(item => item.profile.id === profileId)
  if (!rank) throw new Error(`Streaming connection optimizer missed profile "${profileId}".`)
  return rank
}
const findProfileObservation = (
  result: StreamingSiteConnectionLabResult,
  profileId: string
): StreamingSiteConnectionLabResult['observations'][number] => {
  const observation = result.observations.find(item => item.profile.id === profileId)
  if (!observation)
    throw new Error(`Streaming connection optimizer missed observation "${profileId}".`)
  return observation
}
export const createStreamingSiteConnectionProfileOptimization = (
  profile: StreamingSiteConnectionProfile,
  trialResults: readonly StreamingSiteConnectionLabResult[]
): StreamingSiteConnectionProfileOptimization => {
  let passedTrials = 0
  let maxCombinedAverageMessageBytes = 0
  let maxCombinedByteLossRate = 0
  let maxCombinedDroppedMessages = 0
  let maxCombinedRetransmissionByteRate = 0
  let maxCombinedPeakQueuedMessages = 0
  let maxCombinedRetransmissionRate = 0
  let maxDirectionalAverageLatencyMs = 0
  let maxDirectionalLatencyJitterMs = 0
  let maxDirectionalLatencySkewMs = 0
  let maxDirectionalRetransmissionByteRate = 0
  let maxDirectionalRetransmissionRate = 0
  let maxEstimatedRoundTripMaxLatencyMs = 0
  let maxEstimatedRoundTripP95LatencyMs = 0
  let maxFixtureAverageMessageBytes = 0
  let maxFixtureByteLossRate = 0
  let maxFixtureDirectionalLatencySkewMs = 0
  let maxFixtureDroppedMessages = 0
  let maxFixtureEstimatedRoundTripP95LatencyMs = 0
  let maxFixtureLostBytes = 0
  let maxFixtureRetransmissionByteRate = 0
  let maxFixtureRetransmissionRate = 0
  let totalEstimatedRoundTripP95LatencyMs = 0
  for (const result of trialResults) {
    const rank = findProfileRank(result, profile.id)
    const metrics = rank.candidate.metrics
    if (rank.budgetResult.ok) passedTrials += 1
    maxCombinedAverageMessageBytes = Math.max(
      maxCombinedAverageMessageBytes,
      metrics.combinedAverageMessageBytes
    )
    maxCombinedByteLossRate = Math.max(maxCombinedByteLossRate, metrics.combinedByteLossRate)
    maxCombinedDroppedMessages = Math.max(
      maxCombinedDroppedMessages,
      metrics.combinedDroppedMessages
    )
    maxCombinedRetransmissionRate = Math.max(
      maxCombinedRetransmissionRate,
      metrics.combinedRetransmissionRate
    )
    maxCombinedRetransmissionByteRate = Math.max(
      maxCombinedRetransmissionByteRate,
      metrics.combinedRetransmissionByteRate
    )
    maxCombinedPeakQueuedMessages = Math.max(
      maxCombinedPeakQueuedMessages,
      metrics.combinedPeakQueuedMessages
    )
    maxDirectionalAverageLatencyMs = Math.max(
      maxDirectionalAverageLatencyMs,
      metrics.maxDirectionalAverageLatencyMs
    )
    maxDirectionalLatencyJitterMs = Math.max(
      maxDirectionalLatencyJitterMs,
      metrics.maxDirectionalLatencyJitterMs
    )
    maxDirectionalLatencySkewMs = Math.max(
      maxDirectionalLatencySkewMs,
      metrics.directionalAverageLatencySkewMs
    )
    maxDirectionalRetransmissionRate = Math.max(
      maxDirectionalRetransmissionRate,
      metrics.maxDirectionalRetransmissionRate
    )
    maxDirectionalRetransmissionByteRate = Math.max(
      maxDirectionalRetransmissionByteRate,
      metrics.maxDirectionalRetransmissionByteRate
    )
    maxEstimatedRoundTripMaxLatencyMs = Math.max(
      maxEstimatedRoundTripMaxLatencyMs,
      metrics.estimatedRoundTripMaxLatencyMs
    )
    maxEstimatedRoundTripP95LatencyMs = Math.max(
      maxEstimatedRoundTripP95LatencyMs,
      metrics.estimatedRoundTripP95LatencyMs
    )
    totalEstimatedRoundTripP95LatencyMs += metrics.estimatedRoundTripP95LatencyMs
    const observation = findProfileObservation(result, profile.id)
    for (const fixture of observation.fixtureObservations) {
      maxFixtureAverageMessageBytes = Math.max(
        maxFixtureAverageMessageBytes,
        fixture.averageMessageBytes
      )
      maxFixtureByteLossRate = Math.max(maxFixtureByteLossRate, fixture.byteLossRate)
      maxFixtureDirectionalLatencySkewMs = Math.max(
        maxFixtureDirectionalLatencySkewMs,
        fixture.directionalLatencySkewMs
      )
      maxFixtureDroppedMessages = Math.max(maxFixtureDroppedMessages, fixture.droppedMessages)
      maxFixtureEstimatedRoundTripP95LatencyMs = Math.max(
        maxFixtureEstimatedRoundTripP95LatencyMs,
        fixture.estimatedRoundTripP95LatencyMs
      )
      maxFixtureLostBytes = Math.max(maxFixtureLostBytes, fixture.lostBytes)
      maxFixtureRetransmissionByteRate = Math.max(
        maxFixtureRetransmissionByteRate,
        fixture.retransmissionByteRate
      )
      maxFixtureRetransmissionRate = Math.max(
        maxFixtureRetransmissionRate,
        fixture.retransmissionRate
      )
    }
  }
  const trialCount = trialResults.length
  const firstRank =
    trialResults.length === 0 ? undefined : findProfileRank(trialResults[0], profile.id)
  return {
    allTrialsPassed: passedTrials === trialCount,
    averageEstimatedRoundTripP95LatencyMs:
      trialCount === 0 ? 0 : totalEstimatedRoundTripP95LatencyMs / trialCount,
    failedTrials: trialCount - passedTrials,
    maxCombinedAverageMessageBytes,
    maxCombinedByteLossRate,
    maxCombinedDroppedMessages,
    maxCombinedRetransmissionByteRate,
    maxCombinedPeakQueuedMessages,
    maxCombinedRetransmissionRate,
    maxDirectionalAverageLatencyMs,
    maxDirectionalLatencyJitterMs,
    maxDirectionalLatencySkewMs,
    maxDirectionalRetransmissionByteRate,
    maxDirectionalRetransmissionRate,
    maxEstimatedRoundTripMaxLatencyMs,
    maxEstimatedRoundTripP95LatencyMs,
    maxFixtureAverageMessageBytes,
    maxFixtureByteLossRate,
    maxFixtureDirectionalLatencySkewMs,
    maxFixtureDroppedMessages,
    maxFixtureEstimatedRoundTripP95LatencyMs,
    maxFixtureLostBytes,
    maxFixtureRetransmissionByteRate,
    maxFixtureRetransmissionRate,
    passedTrials,
    profile,
    providerCoverage: firstRank ? firstRank.providerCoverage : [],
    providerQuality: summarizeStreamingSiteProviderQuality(profile, trialResults),
    providers: firstRank ? firstRank.providers : [],
    siteCount: firstRank ? firstRank.siteCount : 0,
    trialCount
  }
}

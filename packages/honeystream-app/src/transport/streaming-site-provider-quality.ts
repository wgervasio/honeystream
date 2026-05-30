import { MediaProvider } from 'protocol'
import {
  StreamingSiteConnectionLabResult,
  StreamingSiteConnectionProfile
} from './streaming-site-connection-lab'
import { StreamingSiteFixtureObservation } from './streaming-site-connection-site-observation'

export interface StreamingSiteProviderQuality {
  readonly provider: MediaProvider
  readonly siteCount: number
  readonly maxByteLossRate: number
  readonly maxDroppedMessages: number
  readonly maxEstimatedRoundTripP95LatencyMs: number
  readonly maxLostBytes: number
  readonly maxOutOfOrderMessages: number
  readonly maxRetransmissionByteRate: number
  readonly maxRetransmissionRate: number
  readonly maxSequenceGapMessages: number
}

interface StreamingSiteProviderQualityDraft {
  provider: MediaProvider
  fixtureIds: string[]
  maxByteLossRate: number
  maxDroppedMessages: number
  maxEstimatedRoundTripP95LatencyMs: number
  maxLostBytes: number
  maxOutOfOrderMessages: number
  maxRetransmissionByteRate: number
  maxRetransmissionRate: number
  maxSequenceGapMessages: number
}

const PROVIDER_ORDER: readonly MediaProvider[] = Object.freeze([
  'youtube',
  'animepahe',
  'cineby',
  'miruro',
  'unknown'
])

const createDraft = (provider: MediaProvider): StreamingSiteProviderQualityDraft => ({
  provider,
  fixtureIds: [],
  maxByteLossRate: 0,
  maxDroppedMessages: 0,
  maxEstimatedRoundTripP95LatencyMs: 0,
  maxLostBytes: 0,
  maxOutOfOrderMessages: 0,
  maxRetransmissionByteRate: 0,
  maxRetransmissionRate: 0,
  maxSequenceGapMessages: 0
})

const findObservation = (
  result: StreamingSiteConnectionLabResult,
  profileId: string
): StreamingSiteConnectionLabResult['observations'][number] => {
  const observation = result.observations.find(item => item.profile.id === profileId)
  if (!observation) {
    throw new Error(`Streaming provider quality missed observation "${profileId}".`)
  }

  return observation
}

const findOrCreateDraft = (
  drafts: StreamingSiteProviderQualityDraft[],
  provider: MediaProvider
): StreamingSiteProviderQualityDraft => {
  const draft = drafts.find(item => item.provider === provider)
  if (draft) return draft

  const nextDraft = createDraft(provider)
  drafts.push(nextDraft)
  return nextDraft
}

const recordFixture = (
  drafts: StreamingSiteProviderQualityDraft[],
  fixture: StreamingSiteFixtureObservation
): void => {
  const draft = findOrCreateDraft(drafts, fixture.provider)
  if (draft.fixtureIds.indexOf(fixture.fixtureId) === -1) {
    draft.fixtureIds.push(fixture.fixtureId)
  }
  draft.maxByteLossRate = Math.max(draft.maxByteLossRate, fixture.byteLossRate)
  draft.maxDroppedMessages = Math.max(draft.maxDroppedMessages, fixture.droppedMessages)
  draft.maxEstimatedRoundTripP95LatencyMs = Math.max(
    draft.maxEstimatedRoundTripP95LatencyMs,
    fixture.estimatedRoundTripP95LatencyMs
  )
  draft.maxLostBytes = Math.max(draft.maxLostBytes, fixture.lostBytes)
  draft.maxOutOfOrderMessages = Math.max(
    draft.maxOutOfOrderMessages,
    fixture.outOfOrderMessages
  )
  draft.maxRetransmissionByteRate = Math.max(
    draft.maxRetransmissionByteRate,
    fixture.retransmissionByteRate
  )
  draft.maxRetransmissionRate = Math.max(
    draft.maxRetransmissionRate,
    fixture.retransmissionRate
  )
  draft.maxSequenceGapMessages = Math.max(
    draft.maxSequenceGapMessages,
    fixture.sequenceGapMessages
  )
}

const finalizeDraft = (
  draft: StreamingSiteProviderQualityDraft
): StreamingSiteProviderQuality => ({
  provider: draft.provider,
  siteCount: draft.fixtureIds.length,
  maxByteLossRate: draft.maxByteLossRate,
  maxDroppedMessages: draft.maxDroppedMessages,
  maxEstimatedRoundTripP95LatencyMs: draft.maxEstimatedRoundTripP95LatencyMs,
  maxLostBytes: draft.maxLostBytes,
  maxOutOfOrderMessages: draft.maxOutOfOrderMessages,
  maxRetransmissionByteRate: draft.maxRetransmissionByteRate,
  maxRetransmissionRate: draft.maxRetransmissionRate,
  maxSequenceGapMessages: draft.maxSequenceGapMessages
})

/*
Context: Aggregate streaming metrics can hide one provider regressing behind another provider.
Invariant: A selected lane must expose provider-specific byte loss, retry, sequence, and latency maxima.
Options considered: Aggregate-only gates, live third-party probes, or bounded provider summaries.
Decision: Summarize per-provider fixture observations from deterministic host/guest mock trials.
Performance impact: O(trial count * fixture count) over capped lab inputs; no runtime network work.
Memory/lifecycle ownership: No resources are allocated; summaries retain compact provider values only.
Failure mode: Missing profile observations throw instead of producing success-shaped provider defaults.
Validation: Covered by streaming-site provider quality gate tests.
*/
export const summarizeStreamingSiteProviderQuality = (
  profile: StreamingSiteConnectionProfile,
  trialResults: readonly StreamingSiteConnectionLabResult[]
): readonly StreamingSiteProviderQuality[] => {
  const drafts: StreamingSiteProviderQualityDraft[] = []
  for (const result of trialResults) {
    const observation = findObservation(result, profile.id)
    for (const fixture of observation.fixtureObservations) {
      recordFixture(drafts, fixture)
    }
  }

  return PROVIDER_ORDER.map(provider => drafts.find(draft => draft.provider === provider))
    .filter((draft): draft is StreamingSiteProviderQualityDraft => Boolean(draft))
    .map(finalizeDraft)
}

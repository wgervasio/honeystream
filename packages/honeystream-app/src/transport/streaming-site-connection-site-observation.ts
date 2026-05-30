import { MediaProvider } from 'protocol'
import { AggregateSimulatedPeerTransportMetrics } from './simulated-peer-transport-pair'
import { SimulatedPeerTransportFrameSample } from './simulated-peer-transport-types'

export interface StreamingSiteFixtureObservationInput {
  readonly fixtureId: string
  readonly provider: MediaProvider
  readonly source: string
}

export interface StreamingSiteFixtureObservation {
  readonly averageMessageBytes: number
  readonly byteLossRate: number
  readonly deliveredMessages: number
  readonly droppedMessages: number
  readonly estimatedRoundTripP95LatencyMs: number
  readonly fixtureId: string
  readonly lostBytes: number
  readonly maxMessageBytes: number
  readonly outOfOrderMessages: number
  readonly provider: MediaProvider
  readonly retransmissionRate: number
  readonly retransmittedMessages: number
  readonly sequenceGapMessages: number
  readonly sentBytes: number
  readonly sentMessages: number
  readonly source: string
}

const ratio = (part: number, whole: number): number => (whole === 0 ? 0 : part / whole)

const percentile = (samples: readonly number[], percentileValue: number): number => {
  if (samples.length === 0) return 0

  const sortedSamples = [...samples].sort((left, right) => left - right)
  const index = Math.min(
    sortedSamples.length - 1,
    Math.max(0, Math.ceil(sortedSamples.length * percentileValue) - 1)
  )
  return sortedSamples[index]
}

const maxRecordedAtMs = (metrics: AggregateSimulatedPeerTransportMetrics): number =>
  metrics.recentFrames.reduce(
    (maxRecordedAt, frame) => Math.max(maxRecordedAt, frame.recordedAtMs),
    0
  )

const getFixtureFrames = (
  before: AggregateSimulatedPeerTransportMetrics,
  after: AggregateSimulatedPeerTransportMetrics
): readonly SimulatedPeerTransportFrameSample[] => {
  const baselineRecordedAtMs = maxRecordedAtMs(before)
  return after.recentFrames.filter(frame => frame.recordedAtMs > baselineRecordedAtMs)
}

const getMaxMessageBytes = (frames: readonly SimulatedPeerTransportFrameSample[]): number =>
  frames.reduce((maxBytes, frame) => Math.max(maxBytes, frame.bytes), 0)

const getDirectionalP95LatencyMs = (
  frames: readonly SimulatedPeerTransportFrameSample[]
): readonly number[] => {
  const directionalLatencies: { [direction: string]: number[] } = {}
  for (const frame of frames) {
    if (typeof frame.latencyMs !== 'number') continue
    const samples = directionalLatencies[frame.direction] || []
    samples.push(frame.latencyMs)
    directionalLatencies[frame.direction] = samples
  }

  return Object.keys(directionalLatencies)
    .map(direction => percentile(directionalLatencies[direction], 0.95))
    .sort((left, right) => right - left)
}

const estimateRoundTripP95LatencyMs = (
  frames: readonly SimulatedPeerTransportFrameSample[]
): number => {
  const directionalP95LatencyMs = getDirectionalP95LatencyMs(frames)
  return (directionalP95LatencyMs[0] || 0) + (directionalP95LatencyMs[1] || 0)
}

/*
Context: Streaming-site tuning should prove each requested site shape, not just aggregate lanes.
Invariant: A fixture observation is derived from bounded recent frames and monotonic counters only.
Options considered: Live third-party probes, full frame history, or per-fixture metric deltas.
Decision: Capture compact deltas around each mocked site fixture and keep latency from recent frames.
Performance impact: O(recent frame cap) per fixture; frame history remains bounded by transport metrics.
Memory/lifecycle ownership: No resources are retained beyond the returned observation values.
Failure mode: Missing direction samples report 0ms latency, while sent/dropped counters still expose loss.
Validation: Covered by streaming-site connection lab tests.
*/
export const createStreamingSiteFixtureObservation = (
  input: StreamingSiteFixtureObservationInput,
  before: AggregateSimulatedPeerTransportMetrics,
  after: AggregateSimulatedPeerTransportMetrics
): StreamingSiteFixtureObservation => {
  const fixtureFrames = getFixtureFrames(before, after)
  const sentMessages = after.combinedSentMessages - before.combinedSentMessages
  const deliveredMessages = after.combinedDeliveredMessages - before.combinedDeliveredMessages
  const droppedMessages = after.combinedDroppedMessages - before.combinedDroppedMessages
  const retransmittedMessages =
    after.combinedRetransmittedMessages - before.combinedRetransmittedMessages
  const sentBytes = after.combinedSentBytes - before.combinedSentBytes
  const lostBytes = after.combinedLostBytes - before.combinedLostBytes

  return {
    averageMessageBytes: ratio(sentBytes, sentMessages),
    byteLossRate: ratio(lostBytes, sentBytes),
    deliveredMessages,
    droppedMessages,
    estimatedRoundTripP95LatencyMs: estimateRoundTripP95LatencyMs(fixtureFrames),
    fixtureId: input.fixtureId,
    lostBytes,
    maxMessageBytes: getMaxMessageBytes(fixtureFrames),
    outOfOrderMessages: after.combinedOutOfOrderMessages - before.combinedOutOfOrderMessages,
    provider: input.provider,
    retransmissionRate: ratio(retransmittedMessages, deliveredMessages + droppedMessages),
    retransmittedMessages,
    sequenceGapMessages: after.combinedSequenceGapMessages - before.combinedSequenceGapMessages,
    sentBytes,
    sentMessages,
    source: input.source
  }
}

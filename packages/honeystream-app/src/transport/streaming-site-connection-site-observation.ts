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
  readonly directionalLatencySkewMs: number
  readonly droppedMessages: number
  readonly estimatedRoundTripP95LatencyMs: number
  readonly fixtureId: string
  readonly guestToHostDeliveredMessages: number
  readonly guestToHostP95LatencyMs: number
  readonly hostToGuestDeliveredMessages: number
  readonly hostToGuestP95LatencyMs: number
  readonly lostBytes: number
  readonly maxMessageBytes: number
  readonly missingDirectionalDeliveryCount: number
  readonly outOfOrderMessages: number
  readonly provider: MediaProvider
  readonly retransmissionByteRate: number
  readonly retransmissionRate: number
  readonly retransmittedBytes: number
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

const createPeerSampleWatermark = (
  frames: readonly SimulatedPeerTransportFrameSample[]
): { readonly [recordedByPeerId: string]: number } => {
  const watermark: { [recordedByPeerId: string]: number } = {}
  for (const frame of frames) {
    const previousSampleId = watermark[frame.recordedByPeerId] || 0
    watermark[frame.recordedByPeerId] = Math.max(previousSampleId, frame.sampleId)
  }
  return watermark
}

const getFixtureFrames = (
  before: AggregateSimulatedPeerTransportMetrics,
  after: AggregateSimulatedPeerTransportMetrics
): readonly SimulatedPeerTransportFrameSample[] => {
  const beforeWatermark = createPeerSampleWatermark(before.recentFrames)
  return after.recentFrames.filter(
    frame => frame.sampleId > (beforeWatermark[frame.recordedByPeerId] || 0)
  )
}

const getMaxMessageBytes = (frames: readonly SimulatedPeerTransportFrameSample[]): number =>
  frames.reduce((maxBytes, frame) => Math.max(maxBytes, frame.bytes), 0)

const getDirectionalP95LatencyMs = (
  frames: readonly SimulatedPeerTransportFrameSample[]
): { readonly [direction: string]: number } => {
  const directionalLatencies: { [direction: string]: number[] } = {}
  for (const frame of frames) {
    if (typeof frame.latencyMs !== 'number') continue
    const samples = directionalLatencies[frame.direction] || []
    samples.push(frame.latencyMs)
    directionalLatencies[frame.direction] = samples
  }

  const directionalP95LatencyMs: { [direction: string]: number } = {}
  for (const direction of Object.keys(directionalLatencies)) {
    directionalP95LatencyMs[direction] = percentile(directionalLatencies[direction], 0.95)
  }
  return directionalP95LatencyMs
}

const countDeliveredFrames = (
  frames: readonly SimulatedPeerTransportFrameSample[],
  direction: string
): number =>
  frames.reduce(
    (count, frame) =>
      frame.outcome === 'delivered' && frame.direction === direction ? count + 1 : count,
    0
  )

const getFallbackDirectionalLatencyMs = (
  directionalP95LatencyMs: { readonly [direction: string]: number },
  excludedDirection: string
): number => {
  const fallback = Object.keys(directionalP95LatencyMs)
    .filter(direction => direction !== excludedDirection)
    .map(direction => directionalP95LatencyMs[direction])
    .sort((left, right) => right - left)[0]
  return fallback || 0
}

const getNamedDirectionalLatencyMs = (
  directionalP95LatencyMs: { readonly [direction: string]: number },
  direction: string,
  fallbackExcludedDirection: string
): number => {
  const latencyMs = directionalP95LatencyMs[direction]
  return typeof latencyMs === 'number'
    ? latencyMs
    : getFallbackDirectionalLatencyMs(directionalP95LatencyMs, fallbackExcludedDirection)
}

const estimateDirectionalLatencyMs = (
  frames: readonly SimulatedPeerTransportFrameSample[]
): {
  readonly directionalLatencySkewMs: number
  readonly estimatedRoundTripP95LatencyMs: number
  readonly guestToHostDeliveredMessages: number
  readonly guestToHostP95LatencyMs: number
  readonly hostToGuestDeliveredMessages: number
  readonly hostToGuestP95LatencyMs: number
  readonly missingDirectionalDeliveryCount: number
} => {
  const directionalP95LatencyMs = getDirectionalP95LatencyMs(frames)
  const hostToGuestDeliveredMessages = countDeliveredFrames(frames, 'host->guest')
  const guestToHostDeliveredMessages = countDeliveredFrames(frames, 'guest->host')
  const hostToGuestP95LatencyMs = getNamedDirectionalLatencyMs(
    directionalP95LatencyMs,
    'host->guest',
    'guest->host'
  )
  const guestToHostP95LatencyMs = getNamedDirectionalLatencyMs(
    directionalP95LatencyMs,
    'guest->host',
    'host->guest'
  )

  return {
    directionalLatencySkewMs: Math.abs(hostToGuestP95LatencyMs - guestToHostP95LatencyMs),
    estimatedRoundTripP95LatencyMs: hostToGuestP95LatencyMs + guestToHostP95LatencyMs,
    guestToHostDeliveredMessages,
    guestToHostP95LatencyMs,
    hostToGuestDeliveredMessages,
    hostToGuestP95LatencyMs,
    missingDirectionalDeliveryCount:
      (hostToGuestDeliveredMessages > 0 ? 0 : 1) + (guestToHostDeliveredMessages > 0 ? 0 : 1)
  }
}

/*
Context: Streaming-site tuning should prove each requested site shape, not just aggregate lanes.
Invariant: A fixture observation is derived from bounded recent frames and monotonic counters only,
including both host-to-guest and guest-to-host latency so averages cannot hide skew.
Options considered: Live third-party probes, full frame history, or per-fixture metric deltas.
Decision: Capture compact per-peer sample deltas around each mocked site fixture, keep directional
latency from recent frames, and require both command and event directions to be exercised.
Performance impact: O(recent frame cap) per fixture; frame history remains bounded by transport metrics.
Memory/lifecycle ownership: No resources are retained beyond the returned observation values.
Failure mode: Missing direction samples are surfaced as missing directional deliveries.
Validation: Covered by streaming-site connection lab tests.
*/
export const createStreamingSiteFixtureObservation = (
  input: StreamingSiteFixtureObservationInput,
  before: AggregateSimulatedPeerTransportMetrics,
  after: AggregateSimulatedPeerTransportMetrics
): StreamingSiteFixtureObservation => {
  const fixtureFrames = getFixtureFrames(before, after)
  const directionalLatency = estimateDirectionalLatencyMs(fixtureFrames)
  const sentMessages = after.combinedSentMessages - before.combinedSentMessages
  const deliveredMessages = after.combinedDeliveredMessages - before.combinedDeliveredMessages
  const droppedMessages = after.combinedDroppedMessages - before.combinedDroppedMessages
  const retransmittedMessages =
    after.combinedRetransmittedMessages - before.combinedRetransmittedMessages
  const sentBytes = after.combinedSentBytes - before.combinedSentBytes
  const deliveredBytes = after.combinedDeliveredBytes - before.combinedDeliveredBytes
  const lostBytes = after.combinedLostBytes - before.combinedLostBytes
  const retransmittedBytes =
    after.combinedRetransmittedBytes - before.combinedRetransmittedBytes

  return {
    averageMessageBytes: ratio(sentBytes, sentMessages),
    byteLossRate: ratio(lostBytes, sentBytes),
    deliveredMessages,
    directionalLatencySkewMs: directionalLatency.directionalLatencySkewMs,
    droppedMessages,
    estimatedRoundTripP95LatencyMs: directionalLatency.estimatedRoundTripP95LatencyMs,
    fixtureId: input.fixtureId,
    guestToHostDeliveredMessages: directionalLatency.guestToHostDeliveredMessages,
    guestToHostP95LatencyMs: directionalLatency.guestToHostP95LatencyMs,
    hostToGuestDeliveredMessages: directionalLatency.hostToGuestDeliveredMessages,
    hostToGuestP95LatencyMs: directionalLatency.hostToGuestP95LatencyMs,
    lostBytes,
    maxMessageBytes: getMaxMessageBytes(fixtureFrames),
    missingDirectionalDeliveryCount: directionalLatency.missingDirectionalDeliveryCount,
    outOfOrderMessages: after.combinedOutOfOrderMessages - before.combinedOutOfOrderMessages,
    provider: input.provider,
    retransmissionByteRate: ratio(retransmittedBytes, deliveredBytes + lostBytes),
    retransmissionRate: ratio(retransmittedMessages, deliveredMessages + droppedMessages),
    retransmittedBytes,
    retransmittedMessages,
    sequenceGapMessages: after.combinedSequenceGapMessages - before.combinedSequenceGapMessages,
    sentBytes,
    sentMessages,
    source: input.source
  }
}

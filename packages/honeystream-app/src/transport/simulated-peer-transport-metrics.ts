import {
  SimulatedPeerTransportDropReason,
  SimulatedPeerTransportFrameOutcome,
  SimulatedPeerTransportFrameSample,
  SimulatedPeerTransportMetrics
} from './simulated-peer-transport-types'

const MAX_RECORDED_LATENCY_SAMPLES = 64
const MAX_RECORDED_FRAME_SAMPLES = 64

export interface SimulatedPeerTransportMetricsRecorder {
  recordSent(bytes: number, seq: number, recordedAtMs: number): number
  recordQueuedDepth(queuedMessages: number): void
  recordDropped(
    bytes: number,
    seq: number,
    reason: SimulatedPeerTransportDropReason,
    recordedAtMs: number
  ): void
  recordRetransmitted(bytes: number, seq: number, recordedAtMs: number, fromPeerId: string): void
  recordDelivered(
    bytes: number,
    latencyMs: number,
    seq: number,
    recordedAtMs: number,
    fromPeerId: string
  ): void
  snapshot(queuedMessages: number): SimulatedPeerTransportMetrics
}

const ratio = (part: number, whole: number): number => (whole === 0 ? 0 : part / whole)

const createFrameSample = (
  outcome: SimulatedPeerTransportFrameOutcome,
  bytes: number,
  direction: string,
  recordedByPeerId: string,
  seq: number,
  recordedAtMs: number,
  sampleId: number,
  latencyMs?: number,
  reason?: SimulatedPeerTransportDropReason
): SimulatedPeerTransportFrameSample => ({
  bytes,
  direction,
  latencyMs,
  outcome,
  reason,
  recordedByPeerId,
  recordedAtMs,
  sampleId,
  seq
})

const percentile = (samples: readonly number[], percentileValue: number): number => {
  if (samples.length === 0) return 0

  const sortedSamples = [...samples].sort((left, right) => left - right)
  const index = Math.min(
    sortedSamples.length - 1,
    Math.max(0, Math.ceil(sortedSamples.length * percentileValue) - 1)
  )
  return sortedSamples[index]
}

export const createSimulatedPeerTransportMetricsRecorder = (
  localPeerId: string,
  remotePeerId: string
): SimulatedPeerTransportMetricsRecorder => {
  let sentMessages = 0
  let deliveredMessages = 0
  let droppedMessages = 0
  let retransmittedMessages = 0
  let outOfOrderMessages = 0
  let sequenceGapMessages = 0
  let sentBytes = 0
  let deliveredBytes = 0
  let lostBytes = 0
  let retransmittedBytes = 0
  let maxMessageBytes = 0
  let totalLatencyMs = 0
  let maxLatencyMs = 0
  let totalLatencyJitterMs = 0
  let maxLatencyJitterMs = 0
  let latencyJitterSamples = 0
  let lastLatencyMs: number | undefined
  let lastDeliveredSeq: number | undefined
  let peakQueuedMessages = 0
  let nextSampleId = 0
  const latencySamples: number[] = []
  const recentFrames: SimulatedPeerTransportFrameSample[] = []

  const createPeerFrameSample = (
    outcome: SimulatedPeerTransportFrameOutcome,
    bytes: number,
    direction: string,
    seq: number,
    recordedAtMs: number,
    latencyMs?: number,
    reason?: SimulatedPeerTransportDropReason
  ): SimulatedPeerTransportFrameSample => {
    nextSampleId += 1
    return createFrameSample(
      outcome,
      bytes,
      direction,
      localPeerId,
      seq,
      recordedAtMs,
      nextSampleId,
      latencyMs,
      reason
    )
  }

  const recordFrameSample = (sample: SimulatedPeerTransportFrameSample): void => {
    recentFrames.push(sample)
    if (recentFrames.length > MAX_RECORDED_FRAME_SAMPLES) {
      recentFrames.shift()
    }
  }
  const outboundDirection = `${localPeerId}->${remotePeerId}`
  const inboundDirection = (fromPeerId: string): string => `${fromPeerId}->${localPeerId}`

  return {
    recordSent(bytes: number, seq: number, recordedAtMs: number): number {
      sentMessages += 1
      sentBytes += bytes
      maxMessageBytes = Math.max(maxMessageBytes, bytes)
      recordFrameSample(createPeerFrameSample('sent', bytes, outboundDirection, seq, recordedAtMs))
      return sentMessages
    },
    recordQueuedDepth(queuedMessages: number): void {
      peakQueuedMessages = Math.max(peakQueuedMessages, queuedMessages)
    },
    recordDropped(
      bytes: number,
      seq: number,
      reason: SimulatedPeerTransportDropReason,
      recordedAtMs: number
    ): void {
      droppedMessages += 1
      lostBytes += bytes
      recordFrameSample(
        createPeerFrameSample(
          'dropped',
          bytes,
          outboundDirection,
          seq,
          recordedAtMs,
          undefined,
          reason
        )
      )
    },
    recordRetransmitted(
      bytes: number,
      seq: number,
      recordedAtMs: number,
      fromPeerId: string
    ): void {
      retransmittedMessages += 1
      retransmittedBytes += bytes
      recordFrameSample(
        createPeerFrameSample(
          'retransmitted',
          bytes,
          inboundDirection(fromPeerId),
          seq,
          recordedAtMs
        )
      )
    },
    recordDelivered(
      bytes: number,
      latencyMs: number,
      seq: number,
      recordedAtMs: number,
      fromPeerId: string
    ): void {
      const normalizedLatencyMs = Math.max(0, latencyMs)
      if (typeof lastDeliveredSeq === 'number') {
        if (seq <= lastDeliveredSeq) {
          outOfOrderMessages += 1
        } else if (seq > lastDeliveredSeq + 1) {
          sequenceGapMessages += seq - lastDeliveredSeq - 1
        }
      }
      if (typeof lastDeliveredSeq !== 'number' || seq > lastDeliveredSeq) {
        lastDeliveredSeq = seq
      }
      deliveredMessages += 1
      deliveredBytes += bytes
      totalLatencyMs += normalizedLatencyMs
      maxLatencyMs = Math.max(maxLatencyMs, normalizedLatencyMs)
      if (typeof lastLatencyMs === 'number') {
        const latencyJitterMs = Math.abs(normalizedLatencyMs - lastLatencyMs)
        totalLatencyJitterMs += latencyJitterMs
        maxLatencyJitterMs = Math.max(maxLatencyJitterMs, latencyJitterMs)
        latencyJitterSamples += 1
      }
      lastLatencyMs = normalizedLatencyMs
      latencySamples.push(normalizedLatencyMs)
      if (latencySamples.length > MAX_RECORDED_LATENCY_SAMPLES) {
        latencySamples.shift()
      }
      recordFrameSample(
        createPeerFrameSample(
          'delivered',
          bytes,
          inboundDirection(fromPeerId),
          seq,
          recordedAtMs,
          normalizedLatencyMs
        )
      )
    },
    snapshot(queuedMessages: number): SimulatedPeerTransportMetrics {
      return {
        sentMessages,
        deliveredMessages,
        droppedMessages,
        retransmittedMessages,
        outOfOrderMessages,
        sequenceGapMessages,
        sentBytes,
        deliveredBytes,
        lostBytes,
        retransmittedBytes,
        deliveryRate: ratio(sentMessages - droppedMessages, sentMessages),
        byteLossRate: ratio(lostBytes, sentBytes),
        retransmissionRate: ratio(retransmittedMessages, deliveredMessages + droppedMessages),
        retransmissionByteRate: ratio(retransmittedBytes, deliveredBytes + lostBytes),
        averageMessageBytes: ratio(sentBytes, sentMessages),
        maxMessageBytes,
        averageLatencyMs: ratio(totalLatencyMs, deliveredMessages),
        averageLatencyJitterMs: ratio(totalLatencyJitterMs, latencyJitterSamples),
        p50LatencyMs: percentile(latencySamples, 0.5),
        p95LatencyMs: percentile(latencySamples, 0.95),
        maxLatencyMs,
        maxLatencyJitterMs,
        queuedMessages,
        peakQueuedMessages: Math.max(peakQueuedMessages, queuedMessages),
        recentFrames: recentFrames.slice()
      }
    }
  }
}

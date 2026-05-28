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
  recordDelivered(bytes: number, latencyMs: number, seq: number, recordedAtMs: number): void
  snapshot(queuedMessages: number): SimulatedPeerTransportMetrics
}

const ratio = (part: number, whole: number): number => (whole === 0 ? 0 : part / whole)

const createFrameSample = (
  outcome: SimulatedPeerTransportFrameOutcome,
  bytes: number,
  seq: number,
  recordedAtMs: number,
  latencyMs?: number,
  reason?: SimulatedPeerTransportDropReason
): SimulatedPeerTransportFrameSample => ({
  bytes,
  latencyMs,
  outcome,
  reason,
  recordedAtMs,
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

export const createSimulatedPeerTransportMetricsRecorder = (): SimulatedPeerTransportMetricsRecorder => {
  let sentMessages = 0
  let deliveredMessages = 0
  let droppedMessages = 0
  let sentBytes = 0
  let deliveredBytes = 0
  let lostBytes = 0
  let totalLatencyMs = 0
  let maxLatencyMs = 0
  let peakQueuedMessages = 0
  const latencySamples: number[] = []
  const recentFrames: SimulatedPeerTransportFrameSample[] = []

  const recordFrameSample = (sample: SimulatedPeerTransportFrameSample): void => {
    recentFrames.push(sample)
    if (recentFrames.length > MAX_RECORDED_FRAME_SAMPLES) {
      recentFrames.shift()
    }
  }

  return {
    recordSent(bytes: number, seq: number, recordedAtMs: number): number {
      sentMessages += 1
      sentBytes += bytes
      recordFrameSample(createFrameSample('sent', bytes, seq, recordedAtMs))
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
      recordFrameSample(createFrameSample('dropped', bytes, seq, recordedAtMs, undefined, reason))
    },
    recordDelivered(bytes: number, latencyMs: number, seq: number, recordedAtMs: number): void {
      const normalizedLatencyMs = Math.max(0, latencyMs)
      deliveredMessages += 1
      deliveredBytes += bytes
      totalLatencyMs += normalizedLatencyMs
      maxLatencyMs = Math.max(maxLatencyMs, normalizedLatencyMs)
      latencySamples.push(normalizedLatencyMs)
      if (latencySamples.length > MAX_RECORDED_LATENCY_SAMPLES) {
        latencySamples.shift()
      }
      recordFrameSample(
        createFrameSample('delivered', bytes, seq, recordedAtMs, normalizedLatencyMs)
      )
    },
    snapshot(queuedMessages: number): SimulatedPeerTransportMetrics {
      return {
        sentMessages,
        deliveredMessages,
        droppedMessages,
        sentBytes,
        deliveredBytes,
        lostBytes,
        deliveryRate: ratio(sentMessages - droppedMessages, sentMessages),
        byteLossRate: ratio(lostBytes, sentBytes),
        averageMessageBytes: ratio(sentBytes, sentMessages),
        averageLatencyMs: ratio(totalLatencyMs, deliveredMessages),
        p50LatencyMs: percentile(latencySamples, 0.5),
        p95LatencyMs: percentile(latencySamples, 0.95),
        maxLatencyMs,
        queuedMessages,
        peakQueuedMessages: Math.max(peakQueuedMessages, queuedMessages),
        recentFrames: recentFrames.slice()
      }
    }
  }
}

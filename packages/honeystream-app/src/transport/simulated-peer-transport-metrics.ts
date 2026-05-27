import { SimulatedPeerTransportMetrics } from './simulated-peer-transport-types'

export interface SimulatedPeerTransportMetricsRecorder {
  recordSent(bytes: number): number
  recordDropped(bytes: number): void
  recordDelivered(bytes: number, latencyMs: number): void
  snapshot(queuedMessages: number): SimulatedPeerTransportMetrics
}

const ratio = (part: number, whole: number): number => (whole === 0 ? 0 : part / whole)

export const createSimulatedPeerTransportMetricsRecorder = (): SimulatedPeerTransportMetricsRecorder => {
  let sentMessages = 0
  let deliveredMessages = 0
  let droppedMessages = 0
  let sentBytes = 0
  let deliveredBytes = 0
  let lostBytes = 0
  let totalLatencyMs = 0
  let maxLatencyMs = 0

  return {
    recordSent(bytes: number): number {
      sentMessages += 1
      sentBytes += bytes
      return sentMessages
    },
    recordDropped(bytes: number): void {
      droppedMessages += 1
      lostBytes += bytes
    },
    recordDelivered(bytes: number, latencyMs: number): void {
      const normalizedLatencyMs = Math.max(0, latencyMs)
      deliveredMessages += 1
      deliveredBytes += bytes
      totalLatencyMs += normalizedLatencyMs
      maxLatencyMs = Math.max(maxLatencyMs, normalizedLatencyMs)
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
        maxLatencyMs,
        queuedMessages
      }
    }
  }
}

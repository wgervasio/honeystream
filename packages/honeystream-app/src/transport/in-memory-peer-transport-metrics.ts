import { serializedByteLength } from './transport-byte-length'

export interface InMemoryPeerTransportMetrics {
  readonly sentMessages: number
  readonly deliveredMessages: number
  readonly sentBytes: number
  readonly deliveredBytes: number
  readonly averageLatencyMs: number
  readonly maxLatencyMs: number
}

export interface InMemoryPeerTransportMetricsRecorder {
  recordSent(envelope: unknown): void
  recordDelivered(envelope: unknown, latencyMs: number): void
  snapshot(): InMemoryPeerTransportMetrics
}

export const createInMemoryPeerTransportMetrics = (): InMemoryPeerTransportMetricsRecorder => {
  let sentMessages = 0
  let deliveredMessages = 0
  let sentBytes = 0
  let deliveredBytes = 0
  let totalLatencyMs = 0
  let maxLatencyMs = 0

  return {
    recordSent(envelope: unknown): void {
      sentMessages += 1
      sentBytes += serializedByteLength(envelope)
    },
    recordDelivered(envelope: unknown, latencyMs: number): void {
      const normalizedLatencyMs = Math.max(0, latencyMs)
      deliveredMessages += 1
      deliveredBytes += serializedByteLength(envelope)
      totalLatencyMs += normalizedLatencyMs
      maxLatencyMs = Math.max(maxLatencyMs, normalizedLatencyMs)
    },
    snapshot(): InMemoryPeerTransportMetrics {
      return {
        sentMessages,
        deliveredMessages,
        sentBytes,
        deliveredBytes,
        averageLatencyMs: deliveredMessages === 0 ? 0 : totalLatencyMs / deliveredMessages,
        maxLatencyMs
      }
    }
  }
}

import { PeerTransportEnvelope } from './contracts'
import { SimulatedPeerTransportMetricsRecorder } from './simulated-peer-transport-metrics'
import {
  resolveFrameLatencyMs,
  resolveMaxQueuedBytes,
  resolveMaxQueuedFrames,
  resolveRetransmitDelayMs,
  shouldRetransmitDroppedFrame,
  shouldDropFrame
} from './simulated-peer-transport-network'
import {
  Clock,
  PendingFrame,
  SimulatedPeerNetworkProfile,
  SimulatedPeerTransportEnqueueResult
} from './simulated-peer-transport-types'

export type SimulatedPeerTransportFrameDelivery<TMessage> = (
  frame: PendingFrame<TMessage>,
  receivedAtMs: number
) => void

export class SimulatedPeerTransportFrameQueue<TMessage> {
  private readonly frames: PendingFrame<TMessage>[] = []
  private queuedBytes = 0

  constructor(
    private readonly network: SimulatedPeerNetworkProfile,
    private readonly random: Clock,
    private readonly metrics: SimulatedPeerTransportMetricsRecorder
  ) {}

  get length(): number {
    return this.frames.length
  }

  clear(): void {
    this.frames.splice(0, this.frames.length)
    this.queuedBytes = 0
  }

  enqueue(
    envelope: PeerTransportEnvelope<TMessage>,
    fromPeerId: string,
    bytes: number,
    sentMessageCount: number,
    sentAtMs: number
  ): SimulatedPeerTransportEnqueueResult {
    const frameDropped = shouldDropFrame(sentMessageCount, this.network, this.random)
    if (frameDropped && !shouldRetransmitDroppedFrame(this.network)) {
      return { ok: false, reason: 'network-drop' }
    }

    if (this.frames.length >= resolveMaxQueuedFrames(this.network)) {
      return { ok: false, reason: 'queue-overflow' }
    }
    if (this.queuedBytes + bytes > resolveMaxQueuedBytes(this.network)) {
      return { ok: false, reason: 'queue-overflow' }
    }

    const retryDelayMs = frameDropped ? resolveRetransmitDelayMs(this.network) : 0
    if (frameDropped) {
      this.metrics.recordRetransmitted(bytes, envelope.seq, sentAtMs, fromPeerId)
    }
    const dueAtMs = sentAtMs + resolveFrameLatencyMs(this.network, this.random) + retryDelayMs
    this.frames.push({ dueAtMs, sentAtMs, bytes, fromPeerId, envelope })
    this.queuedBytes += bytes
    this.metrics.recordQueuedDepth(this.frames.length)
    return { ok: true }
  }

  flushReady(nowMs: number, deliverFrame: SimulatedPeerTransportFrameDelivery<TMessage>): number {
    let readyFrames = 0
    while (readyFrames < this.frames.length && this.frames[readyFrames].dueAtMs <= nowMs) {
      readyFrames += 1
    }
    if (readyFrames === 0) return 0

    const frames = this.frames.splice(0, readyFrames)
    for (const frame of frames) {
      this.queuedBytes = Math.max(0, this.queuedBytes - frame.bytes)
      deliverFrame(frame, nowMs)
    }
    return frames.length
  }

  flushAll(deliverFrame: SimulatedPeerTransportFrameDelivery<TMessage>): number {
    let delivered = 0
    while (this.frames.length > 0) {
      delivered += this.flushReady(this.frames[0].dueAtMs, deliverFrame)
    }
    return delivered
  }
}

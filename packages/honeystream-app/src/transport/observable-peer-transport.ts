import {
  PeerTransport,
  PeerTransportEnvelope,
  PeerTransportEvent,
  PeerTransportListener,
  PeerTransportMessageDelivery,
  TransportUnsubscribe
} from './contracts'
import { PeerTransportConnectionState, PeerTransportDisconnectReason } from './connection-state'
import { interpolatePercentile } from './latency-percentile'
import { serializedByteLength } from './transport-byte-length'

const DEFAULT_OBSERVATION_CAP = 64

type Clock = () => number

export type ObservablePeerTransportObservation<TInboundMessage, TOutboundMessage> =
  | {
      readonly type: 'sent'
      readonly atMs: number
      readonly bytes: number
      readonly envelope: PeerTransportEnvelope<TOutboundMessage>
      readonly localPeerId: string
      readonly remotePeerId: string
    }
  | {
      readonly type: 'received'
      readonly atMs: number
      readonly bytes: number
      readonly delivery: PeerTransportMessageDelivery<TInboundMessage>
      readonly latencyMs: number
      readonly localPeerId: string
      readonly remotePeerId: string
    }
  | {
      readonly type: 'state'
      readonly atMs: number
      readonly localPeerId: string
      readonly remotePeerId: string
      readonly state: PeerTransportConnectionState
    }
  | {
      readonly type: 'error'
      readonly atMs: number
      readonly code: string
      readonly localPeerId: string
      readonly message: string
      readonly remotePeerId: string
      readonly state: PeerTransportConnectionState['status']
    }

export interface ObservablePeerTransportSnapshot<TInboundMessage, TOutboundMessage> {
  readonly averageReceivedLatencyMs: number
  readonly maxReceivedFrameBytes: number
  readonly maxReceivedLatencyMs: number
  readonly maxSentFrameBytes: number
  readonly p95ReceivedLatencyMs: number
  readonly receivedBytes: number
  readonly receivedMessages: number
  readonly recentObservations: readonly ObservablePeerTransportObservation<TInboundMessage, TOutboundMessage>[]
  readonly sentBytes: number
  readonly sentMessages: number
}

export interface ObservablePeerTransportSendContext {
  readonly localPeerId: string
  readonly remotePeerId: string
}

export type ObservablePeerTransportSendInterceptor<TOutboundMessage> = (
  envelope: PeerTransportEnvelope<TOutboundMessage>,
  context: ObservablePeerTransportSendContext
) => PeerTransportEnvelope<TOutboundMessage>

export interface ObservablePeerTransportOptions<TInboundMessage, TOutboundMessage> {
  readonly beforeSend?: ObservablePeerTransportSendInterceptor<TOutboundMessage>
  readonly now?: Clock
  readonly observationCap?: number
  readonly transport: PeerTransport<TInboundMessage, TOutboundMessage>
}

const normalizeObservationCap = (value: number | undefined): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) {
    return DEFAULT_OBSERVATION_CAP
  }
  return Math.floor(value)
}

const ratio = (part: number, whole: number): number => (whole === 0 ? 0 : part / whole)

/*
Context: Tests and runtime diagnostics need the same bounded way to observe a host/guest lane.
Invariant: The wrapper never changes transport ownership; it records compact events and delegates.
Options considered: simulated-only metrics, unbounded debug logs, or a generic transport wrapper.
Decision: Wrap any PeerTransport with bounded observations and an optional typed send interceptor.
Performance impact: O(64) snapshot copies and O(1) record updates on control-message paths.
Memory/lifecycle ownership: ObservablePeerTransport owns one subscription and disposes the wrapped transport.
Failure mode: Interceptor or wrapped transport errors propagate to the caller instead of being hidden.
Validation: observable-peer-transport.spec.ts covers bounds, latency metrics, interception, and cleanup.
*/
export class ObservablePeerTransport<TInboundMessage, TOutboundMessage>
  implements PeerTransport<TInboundMessage, TOutboundMessage> {
  readonly localPeerId: string
  readonly remotePeerId: string
  private readonly beforeSend?: ObservablePeerTransportSendInterceptor<TOutboundMessage>
  private readonly now: Clock
  private readonly observationCap: number
  private readonly transport: PeerTransport<TInboundMessage, TOutboundMessage>
  private readonly unsubscribeTransport: TransportUnsubscribe
  private disposed = false
  private recentObservations: ObservablePeerTransportObservation<TInboundMessage, TOutboundMessage>[] = []
  private sentBytes = 0
  private sentMessages = 0
  private receivedBytes = 0
  private receivedMessages = 0
  private maxSentFrameBytes = 0
  private maxReceivedFrameBytes = 0
  private totalReceivedLatencyMs = 0
  private maxReceivedLatencyMs = 0
  private receivedLatencySamples: number[] = []

  constructor(options: ObservablePeerTransportOptions<TInboundMessage, TOutboundMessage>) {
    this.transport = options.transport
    this.localPeerId = options.transport.localPeerId
    this.remotePeerId = options.transport.remotePeerId
    this.beforeSend = options.beforeSend
    this.now = options.now || Date.now
    this.observationCap = normalizeObservationCap(options.observationCap)
    this.unsubscribeTransport = this.transport.subscribe(event => this.recordTransportEvent(event))
  }

  async connect(): Promise<void> { return this.transport.connect() }

  disconnect(reason?: PeerTransportDisconnectReason): void { this.transport.disconnect(reason) }

  getState(): PeerTransportConnectionState { return this.transport.getState() }

  send(envelope: PeerTransportEnvelope<TOutboundMessage>): void {
    if (this.disposed) {
      throw new Error(`[ObservablePeerTransport:${this.localPeerId}] send called after dispose`)
    }
    const outboundEnvelope = this.beforeSend
      ? this.beforeSend(envelope, { localPeerId: this.localPeerId, remotePeerId: this.remotePeerId })
      : envelope
    const bytes = serializedByteLength(outboundEnvelope)
    const atMs = this.now()
    this.transport.send(outboundEnvelope)
    this.sentMessages += 1
    this.sentBytes += bytes
    this.maxSentFrameBytes = Math.max(this.maxSentFrameBytes, bytes)
    this.recordObservation({
      type: 'sent',
      atMs,
      bytes,
      envelope: outboundEnvelope,
      localPeerId: this.localPeerId,
      remotePeerId: this.remotePeerId
    })
  }

  subscribe(listener: PeerTransportListener<TInboundMessage>): TransportUnsubscribe {
    return this.transport.subscribe(listener)
  }

  getObservationSnapshot(): ObservablePeerTransportSnapshot<TInboundMessage, TOutboundMessage> {
    return {
      averageReceivedLatencyMs: ratio(this.totalReceivedLatencyMs, this.receivedMessages),
      maxReceivedFrameBytes: this.maxReceivedFrameBytes,
      maxReceivedLatencyMs: this.maxReceivedLatencyMs,
      maxSentFrameBytes: this.maxSentFrameBytes,
      p95ReceivedLatencyMs: interpolatePercentile(this.receivedLatencySamples, 0.95),
      receivedBytes: this.receivedBytes,
      receivedMessages: this.receivedMessages,
      recentObservations: this.recentObservations.slice(),
      sentBytes: this.sentBytes,
      sentMessages: this.sentMessages
    }
  }

  dispose(): void {
    if (this.disposed) return
    try {
      this.transport.dispose()
    } finally {
      this.unsubscribeTransport()
      this.disposed = true
    }
  }

  private recordTransportEvent(event: PeerTransportEvent<TInboundMessage>): void {
    if (event.type === 'message') {
      this.recordReceivedDelivery(event.delivery)
      return
    }
    if (event.type === 'state') {
      this.recordObservation({
        type: 'state',
        atMs: this.now(),
        localPeerId: this.localPeerId,
        remotePeerId: this.remotePeerId,
        state: event.state
      })
      return
    }

    this.recordObservation({
      type: 'error',
      atMs: this.now(),
      code: event.error.code,
      localPeerId: this.localPeerId,
      message: event.error.message,
      remotePeerId: this.remotePeerId,
      state: this.transport.getState().status
    })
  }

  private recordReceivedDelivery(delivery: PeerTransportMessageDelivery<TInboundMessage>): void {
    const bytes = serializedByteLength(delivery.envelope)
    const latencyMs = Math.max(0, delivery.receivedAtMs - delivery.envelope.sentAtMs)
    this.receivedMessages += 1
    this.receivedBytes += bytes
    this.maxReceivedFrameBytes = Math.max(this.maxReceivedFrameBytes, bytes)
    this.totalReceivedLatencyMs += latencyMs
    this.maxReceivedLatencyMs = Math.max(this.maxReceivedLatencyMs, latencyMs)
    this.receivedLatencySamples.push(latencyMs)
    if (this.receivedLatencySamples.length > this.observationCap) {
      this.receivedLatencySamples = this.receivedLatencySamples.slice(-this.observationCap)
    }
    this.recordObservation({
      type: 'received',
      atMs: this.now(),
      bytes,
      delivery,
      latencyMs,
      localPeerId: this.localPeerId,
      remotePeerId: this.remotePeerId
    })
  }

  private recordObservation(
    observation: ObservablePeerTransportObservation<TInboundMessage, TOutboundMessage>
  ): void {
    this.recentObservations.push(observation)
    if (this.recentObservations.length > this.observationCap) {
      this.recentObservations = this.recentObservations.slice(-this.observationCap)
    }
  }
}

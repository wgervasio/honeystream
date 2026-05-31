import {
  PeerTransport,
  PeerTransportEnvelope,
  PeerTransportEvent,
  PeerTransportListener,
  TransportMessageValidator,
  TransportUnsubscribe,
  validatePeerTransportEnvelope
} from './contracts'
import {
  PeerTransportConnectionState,
  PeerTransportDisconnectReason,
  PeerTransportError
} from './connection-state'
import { createDisposableGroup } from './lifecycle'
import {
  createSimulatedPeerTransportMetricsRecorder,
  SimulatedPeerTransportMetricsRecorder
} from './simulated-peer-transport-metrics'
import { SimulatedPeerTransportFrameQueue } from './simulated-peer-transport-frame-queue'
import {
  byteLength,
  Clock,
  PendingFrame,
  SimulatedPeerTransportEnqueueResult,
  SimulatedPeerTransportMetrics,
  SimulatedPeerTransportOptions
} from './simulated-peer-transport-types'
import { connectingState, disconnectedState } from './simulated-peer-transport-state'

const resolveSendTimeMs = (clockNowMs: number, envelopeSentAtMs: number): number =>
  Number.isFinite(envelopeSentAtMs) ? Math.max(clockNowMs, envelopeSentAtMs) : clockNowMs

export class SimulatedPeerTransport<TInboundMessage, TOutboundMessage>
  implements PeerTransport<TInboundMessage, TOutboundMessage> {
  readonly localPeerId: string
  readonly remotePeerId: string
  private readonly inboundValidator: TransportMessageValidator<TInboundMessage>
  private readonly now: Clock
  private readonly metrics: SimulatedPeerTransportMetricsRecorder
  private readonly queue: SimulatedPeerTransportFrameQueue<TInboundMessage>
  private readonly listeners = new Set<PeerTransportListener<TInboundMessage>>()
  private readonly disposables = createDisposableGroup()
  private peer?: SimulatedPeerTransport<TOutboundMessage, TInboundMessage>
  private state: PeerTransportConnectionState
  private connectAttempt = 0
  private deliveryNowMs?: number

  constructor(options: SimulatedPeerTransportOptions<TInboundMessage>) {
    this.localPeerId = options.localPeerId
    this.remotePeerId = options.remotePeerId
    this.inboundValidator = options.inboundValidator
    this.now = options.now || Date.now
    this.metrics = createSimulatedPeerTransportMetricsRecorder(this.localPeerId, this.remotePeerId)
    this.queue = new SimulatedPeerTransportFrameQueue(
      options.network || {},
      options.random || Math.random,
      this.metrics
    )
    this.state = { status: 'idle', changedAtMs: this.now() }
  }

  linkPeer(peer: SimulatedPeerTransport<TOutboundMessage, TInboundMessage>): void {
    if (this.peer && this.peer !== peer) {
      throw new Error(`[SimulatedPeerTransport:${this.localPeerId}] peer link already configured`)
    }
    this.peer = peer
  }

  async connect(): Promise<void> {
    this.ensureNotDisposed('connect')
    if (this.state.status === 'connected') return
    const peer = this.requirePeer()
    this.connectAttempt += 1
    this.updateState(connectingState(this.now(), this.connectAttempt))
    this.markConnected(peer.localPeerId)
    peer.markConnected(this.localPeerId)
  }

  disconnect(reason: PeerTransportDisconnectReason = 'manual'): void {
    if (this.state.status === 'disposed') return
    const wasActive = this.state.status === 'connecting' || this.state.status === 'connected'
    this.queue.clear()
    this.updateState(disconnectedState(this.now(), this.remotePeerId, reason))
    if (wasActive && this.peer && this.peer.state.status !== 'disposed') {
      this.peer.onRemoteDisconnect('peer-disconnected')
    }
  }

  getState(): PeerTransportConnectionState {
    return this.state
  }

  getMetrics(): SimulatedPeerTransportMetrics {
    return this.metrics.snapshot(this.queue.length, this.queue.bytes)
  }

  send(envelope: PeerTransportEnvelope<TOutboundMessage>): void {
    this.ensureCanSend()
    const peer = this.requirePeer()
    const sentAtMs = resolveSendTimeMs(this.currentTimeMs(), envelope.sentAtMs)
    const outboundEnvelope: PeerTransportEnvelope<TOutboundMessage> =
      envelope.sentAtMs === sentAtMs ? envelope : { ...envelope, sentAtMs }
    const bytes = byteLength(outboundEnvelope)
    const sentMessageCount = this.metrics.recordSent(bytes, envelope.seq, sentAtMs)
    const enqueueResult = peer.enqueueFrame(
      outboundEnvelope,
      this.localPeerId,
      bytes,
      sentMessageCount,
      sentAtMs
    )
    if (!enqueueResult.ok) {
      this.metrics.recordDropped(bytes, envelope.seq, enqueueResult.reason, sentAtMs)
    }
  }

  flushReady(nowMs: number = this.now()): number {
    return this.queue.flushReady(nowMs, (frame, receivedAtMs) =>
      this.deliverFrame(frame, receivedAtMs)
    )
  }

  flushAll(): number {
    return this.queue.flushAll((frame, receivedAtMs) => this.deliverFrame(frame, receivedAtMs))
  }

  subscribe(listener: PeerTransportListener<TInboundMessage>): TransportUnsubscribe {
    this.ensureNotDisposed('subscribe')
    this.listeners.add(listener)
    const unsubscribe: TransportUnsubscribe = () => {
      this.listeners.delete(listener)
    }
    this.disposables.add(unsubscribe)
    return unsubscribe
  }

  dispose(): void {
    if (this.state.status === 'disposed') return
    const wasActive = this.state.status === 'connecting' || this.state.status === 'connected'
    if (wasActive) this.disconnect('disposed')
    this.queue.clear()
    this.updateState({ status: 'disposed', changedAtMs: this.now() })
    this.disposables.dispose()
    this.listeners.clear()
    this.peer = undefined
  }

  private enqueueFrame(
    envelope: PeerTransportEnvelope<TInboundMessage>,
    fromPeerId: string,
    bytes: number,
    sentMessageCount: number,
    sentAtMs: number
  ): SimulatedPeerTransportEnqueueResult {
    if (this.state.status !== 'connected') return { ok: false, reason: 'peer-disconnected' }
    return this.queue.enqueue(envelope, fromPeerId, bytes, sentMessageCount, sentAtMs)
  }

  private deliverFrame(frame: PendingFrame<TInboundMessage>, receivedAtMs: number): void {
    if (this.state.status !== 'connected') return
    const validatedEnvelope = validatePeerTransportEnvelope(frame.envelope, this.inboundValidator)
    if (!validatedEnvelope.ok) {
      this.fail(validatedEnvelope.code, validatedEnvelope.reason)
      return
    }
    const latencyMs = Math.max(0, receivedAtMs - frame.sentAtMs)
    this.metrics.recordDelivered(
      frame.bytes,
      latencyMs,
      frame.envelope.seq,
      receivedAtMs,
      frame.fromPeerId
    )
    const previousDeliveryNowMs = this.deliveryNowMs
    this.deliveryNowMs = receivedAtMs
    try {
      this.emit({
        type: 'message',
        delivery: {
          envelope: validatedEnvelope.envelope,
          fromPeerId: frame.fromPeerId,
          receivedAtMs
        }
      })
    } finally {
      this.deliveryNowMs = previousDeliveryNowMs
    }
  }

  private fail(code: PeerTransportError['code'], message: string): void {
    const error: PeerTransportError = { code, message }
    this.updateState({
      status: 'failed',
      changedAtMs: this.now(),
      peerId: this.remotePeerId,
      reason:
        code === 'validation-failed' || code === 'invalid-envelope'
          ? 'validation-failed'
          : 'transport-error',
      error
    })
    this.emit({ type: 'error', error })
    if (this.peer && this.peer.state.status !== 'disposed') {
      this.peer.onRemoteDisconnect('peer-disconnected')
    }
  }

  private markConnected(peerId: string): void {
    if (this.state.status !== 'disposed') {
      this.updateState({ status: 'connected', changedAtMs: this.now(), peerId })
    }
  }

  private onRemoteDisconnect(reason: PeerTransportDisconnectReason): void {
    if (this.state.status !== 'disposed') {
      this.queue.clear()
      this.updateState(disconnectedState(this.now(), this.remotePeerId, reason))
    }
  }

  private updateState(state: PeerTransportConnectionState): void {
    this.state = state
    this.emit({ type: 'state', state })
  }

  private emit(event: PeerTransportEvent<TInboundMessage>): void {
    const listeners = Array.from(this.listeners)
    for (const listener of listeners) listener(event)
  }

  private ensureCanSend(): void {
    this.ensureNotDisposed('send')
    if (this.state.status !== 'connected') {
      throw this.createTransportUsageError('not-connected', 'cannot send while disconnected')
    }
  }

  private requirePeer(): SimulatedPeerTransport<TOutboundMessage, TInboundMessage> {
    if (!this.peer) throw this.createTransportUsageError('peer-unavailable', 'peer is not linked')
    return this.peer
  }

  private ensureNotDisposed(action: string): void {
    if (this.state.status === 'disposed') {
      throw this.createTransportUsageError('disposed', `${action} called after dispose`)
    }
  }

  private currentTimeMs(): number {
    return typeof this.deliveryNowMs === 'number' ? this.deliveryNowMs : this.now()
  }

  private createTransportUsageError(code: PeerTransportError['code'], message: string): Error {
    return new Error(`[SimulatedPeerTransport:${this.localPeerId}] [${code}] ${message}`)
  }
}

import { PeerTransport, PeerTransportEnvelope, PeerTransportEvent, PeerTransportListener, TransportMessageValidator, TransportUnsubscribe, validatePeerTransportEnvelope } from './contracts'
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
import {
  resolveFrameLatencyMs,
  resolveMaxQueuedFrames,
  shouldDropFrame
} from './simulated-peer-transport-network'
import {
  byteLength,
  Clock,
  PendingFrame,
  SimulatedPeerNetworkProfile,
  SimulatedPeerTransportEnqueueResult,
  SimulatedPeerTransportMetrics,
  SimulatedPeerTransportOptions
} from './simulated-peer-transport-types'
export class SimulatedPeerTransport<TInboundMessage, TOutboundMessage>
  implements PeerTransport<TInboundMessage, TOutboundMessage> {
  readonly localPeerId: string
  readonly remotePeerId: string
  private readonly inboundValidator: TransportMessageValidator<TInboundMessage>
  private readonly now: Clock
  private readonly random: Clock
  private readonly network: SimulatedPeerNetworkProfile
  private readonly metrics: SimulatedPeerTransportMetricsRecorder
  private readonly listeners = new Set<PeerTransportListener<TInboundMessage>>()
  private readonly disposables = createDisposableGroup()
  private readonly pendingFrames: PendingFrame<TInboundMessage>[] = []
  private peer?: SimulatedPeerTransport<TOutboundMessage, TInboundMessage>
  private state: PeerTransportConnectionState
  private connectAttempt = 0

  constructor(options: SimulatedPeerTransportOptions<TInboundMessage>) {
    this.localPeerId = options.localPeerId
    this.remotePeerId = options.remotePeerId
    this.inboundValidator = options.inboundValidator
    this.now = options.now || Date.now
    this.random = options.random || Math.random
    this.network = options.network || {}
    this.metrics = createSimulatedPeerTransportMetricsRecorder(this.localPeerId, this.remotePeerId)
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
    this.updateState({
      status: 'connecting',
      changedAtMs: this.now(),
      attempt: this.connectAttempt
    })
    this.markConnected(peer.localPeerId)
    peer.markConnected(this.localPeerId)
  }

  disconnect(reason: PeerTransportDisconnectReason = 'manual'): void {
    if (this.state.status === 'disposed') return
    const wasActive = this.state.status === 'connecting' || this.state.status === 'connected'
    this.pendingFrames.splice(0, this.pendingFrames.length)
    this.updateState({
      status: 'disconnected',
      changedAtMs: this.now(),
      peerId: this.remotePeerId,
      reason
    })
    if (wasActive && this.peer && this.peer.state.status !== 'disposed') {
      this.peer.onRemoteDisconnect('peer-disconnected')
    }
  }

  getState(): PeerTransportConnectionState {
    return this.state
  }

  getMetrics(): SimulatedPeerTransportMetrics {
    return this.metrics.snapshot(this.pendingFrames.length)
  }

  send(envelope: PeerTransportEnvelope<TOutboundMessage>): void {
    this.ensureCanSend()
    const peer = this.requirePeer()
    const bytes = byteLength(envelope)
    const sentMessageCount = this.metrics.recordSent(bytes, envelope.seq, envelope.sentAtMs)
    const enqueueResult = peer.enqueueFrame(envelope, this.localPeerId, bytes, sentMessageCount)
    if (!enqueueResult.ok) {
      this.metrics.recordDropped(bytes, envelope.seq, enqueueResult.reason, this.now())
    }
  }

  flushReady(nowMs: number = this.now()): number {
    let readyFrames = 0
    while (
      readyFrames < this.pendingFrames.length &&
      this.pendingFrames[readyFrames].dueAtMs <= nowMs
    ) {
      readyFrames += 1
    }
    if (readyFrames === 0) return 0

    const frames = this.pendingFrames.splice(0, readyFrames)
    for (const frame of frames) this.deliverFrame(frame, nowMs)
    return frames.length
  }

  flushAll(): number {
    let delivered = 0
    while (this.pendingFrames.length > 0) {
      delivered += this.flushReady(this.pendingFrames[0].dueAtMs)
    }
    return delivered
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
    this.pendingFrames.splice(0, this.pendingFrames.length)
    this.updateState({ status: 'disposed', changedAtMs: this.now() })
    this.disposables.dispose()
    this.listeners.clear()
    this.peer = undefined
  }

  private enqueueFrame(
    envelope: PeerTransportEnvelope<TInboundMessage>,
    fromPeerId: string,
    bytes: number,
    sentMessageCount: number
  ): SimulatedPeerTransportEnqueueResult {
    if (this.state.status !== 'connected') return { ok: false, reason: 'peer-disconnected' }
    if (shouldDropFrame(sentMessageCount, this.network, this.random))
      return { ok: false, reason: 'network-drop' }
    if (this.pendingFrames.length >= resolveMaxQueuedFrames(this.network))
      return { ok: false, reason: 'queue-overflow' }
    const sentAtMs = this.now()
    const dueAtMs = sentAtMs + resolveFrameLatencyMs(this.network, this.random)
    this.pendingFrames.push({ dueAtMs, sentAtMs, bytes, fromPeerId, envelope })
    this.metrics.recordQueuedDepth(this.pendingFrames.length)
    return { ok: true }
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
      frame.bytes, latencyMs, frame.envelope.seq, receivedAtMs, frame.fromPeerId
    )
    this.emit({
      type: 'message',
      delivery: {
        envelope: validatedEnvelope.envelope,
        fromPeerId: frame.fromPeerId,
        receivedAtMs
      }
    })
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
      this.pendingFrames.splice(0, this.pendingFrames.length)
      this.updateState({
        status: 'disconnected',
        changedAtMs: this.now(),
        peerId: this.remotePeerId,
        reason
      })
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

  private createTransportUsageError(code: PeerTransportError['code'], message: string): Error {
    return new Error(`[SimulatedPeerTransport:${this.localPeerId}] [${code}] ${message}`)
  }
}

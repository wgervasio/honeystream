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
  PeerTransportError,
  PeerTransportErrorCode
} from './connection-state'
import { createDisposableGroup } from './lifecycle'

type Clock = () => number

export interface InMemoryPeerTransportOptions<TInboundMessage> {
  readonly localPeerId: string
  readonly remotePeerId: string
  readonly inboundValidator: TransportMessageValidator<TInboundMessage>
  readonly now?: Clock
}

export class InMemoryPeerTransport<TInboundMessage, TOutboundMessage>
  implements PeerTransport<TInboundMessage, TOutboundMessage> {
  readonly localPeerId: string
  readonly remotePeerId: string

  private readonly inboundValidator: TransportMessageValidator<TInboundMessage>
  private readonly now: Clock
  private readonly listeners = new Set<PeerTransportListener<TInboundMessage>>()
  private readonly disposables = createDisposableGroup()
  private state: PeerTransportConnectionState
  private connectAttempt: number = 0
  private peer?: InMemoryPeerTransport<TOutboundMessage, TInboundMessage>

  constructor(options: InMemoryPeerTransportOptions<TInboundMessage>) {
    this.localPeerId = options.localPeerId
    this.remotePeerId = options.remotePeerId
    this.inboundValidator = options.inboundValidator
    this.now = options.now || Date.now
    this.state = {
      status: 'idle',
      changedAtMs: this.now()
    }
  }

  linkPeer(peer: InMemoryPeerTransport<TOutboundMessage, TInboundMessage>): void {
    if (this.peer && this.peer !== peer) {
      throw new Error(`[InMemoryPeerTransport:${this.localPeerId}] peer link already configured`)
    }

    this.peer = peer
  }

  async connect(): Promise<void> {
    this.ensureNotDisposed('connect')
    if (this.state.status === 'connected') {
      return
    }

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
    if (this.state.status === 'disposed') {
      return
    }

    const wasActive = this.state.status === 'connecting' || this.state.status === 'connected'
    this.updateState({
      status: 'disconnected',
      changedAtMs: this.now(),
      peerId: this.remotePeerId,
      reason
    })

    if (!wasActive || !this.peer || this.peer.state.status === 'disposed') {
      return
    }

    this.peer.onRemoteDisconnect('peer-disconnected')
  }

  getState(): PeerTransportConnectionState {
    return this.state
  }

  send(envelope: PeerTransportEnvelope<TOutboundMessage>): void {
    this.ensureNotDisposed('send')
    if (this.state.status !== 'connected') {
      throw this.createTransportUsageError('not-connected', 'cannot send while disconnected')
    }

    const peer = this.requirePeer()
    peer.receiveEnvelope(envelope, this.localPeerId)
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
    if (this.state.status === 'disposed') {
      return
    }

    const wasActive = this.state.status === 'connecting' || this.state.status === 'connected'
    if (wasActive) {
      this.disconnect('disposed')
    }

    this.updateState({
      status: 'disposed',
      changedAtMs: this.now()
    })

    this.disposables.dispose()
    this.listeners.clear()
    this.peer = undefined
  }

  private markConnected(peerId: string): void {
    if (this.state.status === 'disposed') {
      return
    }

    this.updateState({
      status: 'connected',
      changedAtMs: this.now(),
      peerId
    })
  }

  private onRemoteDisconnect(reason: PeerTransportDisconnectReason): void {
    if (this.state.status === 'disposed') {
      return
    }

    this.updateState({
      status: 'disconnected',
      changedAtMs: this.now(),
      peerId: this.remotePeerId,
      reason
    })
  }

  private receiveEnvelope(rawEnvelope: unknown, fromPeerId: string): void {
    if (this.state.status !== 'connected') {
      this.fail('not-connected', `received message while ${this.state.status}`)
      return
    }

    const validatedEnvelope = validatePeerTransportEnvelope(rawEnvelope, this.inboundValidator)
    if (!validatedEnvelope.ok) {
      this.fail(validatedEnvelope.code, validatedEnvelope.reason)
      return
    }

    const event: PeerTransportEvent<TInboundMessage> = {
      type: 'message',
      delivery: {
        envelope: validatedEnvelope.envelope,
        fromPeerId,
        receivedAtMs: this.now()
      }
    }
    this.emit(event)
  }

  private fail(code: PeerTransportErrorCode, message: string): void {
    if (this.state.status === 'disposed') {
      return
    }

    const error: PeerTransportError = { code, message }
    const reason: PeerTransportDisconnectReason =
      code === 'validation-failed' || code === 'invalid-envelope'
        ? 'validation-failed'
        : 'transport-error'

    this.updateState({
      status: 'failed',
      changedAtMs: this.now(),
      peerId: this.remotePeerId,
      reason,
      error
    })
    this.emit({
      type: 'error',
      error
    })

    if (this.peer && this.peer.state.status !== 'disposed') {
      this.peer.onRemoteDisconnect('peer-disconnected')
    }
  }

  private updateState(state: PeerTransportConnectionState): void {
    this.state = state
    this.emit({
      type: 'state',
      state
    })
  }

  private emit(event: PeerTransportEvent<TInboundMessage>): void {
    const listeners = Array.from(this.listeners)
    for (const listener of listeners) {
      listener(event)
    }
  }

  private requirePeer(): InMemoryPeerTransport<TOutboundMessage, TInboundMessage> {
    if (!this.peer) {
      throw this.createTransportUsageError('peer-unavailable', 'peer is not linked')
    }

    return this.peer
  }

  private ensureNotDisposed(action: string): void {
    if (this.state.status === 'disposed') {
      throw this.createTransportUsageError('disposed', `${action} called after dispose`)
    }
  }

  private createTransportUsageError(code: PeerTransportErrorCode, message: string): Error {
    return new Error(`[InMemoryPeerTransport:${this.localPeerId}] [${code}] ${message}`)
  }
}

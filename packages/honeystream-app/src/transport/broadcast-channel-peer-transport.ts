import { PeerTransport, PeerTransportEnvelope, PeerTransportEvent, PeerTransportListener, TransportMessageValidator, TransportUnsubscribe, validatePeerTransportEnvelope } from './contracts'
import { PeerTransportConnectionState, PeerTransportDisconnectReason, PeerTransportError, PeerTransportErrorCode } from './connection-state'
import { BroadcastControlMessage, BroadcastRole, isBroadcastMessage } from './broadcast-channel-message'
type Clock = () => number
export interface BroadcastChannelPeerTransportOptions<TInboundMessage> {
  readonly roomId: string
  readonly role: BroadcastRole
  readonly localPeerId: string
  readonly remotePeerIdHint: string
  readonly inboundValidator: TransportMessageValidator<TInboundMessage>
  readonly now?: Clock
  readonly connectTimeoutMs?: number
}
const DEFAULT_CONNECT_TIMEOUT_MS = 5000
const HELLO_INTERVAL_MS = 250

export class BroadcastChannelPeerTransport<TInboundMessage, TOutboundMessage>
  implements PeerTransport<TInboundMessage, TOutboundMessage> {
  readonly localPeerId: string

  private readonly roomId: string
  private readonly role: BroadcastRole
  private readonly inboundValidator: TransportMessageValidator<TInboundMessage>
  private readonly now: Clock
  private readonly connectTimeoutMs: number
  private readonly listeners = new Set<PeerTransportListener<TInboundMessage>>()

  private remotePeerIdValue: string
  private state: PeerTransportConnectionState
  private connectAttempt = 0
  private channel?: BroadcastChannel
  private helloTimer?: ReturnType<typeof setInterval>
  private connectTimer?: ReturnType<typeof setTimeout>
  private connectingPromise?: Promise<void>
  private connectResolve?: () => void
  private connectReject?: (error: Error) => void

  constructor(options: BroadcastChannelPeerTransportOptions<TInboundMessage>) {
    this.roomId = options.roomId
    this.role = options.role
    this.localPeerId = options.localPeerId
    this.remotePeerIdValue = options.remotePeerIdHint
    this.inboundValidator = options.inboundValidator
    this.now = options.now || Date.now
    this.connectTimeoutMs = options.connectTimeoutMs || DEFAULT_CONNECT_TIMEOUT_MS
    this.state = { status: 'idle', changedAtMs: this.now() }
  }

  get remotePeerId(): string {
    return this.remotePeerIdValue
  }

  connect(): Promise<void> {
    this.ensureNotDisposed('connect')
    if (this.state.status === 'connected') return Promise.resolve()
    if (this.state.status === 'connecting' && this.connectingPromise) {
      return this.connectingPromise
    }
    this.connectAttempt += 1
    this.updateState({ status: 'connecting', changedAtMs: this.now(), attempt: this.connectAttempt })
    this.openChannel()
    this.connectingPromise =
      this.role === 'guest'
        ? new Promise((resolve, reject) => {
            this.connectResolve = resolve
            this.connectReject = reject
            this.connectTimer = setTimeout(() => {
              this.fail('peer-unavailable', 'Network error: session host was not found.')
            }, this.connectTimeoutMs)
          })
        : Promise.resolve()
    this.startHelloLoop()
    this.postControl('hello')

    return this.connectingPromise
  }

  disconnect(reason: PeerTransportDisconnectReason = 'manual'): void {
    if (this.state.status === 'disposed') return
    this.postControl('leave')
    this.stopConnectTimers(
      this.state.status === 'connecting'
        ? new Error('Connection disconnected before the browser handshake completed.')
        : undefined
    )
    this.closeChannel()
    this.updateState({
      status: 'disconnected',
      changedAtMs: this.now(),
      peerId: this.remotePeerIdValue,
      reason
    })
  }

  getState(): PeerTransportConnectionState {
    return this.state
  }

  send(envelope: PeerTransportEnvelope<TOutboundMessage>): void {
    this.ensureNotDisposed('send')
    if (this.state.status !== 'connected') {
      this.raiseUsageError('not-connected', `cannot send while ${this.state.status}`)
    }
    this.openChannel()
    this.channel!.postMessage({
      kind: 'data',
      roomId: this.roomId,
      fromPeerId: this.localPeerId,
      toPeerId: this.remotePeerIdValue,
      envelope
    })
  }

  subscribe(listener: PeerTransportListener<TInboundMessage>): TransportUnsubscribe {
    this.ensureNotDisposed('subscribe')
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  dispose(): void {
    if (this.state.status === 'disposed') return
    this.postControl('leave')
    this.stopConnectTimers(
      this.state.status === 'connecting'
        ? new Error('Connection disposed before the browser handshake completed.')
        : undefined
    )
    this.closeChannel()
    this.listeners.clear()
    this.updateState({ status: 'disposed', changedAtMs: this.now() })
  }

  private openChannel(): void {
    if (this.channel) return
    if (typeof BroadcastChannel === 'undefined') {
      this.raiseUsageError('peer-unavailable', 'Network error: BroadcastChannel is unavailable.')
    }
    this.channel = new BroadcastChannel(`honeystream-runtime-e2e:${this.roomId}`)
    this.channel.onmessage = event => this.receiveBroadcastMessage(event.data)
  }

  private startHelloLoop(): void {
    this.stopHelloLoop()
    this.helloTimer = setInterval(() => this.postControl('hello'), HELLO_INTERVAL_MS)
  }

  private stopHelloLoop(): void {
    if (!this.helloTimer) return
    clearInterval(this.helloTimer)
    this.helloTimer = undefined
  }

  private stopConnectTimers(rejection?: Error): void {
    const reject = this.connectReject
    this.stopHelloLoop()
    if (this.connectTimer) {
      clearTimeout(this.connectTimer)
      this.connectTimer = undefined
    }
    this.connectingPromise = undefined
    this.connectResolve = undefined
    this.connectReject = undefined
    if (rejection && reject) reject(rejection)
  }

  private closeChannel(): void {
    if (!this.channel) return
    this.channel.onmessage = null
    this.channel.close()
    this.channel = undefined
  }

  private postControl(kind: BroadcastControlMessage['kind']): void {
    if (!this.channel) return
    this.channel.postMessage({ kind, roomId: this.roomId, role: this.role, fromPeerId: this.localPeerId })
  }

  private receiveBroadcastMessage(value: unknown): void {
    if (!isBroadcastMessage(value) || value.roomId !== this.roomId || value.fromPeerId === this.localPeerId) return
    switch (value.kind) {
      case 'hello':
        if (this.role === value.role) return
        const alreadyConnected =
          this.state.status === 'connected' && this.remotePeerIdValue === value.fromPeerId
        this.remotePeerIdValue = value.fromPeerId
        this.markConnected(value.fromPeerId)
        if (!alreadyConnected) this.postControl('hello')
        return
      case 'leave':
        if (value.fromPeerId === this.remotePeerIdValue && this.state.status !== 'disconnected') {
          this.stopConnectTimers()
          this.updateState({ status: 'disconnected', changedAtMs: this.now(), peerId: this.remotePeerIdValue, reason: 'peer-disconnected' })
        }
        return
      case 'data':
        if (value.toPeerId !== this.localPeerId) return
        this.receiveEnvelope(value.envelope, value.fromPeerId)
    }
  }

  private receiveEnvelope(rawEnvelope: unknown, fromPeerId: string): void {
    const validatedEnvelope = validatePeerTransportEnvelope(rawEnvelope, this.inboundValidator)
    if (!validatedEnvelope.ok) {
      this.fail(validatedEnvelope.code, validatedEnvelope.reason)
      return
    }
    this.emit({
      type: 'message',
      delivery: { envelope: validatedEnvelope.envelope, fromPeerId, receivedAtMs: this.now() }
    })
  }

  private markConnected(peerId: string): void {
    if (this.state.status === 'disposed') return
    const resolve = this.connectResolve
    this.stopConnectTimers()
    this.updateState({ status: 'connected', changedAtMs: this.now(), peerId })
    if (resolve) resolve()
  }

  private fail(code: PeerTransportErrorCode, message: string): void {
    if (this.state.status === 'disposed') return
    const error: PeerTransportError = { code, message }
    const reject = this.connectReject
    this.stopConnectTimers()
    this.updateState({ status: 'failed', changedAtMs: this.now(), peerId: this.remotePeerIdValue, reason: 'transport-error', error })
    this.emit({ type: 'error', error })
    this.closeChannel()
    if (reject) reject(new Error(message))
  }

  private ensureNotDisposed(action: string): void {
    if (this.state.status === 'disposed') this.raiseUsageError('disposed', `${action} called after dispose`)
  }

  private raiseUsageError(code: PeerTransportErrorCode, message: string): never {
    this.emit({ type: 'error', error: { code, message } })
    throw new Error(`[BroadcastChannelPeerTransport:${this.localPeerId}] [${code}] ${message}`)
  }

  private updateState(state: PeerTransportConnectionState): void {
    this.state = state
    this.emit({ type: 'state', state })
  }

  private emit(event: PeerTransportEvent<TInboundMessage>): void {
    for (const listener of Array.from(this.listeners)) listener(event)
  }
}

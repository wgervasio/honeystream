import { PeerTransport, PeerTransportEnvelope, PeerTransportEvent, PeerTransportListener, TransportMessageValidator, TransportUnsubscribe, validatePeerTransportEnvelope } from './contracts'
import {
  PeerTransportConnectionState,
  PeerTransportDisconnectReason,
  PeerTransportError,
  PeerTransportErrorCode,
  toPeerTransportDisconnectReason
} from './connection-state'
import {
  E2EWebSocketPeerTransportOptions,
  isRecord,
  parseRelayMessage,
  toRelayUrl
} from './e2e-websocket-peer-transport-protocol'

const DEFAULT_CONNECT_TIMEOUT_MS = 15000

export class E2EWebSocketPeerTransport<TInboundMessage, TOutboundMessage> implements PeerTransport<TInboundMessage, TOutboundMessage> {
  readonly localPeerId: string
  private readonly inboundValidator: TransportMessageValidator<TInboundMessage>
  private readonly now: () => number
  private readonly relayUrl: string
  private readonly role: E2EWebSocketPeerTransportOptions<TInboundMessage>['role']
  private readonly listeners = new Set<PeerTransportListener<TInboundMessage>>()
  private readonly connectTimeoutMs: number

  private remotePeerIdValue: string
  private state: PeerTransportConnectionState
  private connectAttempt = 0
  private socket?: WebSocket
  private connectTimer?: ReturnType<typeof setTimeout>
  private connectingPromise?: Promise<void>
  private connectResolve?: () => void
  private connectReject?: (error: Error) => void
  constructor(options: E2EWebSocketPeerTransportOptions<TInboundMessage>) {
    this.localPeerId = options.localPeerId
    this.remotePeerIdValue = options.remotePeerIdHint
    this.inboundValidator = options.inboundValidator
    this.now = options.now || Date.now
    this.role = options.role
    this.relayUrl = toRelayUrl(options)
    this.connectTimeoutMs = options.connectTimeoutMs || DEFAULT_CONNECT_TIMEOUT_MS
    this.state = { status: 'idle', changedAtMs: this.now() }
  }

  get remotePeerId(): string {
    return this.remotePeerIdValue
  }

  connect(): Promise<void> {
    this.ensureNotDisposed('connect')
    if (this.state.status === 'connected') return Promise.resolve()
    if (this.state.status === 'connecting' && this.connectingPromise) return this.connectingPromise

    this.connectAttempt += 1
    this.updateState({
      status: 'connecting',
      changedAtMs: this.now(),
      attempt: this.connectAttempt
    })
    if (this.role === 'guest') {
      this.connectingPromise = new Promise((resolve, reject) => {
        this.connectResolve = resolve
        this.connectReject = reject
        this.connectTimer = setTimeout(() => {
          this.fail('peer-unavailable', 'Network error: e2e relay peer was not found.')
        }, this.connectTimeoutMs)
      })
    }

    this.openSocket()
    return this.connectingPromise || Promise.resolve()
  }

  disconnect(reason: PeerTransportDisconnectReason = 'manual'): void {
    if (this.state.status === 'disposed') return
    this.stopConnectTimer(
      this.state.status === 'connecting'
        ? new Error('Connection disconnected before the e2e relay handshake completed.')
        : undefined
    )
    this.closeSocket()
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
    if (
      this.state.status !== 'connected' ||
      !this.socket ||
      this.socket.readyState !== WebSocket.OPEN
    ) {
      this.raiseUsageError('not-connected', `cannot send while ${this.state.status}`)
    }
    this.socket.send(
      JSON.stringify({ kind: 'data', toPeerId: this.remotePeerIdValue, envelope })
    )
  }

  subscribe(listener: PeerTransportListener<TInboundMessage>): TransportUnsubscribe {
    this.ensureNotDisposed('subscribe')
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  dispose(): void {
    if (this.state.status === 'disposed') return
    this.stopConnectTimer(
      this.state.status === 'connecting'
        ? new Error('Connection disposed before the e2e relay handshake completed.')
        : undefined
    )
    this.closeSocket()
    this.listeners.clear()
    this.updateState({ status: 'disposed', changedAtMs: this.now() })
  }

  private openSocket(): void {
    if (this.socket) return
    this.socket = new WebSocket(this.relayUrl)
    this.socket.onmessage = event => this.receiveRelayMessage(event.data)
    this.socket.onerror = () => this.fail('peer-unavailable', 'Network error: e2e relay failed.')
    this.socket.onclose = () => {
      if (this.state.status !== 'disposed' && this.state.status !== 'failed') {
        this.disconnect('peer-disconnected')
      }
    }
  }

  private closeSocket(): void {
    if (!this.socket) return
    this.socket.onmessage = null
    this.socket.onerror = null
    this.socket.onclose = null
    if (
      this.socket.readyState === WebSocket.OPEN ||
      this.socket.readyState === WebSocket.CONNECTING
    ) {
      this.socket.close()
    }
    this.socket = undefined
  }

  private receiveRelayMessage(value: unknown): void {
    const parsedMessage = parseRelayMessage(value)
    if (!parsedMessage.ok) return this.fail('invalid-envelope', parsedMessage.reason)
    const message = parsedMessage.value
    if (!isRecord(message) || typeof message.kind !== 'string') {
      this.fail('invalid-envelope', 'E2E relay message must be an object with a kind.')
      return
    }

    if (message.kind === 'peer' && typeof message.peerId === 'string') {
      this.markConnected(message.peerId)
      return
    }
    if (message.kind === 'leave' && typeof message.peerId === 'string') {
      if (message.peerId === this.remotePeerIdValue) this.disconnect('peer-disconnected')
      return
    }
    if (message.kind === 'peerUnavailable') {
      const errorMessage =
        typeof message.message === 'string'
          ? message.message
          : 'Network error: e2e relay peer was not found.'
      this.fail('peer-unavailable', errorMessage)
      return
    }
    if (message.kind === 'data' && typeof message.fromPeerId === 'string') {
      this.receiveEnvelope(message.envelope, message.fromPeerId)
      return
    }

    this.fail('invalid-envelope', `Unexpected e2e relay message kind "${message.kind}".`)
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
    this.remotePeerIdValue = peerId
    this.stopConnectTimer()
    this.updateState({ status: 'connected', changedAtMs: this.now(), peerId })
    if (resolve) resolve()
  }

  private stopConnectTimer(rejection?: Error): void {
    const reject = this.connectReject
    if (this.connectTimer) {
      clearTimeout(this.connectTimer)
      this.connectTimer = undefined
    }
    this.connectingPromise = undefined
    this.connectResolve = undefined
    this.connectReject = undefined
    if (rejection && reject) reject(rejection)
  }

  private fail(code: PeerTransportErrorCode, message: string): void {
    if (this.state.status === 'disposed') return
    const error: PeerTransportError = { code, message }
    const reject = this.connectReject
    this.stopConnectTimer()
    const reason = toPeerTransportDisconnectReason(code)
    this.updateState({
      status: 'failed',
      changedAtMs: this.now(),
      peerId: this.remotePeerIdValue,
      reason,
      error
    })
    this.emit({ type: 'error', error })
    this.closeSocket()
    if (reject) reject(new Error(message))
  }

  private ensureNotDisposed(action: string): void {
    if (this.state.status === 'disposed')
      this.raiseUsageError('disposed', `${action} called after dispose`)
  }

  private raiseUsageError(code: PeerTransportErrorCode, message: string): never {
    this.emit({ type: 'error', error: { code, message } })
    throw new Error(`[E2EWebSocketPeerTransport:${this.localPeerId}] [${code}] ${message}`)
  }

  private updateState(state: PeerTransportConnectionState): void {
    this.state = state
    this.emit({ type: 'state', state })
  }

  private emit(event: PeerTransportEvent<TInboundMessage>): void {
    for (const listener of Array.from(this.listeners)) listener(event)
  }
}

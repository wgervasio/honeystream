import { parseWireEnvelope, WireEnvelope } from '../../protocol'
import { PeerTransport, PeerTransportEnvelope, PeerTransportEvent, TransportUnsubscribe } from '../contracts'
import {
  PeerTransportConnectionState,
  PeerTransportDisconnectReason,
  PeerTransportError,
  PeerTransportErrorCode
} from '../connection-state'
import {
  asWirePayload,
  isLegacyNetConnection,
  LEGACY_NET_WIRE_HEADER,
  LegacyNetServerLike,
  LegacyNetWireTransportOptions,
  MAX_SUBSCRIBERS,
  toPeerTransportEnvelope,
  UNKNOWN_PEER_ID,
  WireTransportListener
} from './legacy-net-wire-transport.shared'

export class LegacyNetWireTransport implements PeerTransport<WireEnvelope, WireEnvelope> {
  readonly localPeerId: string

  private readonly server: LegacyNetServerLike
  private readonly ownsServer: boolean
  private readonly now: () => number
  private readonly listeners = new Set<WireTransportListener>()
  private state: PeerTransportConnectionState
  private connectAttempt = 0
  private remotePeerIdValue: string

  private readonly onConnectListener = (...args: readonly unknown[]): void => {
    const [connection] = args
    if (!isLegacyNetConnection(connection)) return
    this.remotePeerIdValue = connection.id.toString()
    this.markConnected(this.remotePeerIdValue)
  }

  private readonly onDisconnectListener = (...args: readonly unknown[]): void => {
    const [connection] = args
    if (!isLegacyNetConnection(connection)) return
    const peerId = connection.id.toString()
    if (peerId !== this.remotePeerIdValue && this.state.status === 'connected') return
    this.setDisconnected('peer-disconnected', peerId)
  }

  private readonly onDataListener = (...args: readonly unknown[]): void => {
    const [connection, data] = args
    if (!isLegacyNetConnection(connection) || !Buffer.isBuffer(data)) return
    const payload = asWirePayload(data)
    if (!payload) return

    this.remotePeerIdValue = connection.id.toString()
    if (this.state.status !== 'connected') this.markConnected(this.remotePeerIdValue)

    let parsed: unknown
    try {
      parsed = JSON.parse(payload.toString('utf-8'))
    } catch {
      this.fail('invalid-envelope', 'Legacy net wire frame payload is not valid JSON')
      return
    }

    const wireEnvelopeResult = parseWireEnvelope(parsed, 'legacyNetWireEnvelope')
    if (!wireEnvelopeResult.ok) {
      this.fail('validation-failed', wireEnvelopeResult.error.message)
      return
    }

    this.emit({
      type: 'message',
      delivery: {
        fromPeerId: this.remotePeerIdValue,
        receivedAtMs: this.now(),
        envelope: toPeerTransportEnvelope(wireEnvelopeResult.value)
      }
    })
  }

  private readonly onCloseListener = (): void => {
    if (this.state.status !== 'disposed') this.setDisconnected('peer-disconnected')
  }

  private readonly onErrorListener = (...args: readonly unknown[]): void => {
    const [error] = args
    const message = error instanceof Error ? error.message : 'Legacy net server emitted unknown error'
    this.fail('peer-unavailable', message)
  }

  constructor(options: LegacyNetWireTransportOptions) {
    this.localPeerId = options.localPeerId
    this.server = options.server
    this.ownsServer = options.ownsServer === true
    this.now = options.now || Date.now
    this.remotePeerIdValue = options.remotePeerIdHint || (this.server.isHost ? 'guest' : 'host')
    this.state =
      !this.server.isHost && this.server.connected
        ? { status: 'connected', changedAtMs: this.now(), peerId: this.remotePeerIdValue }
        : { status: 'idle', changedAtMs: this.now() }

    this.server.on('connect', this.onConnectListener)
    this.server.on('disconnect', this.onDisconnectListener)
    this.server.on('data', this.onDataListener)
    this.server.on('close', this.onCloseListener)
    this.server.on('error', this.onErrorListener)
  }

  get remotePeerId(): string {
    return this.remotePeerIdValue
  }

  async connect(): Promise<void> {
    this.ensureNotDisposed('connect')
    if (this.state.status === 'connected') return

    this.connectAttempt += 1
    this.updateState({
      status: 'connecting',
      changedAtMs: this.now(),
      attempt: this.connectAttempt
    })
    if (!this.server.isHost && this.server.connected) this.markConnected(this.remotePeerIdValue)
  }

  disconnect(reason: PeerTransportDisconnectReason = 'manual'): void {
    if (this.state.status !== 'disposed') this.setDisconnected(reason)
  }

  getState(): PeerTransportConnectionState {
    return this.state
  }

  send(envelope: PeerTransportEnvelope<WireEnvelope>): void {
    this.ensureNotDisposed('send')
    if (this.state.status !== 'connected') {
      this.raiseUsageError('not-connected', `cannot send while ${this.state.status}`)
    }
    if (envelope.seq !== envelope.message.seq || envelope.sentAtMs !== envelope.message.sentAtMs) {
      this.raiseUsageError('invalid-envelope', 'peer transport metadata must match inner wire metadata')
    }

    const wireEnvelopeResult = parseWireEnvelope(envelope.message, 'legacyNetWireEnvelope')
    if (!wireEnvelopeResult.ok) this.raiseUsageError('validation-failed', wireEnvelopeResult.error.message)
    const frame = Buffer.concat([
      LEGACY_NET_WIRE_HEADER,
      Buffer.from(JSON.stringify(wireEnvelopeResult.value), 'utf-8')
    ])

    if (this.server.isHost) {
      const connection = this.server.getClientById(this.remotePeerIdValue)
      if (!connection || connection.connected === false) {
        this.raiseUsageError('peer-unavailable', `missing active legacy peer ${this.remotePeerIdValue}`)
      }
      this.server.sendTo(this.remotePeerIdValue, frame)
      return
    }

    this.server.sendToHost(frame)
  }

  subscribe(listener: WireTransportListener): TransportUnsubscribe {
    this.ensureNotDisposed('subscribe')
    if (this.listeners.size >= MAX_SUBSCRIBERS) {
      this.raiseUsageError('peer-unavailable', `listener cap reached (${MAX_SUBSCRIBERS})`)
    }
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  dispose(): void {
    if (this.state.status === 'disposed') return

    this.detachListeners()
    if (this.ownsServer) this.server.close()
    if (this.state.status === 'connected' || this.state.status === 'connecting') {
      this.setDisconnected('disposed')
    }
    this.updateState({ status: 'disposed', changedAtMs: this.now() })
    this.listeners.clear()
  }

  private detachListeners(): void {
    this.server.removeListener('connect', this.onConnectListener)
    this.server.removeListener('disconnect', this.onDisconnectListener)
    this.server.removeListener('data', this.onDataListener)
    this.server.removeListener('close', this.onCloseListener)
    this.server.removeListener('error', this.onErrorListener)
  }

  private markConnected(peerId: string): void {
    if (this.state.status !== 'disposed') {
      this.updateState({ status: 'connected', changedAtMs: this.now(), peerId })
    }
  }

  private setDisconnected(reason: PeerTransportDisconnectReason, peerId: string = this.remotePeerIdValue): void {
    this.updateState({ status: 'disconnected', changedAtMs: this.now(), peerId, reason })
  }

  private fail(code: PeerTransportErrorCode, message: string): void {
    if (this.state.status === 'disposed') return
    const reason: PeerTransportDisconnectReason =
      code === 'invalid-envelope' || code === 'validation-failed' ? 'validation-failed' : 'transport-error'
    this.updateState({
      status: 'failed',
      changedAtMs: this.now(),
      peerId: this.remotePeerIdValue || UNKNOWN_PEER_ID,
      reason,
      error: { code, message }
    })
    this.emitError(code, message)
  }

  private ensureNotDisposed(action: string): void {
    if (this.state.status === 'disposed') this.raiseUsageError('disposed', `${action} called after dispose`)
  }

  private raiseUsageError(code: PeerTransportErrorCode, message: string): never {
    this.emitError(code, message)
    throw new Error(`[LegacyNetWireTransport:${this.localPeerId}] [${code}] ${message}`)
  }

  private emitError(code: PeerTransportErrorCode, message: string): void {
    const error: PeerTransportError = { code, message }
    this.emit({ type: 'error', error })
  }

  private updateState(state: PeerTransportConnectionState): void {
    this.state = state
    this.emit({ type: 'state', state })
  }

  private emit(event: PeerTransportEvent<WireEnvelope>): void {
    for (const listener of Array.from(this.listeners)) listener(event)
  }
}

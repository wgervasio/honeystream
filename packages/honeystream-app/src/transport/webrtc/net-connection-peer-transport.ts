import {
  PeerTransport,
  PeerTransportConnectionState,
  PeerTransportMessage,
  PeerTransportMessageValidator,
  isPeerTransportMessage
} from './peer-transport.contract'

export type PeerTransportErrorCode =
  | 'disposed'
  | 'not-connected'
  | 'serialize-failed'
  | 'parse-failed'
  | 'invalid-outbound-message'
  | 'invalid-inbound-message'

export class PeerTransportError extends Error {
  readonly code: PeerTransportErrorCode
  readonly cause?: unknown

  constructor(code: PeerTransportErrorCode, message: string, cause?: unknown) {
    super(message)
    Object.setPrototypeOf(this, PeerTransportError.prototype)
    this.code = code
    this.cause = cause
  }
}

type Listener<TValue> = (value: TValue) => void

export interface PeerTransportConnection {
  readonly connected?: boolean
  send(data: Buffer): void
  close(): void
  on(eventName: 'connect', listener: () => void): this
  on(eventName: 'disconnect', listener: () => void): this
  on(eventName: 'reconnect', listener: () => void): this
  on(eventName: 'close', listener: () => void): this
  on(eventName: 'error', listener: (error: Error) => void): this
  on(eventName: 'data', listener: (data: Buffer) => void): this
  removeListener(eventName: 'connect', listener: () => void): this
  removeListener(eventName: 'disconnect', listener: () => void): this
  removeListener(eventName: 'reconnect', listener: () => void): this
  removeListener(eventName: 'close', listener: () => void): this
  removeListener(eventName: 'error', listener: (error: Error) => void): this
  removeListener(eventName: 'data', listener: (data: Buffer) => void): this
}

export interface NetConnectionPeerTransportOptions<
  TMessage extends PeerTransportMessage = PeerTransportMessage
> {
  readonly connection: PeerTransportConnection
  readonly ownsConnection?: boolean
  readonly parseMessage?: (data: Buffer) => unknown
  readonly serializeMessage?: (message: TMessage) => Buffer
  readonly validateMessage?: PeerTransportMessageValidator<TMessage>
}

const parseJsonMessage = (data: Buffer): unknown => {
  const json = data.toString('utf-8')
  return JSON.parse(json)
}

const serializeJsonMessage = <TMessage extends PeerTransportMessage>(message: TMessage): Buffer => {
  return Buffer.from(JSON.stringify(message), 'utf-8')
}

export class NetConnectionPeerTransport<
  TMessage extends PeerTransportMessage = PeerTransportMessage
> implements PeerTransport<TMessage> {
  private readonly connection: PeerTransportConnection
  private readonly ownsConnection: boolean
  private readonly parseMessage: (data: Buffer) => unknown
  private readonly serializeMessage: (message: TMessage) => Buffer
  private readonly validateMessage: PeerTransportMessageValidator<TMessage>

  private disposedValue = false
  private stateValue: PeerTransportConnectionState

  private readonly messageListeners = new Set<Listener<TMessage>>()
  private readonly stateListeners = new Set<Listener<PeerTransportConnectionState>>()
  private readonly errorListeners = new Set<Listener<Error>>()
  private readonly onConnect = (): void => this.updateState('connected')
  private readonly onDisconnect = (): void => this.updateState('disconnected')
  private readonly onReconnect = (): void => this.updateState('connected')
  private readonly onClose = (): void => {
    this.updateState('closed')
    this.teardown(false)
  }
  private readonly onError = (error: Error): void => {
    this.updateState('error')
    this.dispatchError(error)
  }
  private readonly onData = (data: Buffer): void => this.handleInboundData(data)

  constructor(options: NetConnectionPeerTransportOptions<TMessage>) {
    this.connection = options.connection
    this.ownsConnection = options.ownsConnection === true
    this.parseMessage = options.parseMessage || parseJsonMessage
    this.serializeMessage =
      options.serializeMessage || ((message: TMessage): Buffer => serializeJsonMessage(message))
    this.validateMessage =
      options.validateMessage ||
      ((value: unknown): value is TMessage => {
        return isPeerTransportMessage(value)
      })
    this.stateValue = this.connection.connected ? 'connected' : 'connecting'
    this.connection.on('connect', this.onConnect)
    this.connection.on('disconnect', this.onDisconnect)
    this.connection.on('reconnect', this.onReconnect)
    this.connection.on('close', this.onClose)
    this.connection.on('error', this.onError)
    this.connection.on('data', this.onData)
  }

  get state(): PeerTransportConnectionState {
    return this.stateValue
  }
  get disposed(): boolean {
    return this.disposedValue
  }

  send(message: TMessage): void {
    this.assertCanSend(message)
    let data: Buffer
    try {
      data = this.serializeMessage(message)
    } catch (error) {
      const transportError = new PeerTransportError(
        'serialize-failed',
        'Failed to serialize outbound peer transport message',
        error
      )
      this.dispatchError(transportError)
      throw transportError
    }
    this.connection.send(data)
  }

  addMessageListener(listener: Listener<TMessage>): () => void {
    return this.addListener(this.messageListeners, listener)
  }
  addStateListener(listener: Listener<PeerTransportConnectionState>): () => void {
    return this.addListener(this.stateListeners, listener)
  }
  addErrorListener(listener: Listener<Error>): () => void {
    return this.addListener(this.errorListeners, listener)
  }
  dispose(): void {
    this.teardown(true)
  }

  private teardown(closeOwnedConnection: boolean): void {
    if (this.disposedValue) return
    this.disposedValue = true
    this.detachConnectionListeners()
    if (closeOwnedConnection && this.ownsConnection) {
      this.connection.close()
    }
    if (this.stateValue !== 'closed') {
      this.updateState('closed')
    }
    this.messageListeners.clear()
    this.stateListeners.clear()
    this.errorListeners.clear()
  }

  private detachConnectionListeners(): void {
    this.connection.removeListener('connect', this.onConnect)
    this.connection.removeListener('disconnect', this.onDisconnect)
    this.connection.removeListener('reconnect', this.onReconnect)
    this.connection.removeListener('close', this.onClose)
    this.connection.removeListener('error', this.onError)
    this.connection.removeListener('data', this.onData)
  }

  private assertCanSend(message: TMessage): void {
    if (this.disposedValue) {
      const transportError = new PeerTransportError(
        'disposed',
        'Cannot send because the peer transport has been disposed'
      )
      this.dispatchError(transportError)
      throw transportError
    }
    if (this.stateValue !== 'connected') {
      const transportError = new PeerTransportError(
        'not-connected',
        `Cannot send while peer transport is in '${this.stateValue}' state`
      )
      this.dispatchError(transportError)
      throw transportError
    }
    if (!this.validateMessage(message)) {
      const transportError = new PeerTransportError(
        'invalid-outbound-message',
        'Outbound peer transport message failed runtime validation'
      )
      this.dispatchError(transportError)
      throw transportError
    }
  }

  private handleInboundData(data: Buffer): void {
    if (this.disposedValue) return
    let parsed: unknown
    try {
      parsed = this.parseMessage(data)
    } catch (error) {
      this.dispatchError(
        new PeerTransportError(
          'parse-failed',
          'Failed to parse inbound peer transport data',
          error
        )
      )
      return
    }
    if (!this.isMessage(parsed)) {
      this.dispatchError(
        new PeerTransportError(
          'invalid-inbound-message',
          'Inbound peer transport message failed runtime validation'
        )
      )
      return
    }
    const message = parsed as TMessage
    this.messageListeners.forEach(listener => listener(message))
  }

  private updateState(state: PeerTransportConnectionState): void {
    if (this.stateValue === state) return
    this.stateValue = state
    this.stateListeners.forEach(listener => listener(state))
  }

  private dispatchError(error: Error): void {
    this.errorListeners.forEach(listener => listener(error))
  }

  private isMessage(value: unknown): value is TMessage {
    return this.validateMessage(value)
  }

  private addListener<TValue>(listeners: Set<Listener<TValue>>, listener: Listener<TValue>): () => void {
    if (this.disposedValue) {
      throw new PeerTransportError(
        'disposed',
        'Cannot register listeners after peer transport disposal'
      )
    }
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }
}

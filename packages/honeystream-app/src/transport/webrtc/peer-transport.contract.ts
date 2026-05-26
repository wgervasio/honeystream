export type PeerTransportConnectionState =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'closed'
  | 'error'

export interface PeerTransportMessage {
  readonly type: string
  readonly payload?: unknown
}

export type PeerTransportMessageValidator<TMessage extends PeerTransportMessage> = (
  value: unknown
) => value is TMessage

export interface PeerTransport<TMessage extends PeerTransportMessage = PeerTransportMessage> {
  readonly state: PeerTransportConnectionState
  readonly disposed: boolean

  send(message: TMessage): void
  addMessageListener(listener: (message: TMessage) => void): () => void
  addStateListener(listener: (state: PeerTransportConnectionState) => void): () => void
  addErrorListener(listener: (error: Error) => void): () => void
  dispose(): void
}

const isRecord = (value: unknown): value is { readonly [key: string]: unknown } => {
  return typeof value === 'object' && value !== null
}

export const isPeerTransportMessage = (value: unknown): value is PeerTransportMessage => {
  return isRecord(value) && typeof value.type === 'string'
}

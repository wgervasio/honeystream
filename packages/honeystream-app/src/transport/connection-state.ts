export type PeerTransportDisconnectReason =
  | 'manual'
  | 'peer-disconnected'
  | 'validation-failed'
  | 'transport-error'
  | 'disposed'

export type PeerTransportErrorCode =
  | 'not-connected'
  | 'peer-unavailable'
  | 'invalid-envelope'
  | 'validation-failed'
  | 'disposed'

export interface PeerTransportError {
  readonly code: PeerTransportErrorCode
  readonly message: string
}

export type PeerTransportConnectionState =
  | {
      readonly status: 'idle'
      readonly changedAtMs: number
    }
  | {
      readonly status: 'connecting'
      readonly changedAtMs: number
      readonly attempt: number
    }
  | {
      readonly status: 'connected'
      readonly changedAtMs: number
      readonly peerId: string
    }
  | {
      readonly status: 'disconnected'
      readonly changedAtMs: number
      readonly peerId: string
      readonly reason: PeerTransportDisconnectReason
    }
  | {
      readonly status: 'failed'
      readonly changedAtMs: number
      readonly peerId: string
      readonly reason: PeerTransportDisconnectReason
      readonly error: PeerTransportError
    }
  | {
      readonly status: 'disposed'
      readonly changedAtMs: number
    }

export const isPeerTransportTerminalState = (state: PeerTransportConnectionState): boolean =>
  state.status === 'failed' || state.status === 'disposed'

export const toPeerTransportDisconnectReason = (
  code: PeerTransportErrorCode
): PeerTransportDisconnectReason =>
  code === 'validation-failed' || code === 'invalid-envelope'
    ? 'validation-failed'
    : 'transport-error'

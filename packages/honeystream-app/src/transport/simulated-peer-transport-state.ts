import { PeerTransportConnectionState, PeerTransportDisconnectReason } from './connection-state'

export const connectingState = (
  changedAtMs: number,
  attempt: number
): PeerTransportConnectionState => ({
  status: 'connecting',
  changedAtMs,
  attempt
})

export const disconnectedState = (
  changedAtMs: number,
  peerId: string,
  reason: PeerTransportDisconnectReason
): PeerTransportConnectionState => ({
  status: 'disconnected',
  changedAtMs,
  peerId,
  reason
})

/**
 * Network version the client is currently using. This must match when
 * connecting to other clients. Will result in a VersionMismatch error
 * otherwise.
 *
 * This should be incremented each time a developer updates the design
 * of networked data structures.
 */
export const HONEYSTREAM_NETWORK_VERSION = 6

export const HONEYSTREAM_SIGNAL_SERVER =
  process.env.HONEYSTREAM_SIGNAL_SERVER || 'wss://signal.rtc.gethoneystream.com'

/*
 * Local e2e runs keep both peers on loopback. Skipping public STUN there removes an external
 * dependency and avoids measuring third-party ICE latency instead of Honeystream control sync.
 */
const HONEYSTREAM_STUN_SERVERS =
  process.env.HONEYSTREAM_E2E_LOCAL_RTC === 'true'
    ? []
    : [{ url: 'stun:stun1.l.google.com:19302' }, { url: 'stun:stun2.l.google.com:19302' }]
const HONEYSTREAM_TURN_SERVER =
  process.env.HONEYSTREAM_E2E_LOCAL_RTC === 'true'
    ? undefined
    : process.env.HONEYSTREAM_TURN_CREDENTIAL && {
        url:
          process.env.HONEYSTREAM_TURN_SERVER ||
          'turn:turn.rtc.gethoneystream.com:5349?transport=tcp',
        username: process.env.HONEYSTREAM_TURN_USERNAME || 'honeystream',
        credential: process.env.HONEYSTREAM_TURN_CREDENTIAL
      }

// prettier-ignore
export const HONEYSTREAM_ICE_SERVERS = [
  ...HONEYSTREAM_STUN_SERVERS,
  HONEYSTREAM_TURN_SERVER
].filter(Boolean)

export const NETWORK_TIMEOUT = 30e3
export const RECONNECT_TIMEOUT = 30e3
export const WEBSOCKET_PORT_DEFAULT = 27064

export const enum NetworkDisconnectReason {
  HostDisconnect = 1,
  Error,
  InvalidClientInfo,
  VersionMismatch,
  Full,
  Kicked,
  MultiTab,
  SessionNotFound
}

export const NetworkDisconnectMessages = {
  [NetworkDisconnectReason.HostDisconnect]: 'networkDisconnectHostDisconnect',
  [NetworkDisconnectReason.Error]: 'networkDisconnectError',
  [NetworkDisconnectReason.InvalidClientInfo]: 'networkDisconnectInvalidClientInfo',
  [NetworkDisconnectReason.VersionMismatch]: `networkDisconnectVersionMismatch`,
  [NetworkDisconnectReason.Full]: 'networkDisconnectFull',
  [NetworkDisconnectReason.Kicked]: 'networkDisconnectKicked',
  [NetworkDisconnectReason.MultiTab]: 'networkDisconnectMultiTab',
  [NetworkDisconnectReason.SessionNotFound]: 'networkDisconnectSessionNotFound'
}

export const NetworkDisconnectLabels = {
  [NetworkDisconnectReason.HostDisconnect]: 'host-disconnect',
  [NetworkDisconnectReason.Error]: 'timeout',
  [NetworkDisconnectReason.InvalidClientInfo]: 'invalid-client-info',
  [NetworkDisconnectReason.VersionMismatch]: `version-mismatch`,
  [NetworkDisconnectReason.Full]: 'full',
  [NetworkDisconnectReason.Kicked]: 'kicked',
  [NetworkDisconnectReason.MultiTab]: 'multi-tab',
  [NetworkDisconnectReason.SessionNotFound]: 'session-not-found'
}

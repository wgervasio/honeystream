export const PROTOCOL_VERSION = 1 as const

export type ProtocolVersion = typeof PROTOCOL_VERSION
export type WireDirection = 'client-to-host' | 'host-to-client'
export type SessionStatus = 'idle' | 'hosting' | 'joining' | 'connected' | 'ended'
export type ParticipantRole = 'host' | 'guest'
export type MediaKind = 'url' | 'localFile' | 'website'
export type PlaybackState = 'idle' | 'playing' | 'paused'
export type SnapshotRequestReason = 'join' | 'resync' | 'manual'

export type SequenceMetadata = {
  readonly version: ProtocolVersion
  readonly seq: number
  readonly sentAtMs: number
}

export type ParticipantSnapshot = {
  readonly peerId: string
  readonly username: string
  readonly role: ParticipantRole
}

export type MediaSnapshot = {
  readonly mediaId: string
  readonly kind: MediaKind
  readonly source: string
  readonly title: string
  readonly durationMs?: number
}

export type PlaybackSnapshot = {
  readonly state: PlaybackState
  readonly positionMs: number
  readonly updatedAtHostMs: number
  readonly rate: number
  readonly durationMs?: number
}

export type SessionSnapshot = {
  readonly roomId: string
  readonly status: SessionStatus
  readonly participants: {
    readonly host: ParticipantSnapshot
    readonly guest?: ParticipantSnapshot
  }
  readonly queue: readonly MediaSnapshot[]
  readonly current?: MediaSnapshot
  readonly currentMediaId?: string
  readonly currentMedia?: MediaSnapshot
  readonly playback: PlaybackSnapshot
  readonly eventCursor: number
}

export type JoinCommand = {
  readonly type: 'join'
  readonly username: string
  readonly inviteSecret: string
}

export type LeaveCommand = {
  readonly type: 'leave'
  readonly reason?: string
}

export type AddMediaCommand = {
  readonly type: 'addMedia'
  readonly media: MediaSnapshot
}

export type RemoveMediaCommand = {
  readonly type: 'removeMedia'
  readonly mediaId: string
}

export type PlayPauseCommand = {
  readonly type: 'playPause'
  readonly playing: boolean
}

export type SeekCommand = {
  readonly type: 'seek'
  readonly positionMs: number
}

export type SetRateCommand = {
  readonly type: 'setRate'
  readonly rate: number
}

export type NextCommand = {
  readonly type: 'next'
}

export type RequestSnapshotCommand = {
  readonly type: 'requestSnapshot'
  readonly reason: SnapshotRequestReason
}

export type ClientCommand =
  | JoinCommand
  | LeaveCommand
  | AddMediaCommand
  | RemoveMediaCommand
  | PlayPauseCommand
  | SeekCommand
  | SetRateCommand
  | NextCommand
  | RequestSnapshotCommand

type ProtocolErrorBase<TCode extends ProtocolErrorCode> = {
  readonly type: 'protocolError'
  readonly version: ProtocolVersion
  readonly code: TCode
  readonly message: string
  readonly path?: string
}

export type UnsupportedVersionError = ProtocolErrorBase<'unsupportedVersion'> & {
  readonly receivedVersion: number
  readonly expectedVersion: ProtocolVersion
}
export type InvalidDirectionError = ProtocolErrorBase<'invalidDirection'> & {
  readonly receivedDirection: string
}
export type InvalidSequenceError = ProtocolErrorBase<'invalidSequence'> & {
  readonly field: 'seq' | 'sentAtMs'
  readonly receivedValue: number
}
export type InvalidEnvelopeError = ProtocolErrorBase<'invalidEnvelope'>
export type InvalidCommandError = ProtocolErrorBase<'invalidCommand'>
export type InvalidEventError = ProtocolErrorBase<'invalidEvent'>
export type InvalidSnapshotError = ProtocolErrorBase<'invalidSnapshot'>
export type MalformedValueError = ProtocolErrorBase<'malformedValue'>

export type ProtocolErrorCode =
  | 'unsupportedVersion'
  | 'invalidDirection'
  | 'invalidSequence'
  | 'invalidEnvelope'
  | 'invalidCommand'
  | 'invalidEvent'
  | 'invalidSnapshot'
  | 'malformedValue'

export type ProtocolError =
  | UnsupportedVersionError
  | InvalidDirectionError
  | InvalidSequenceError
  | InvalidEnvelopeError
  | InvalidCommandError
  | InvalidEventError
  | InvalidSnapshotError
  | MalformedValueError

export type HostEvent =
  | { readonly type: 'snapshot'; readonly snapshot: SessionSnapshot }
  | { readonly type: 'participantJoined'; readonly participant: ParticipantSnapshot }
  | { readonly type: 'participantLeft'; readonly peerId: string }
  | { readonly type: 'mediaQueued'; readonly media: MediaSnapshot; readonly position: number }
  | { readonly type: 'mediaRemoved'; readonly mediaId: string }
  | { readonly type: 'currentMediaChanged'; readonly mediaId?: string; readonly media?: MediaSnapshot }
  | { readonly type: 'playbackChanged'; readonly playback: PlaybackSnapshot }
  | { readonly type: 'systemError'; readonly errorCode: string; readonly message: string }
  | { readonly type: 'protocolRejected'; readonly error: ProtocolError }

export type ClientToHostEnvelope = SequenceMetadata & {
  readonly direction: 'client-to-host'
  readonly command: ClientCommand
}

export type HostToClientEnvelope = SequenceMetadata & {
  readonly direction: 'host-to-client'
  readonly event: HostEvent
}

export type WireEnvelope = ClientToHostEnvelope | HostToClientEnvelope

export type UnknownRecord = { readonly [key: string]: unknown }

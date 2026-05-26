export interface PrivateInviteCredentials {
  readonly roomId: string
  readonly secret: string
}

export interface FormatPrivateInviteLinkInput extends PrivateInviteCredentials {
  readonly baseUrl: string
  readonly joinPath?: string
}

export interface ParsePrivateInviteLinkInput {
  readonly inviteLink: string
  readonly baseUrl?: string
  readonly joinPath?: string
}

export type PrivateInviteParseErrorCode =
  | 'invalid-url'
  | 'invalid-join-path'
  | 'missing-room-id'
  | 'missing-secret'

export interface PrivateInviteParseError {
  readonly code: PrivateInviteParseErrorCode
  readonly message: string
}

export type PrivateInviteParseResult =
  | { readonly ok: true; readonly value: PrivateInviteCredentials }
  | { readonly ok: false; readonly error: PrivateInviteParseError }

import {
  getPrivateInviteParticipantRejectionReason,
  normalizePrivateInviteJoinRequest,
  PrivateInviteJoinRejectionReason,
  validatePrivateInviteSecretMatch
} from 'domain/private-invite'
import { ParticipantsState } from 'domain/participants'
import { sanitizeUsername } from 'domain/usernames'
import { JoinCommand } from 'protocol/types'

export interface RuntimePrivateInviteJoinRequest {
  readonly roomId: string
  readonly inviteSecret: string
  readonly participantId: string
  readonly username: string
}

export type RuntimePrivateInviteJoinResult =
  | {
      readonly ok: true
      readonly request: RuntimePrivateInviteJoinRequest
    }
  | {
      readonly ok: false
      readonly reason: PrivateInviteJoinRejectionReason
    }

export interface NormalizeRuntimePrivateInviteJoinInput {
  readonly roomId: unknown
  readonly participantId: unknown
  readonly expectedInviteSecret: unknown
  readonly participants: ParticipantsState
  readonly command: JoinCommand
}

export const normalizeRuntimePrivateInviteJoinRequest = (
  input: NormalizeRuntimePrivateInviteJoinInput
): RuntimePrivateInviteJoinResult => {
  const requestResult = normalizePrivateInviteJoinRequest({
    roomId: input.roomId,
    inviteSecret: input.command.inviteSecret,
    participantId: input.participantId
  })
  if (!requestResult.ok) {
    return requestResult
  }

  const secretMismatchReason = validatePrivateInviteSecretMatch(
    input.expectedInviteSecret,
    requestResult.value.inviteSecret
  )
  if (secretMismatchReason) {
    return { ok: false, reason: secretMismatchReason }
  }

  const participantReason = getPrivateInviteParticipantRejectionReason(
    input.participants,
    requestResult.value.participantId
  )
  if (participantReason) {
    return { ok: false, reason: participantReason }
  }

  return {
    ok: true,
    request: {
      ...requestResult.value,
      username: sanitizeUsername(input.command.username)
    }
  }
}


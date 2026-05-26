import { addGuestParticipant, createParticipantsState } from './participants'
import {
  getPrivateInviteParticipantRejectionReason,
  normalizePrivateInviteJoinRequest,
  validateInviteSecret,
  validatePrivateInviteSecretMatch
} from './private-invite'

const roomId = 'A'.repeat(64)

describe('domain/private-invite', () => {
  it('accepts and normalizes valid invite secrets', () => {
    const result = validateInviteSecret('  invite_secret-123  ')
    expect(result).toEqual({
      ok: true,
      normalized: 'invite_secret-123'
    })
  })

  it('rejects invalid invite secrets', () => {
    expect(validateInviteSecret('short').issue).toBe('too-short')
    expect(validateInviteSecret('invalid secret').issue).toBe('invalid-format')
    expect(validateInviteSecret(42).issue).toBe('not-string')
  })

  it('normalizes a valid join request and checks secret match', () => {
    const joinResult = normalizePrivateInviteJoinRequest({
      roomId: `  ${roomId}  `,
      inviteSecret: '  invite_secret-123  ',
      participantId: '  guest-1  '
    })

    expect(joinResult.ok).toBeTruthy()
    if (!joinResult.ok) {
      throw new Error('Expected join request normalization to succeed')
    }

    expect(joinResult.value).toEqual({
      roomId: roomId.toLowerCase(),
      inviteSecret: 'invite_secret-123',
      participantId: 'guest-1'
    })
    expect(validatePrivateInviteSecretMatch('invite_secret-123', joinResult.value.inviteSecret)).toBeUndefined()
    expect(validatePrivateInviteSecretMatch('different-secret', joinResult.value.inviteSecret)).toBe(
      'invite-secret-mismatch'
    )
  })

  it('rejects a second unique guest when session is at max participants', () => {
    const participants = addGuestParticipant(
      createParticipantsState('host-1', 'Host'),
      'guest-1',
      'Guest'
    )

    expect(getPrivateInviteParticipantRejectionReason(participants, 'guest-1')).toBeUndefined()
    expect(getPrivateInviteParticipantRejectionReason(participants, 'guest-2')).toBe(
      'participant-limit-reached'
    )
  })
})


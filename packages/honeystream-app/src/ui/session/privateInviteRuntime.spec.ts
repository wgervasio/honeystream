import { addGuestParticipant, createParticipantsState } from 'domain/participants'
import { normalizeRuntimePrivateInviteJoinRequest } from './privateInviteRuntime'

const roomId = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

describe('ui/session/privateInviteRuntime', () => {
  it('normalizes a valid join command for runtime consumption', () => {
    const result = normalizeRuntimePrivateInviteJoinRequest({
      roomId: ` ${roomId} `,
      participantId: ' guest-1 ',
      expectedInviteSecret: 'invite_secret-123',
      participants: createParticipantsState('host-1', 'Host'),
      command: {
        type: 'join',
        username: '  Guest User  ',
        inviteSecret: ' invite_secret-123 '
      }
    })

    expect(result.ok).toBeTruthy()
    if (!result.ok) {
      throw new Error('Expected runtime join normalization to succeed')
    }

    expect(result.request).toEqual({
      roomId,
      participantId: 'guest-1',
      inviteSecret: 'invite_secret-123',
      username: 'Guest User'
    })
  })

  it('rejects invalid join secrets', () => {
    const result = normalizeRuntimePrivateInviteJoinRequest({
      roomId,
      participantId: 'guest-1',
      expectedInviteSecret: 'invite_secret-123',
      participants: createParticipantsState('host-1', 'Host'),
      command: {
        type: 'join',
        username: 'Guest',
        inviteSecret: 'bad secret'
      }
    })

    expect(result).toEqual({
      ok: false,
      reason: 'invalid-invite-secret'
    })
  })

  it('rejects joins when max participant count is reached', () => {
    const participants = addGuestParticipant(
      createParticipantsState('host-1', 'Host'),
      'guest-1',
      'Guest 1'
    )
    const result = normalizeRuntimePrivateInviteJoinRequest({
      roomId,
      participantId: 'guest-2',
      expectedInviteSecret: 'invite_secret-123',
      participants,
      command: {
        type: 'join',
        username: 'Guest 2',
        inviteSecret: 'invite_secret-123'
      }
    })

    expect(result).toEqual({
      ok: false,
      reason: 'participant-limit-reached'
    })
  })
})


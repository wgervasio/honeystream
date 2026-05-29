import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { InviteLinkPanel } from './InviteLinkPanel'
import {
  DEFAULT_INVITE_JOIN_PATH,
  formatPrivateInviteLink,
  parsePrivateInviteLink
} from './inviteLink'

describe('formatPrivateInviteLink', () => {
  it('formats a private invite link from room id and secret', () => {
    expect(
      formatPrivateInviteLink({
        baseUrl: 'https://app.gethoneystream.com',
        roomId: 'room-1',
        secret: 'secret-token'
      })
    ).toBe('https://app.gethoneystream.com/join/room-1?secret=secret-token')
  })

  it('supports custom join paths', () => {
    expect(
      formatPrivateInviteLink({
        baseUrl: 'https://app.gethoneystream.com/subpath',
        joinPath: '/watch',
        roomId: 'room id',
        secret: 'secret-token'
      })
    ).toBe('https://app.gethoneystream.com/watch/room%20id?secret=secret-token')
  })
})

describe('parsePrivateInviteLink', () => {
  it('parses room id and secret from an invite URL', () => {
    expect(
      parsePrivateInviteLink({
        inviteLink: 'https://app.gethoneystream.com/join/room-1?secret=secret-token'
      })
    ).toEqual({
      ok: true,
      value: {
        roomId: 'room-1',
        secret: 'secret-token'
      }
    })
  })

  it('parses relative invite URLs', () => {
    expect(
      parsePrivateInviteLink({
        inviteLink: '/join/room%201?secret=secret-token'
      })
    ).toEqual({
      ok: true,
      value: {
        roomId: 'room 1',
        secret: 'secret-token'
      }
    })
  })

  it('parses hash-route invite URLs', () => {
    expect(
      parsePrivateInviteLink({
        inviteLink: 'https://app.gethoneystream.com/#/join/room-1?secret=secret-token'
      })
    ).toEqual({
      ok: true,
      value: {
        roomId: 'room-1',
        secret: 'secret-token'
      }
    })
  })

  it('reports missing secret values', () => {
    const result = parsePrivateInviteLink({
      inviteLink: `https://app.gethoneystream.com${DEFAULT_INVITE_JOIN_PATH}/room-1`
    })

    if (result.ok) {
      throw new Error('Expected invite parsing to fail without a secret value')
    }

    expect(result.error.code).toBe('missing-secret')
  })
})

describe('InviteLinkPanel', () => {
  it('renders invite link, room id, and secret values', () => {
    const html = renderToStaticMarkup(
      <InviteLinkPanel
        baseUrl="https://app.gethoneystream.com"
        description="Copy the full invite link first. Room code and secret are backup pieces."
        id="runtime_invite_panel"
        invite={{ roomId: 'room-1', secret: 'secret-token' }}
        onCopyInviteLink={() => {}}
        onCopyRoomId={() => {}}
        onCopySecret={() => {}}
      />
    )

    expect(html).toContain('id="runtime_invite_panel"')
    expect(html).toContain('Copy the full invite link first')
    expect(html).toContain('data-invite-description="true"')
    expect(html).toContain('Invite link:')
    expect(html).toContain('https://app.gethoneystream.com/join/room-1?secret=secret-token')
    expect(html).toContain('Room ID:')
    expect(html).toContain('room-1')
    expect(html).toContain('Secret:')
    expect(html).toContain('secret-token')
    expect(html).toContain('data-invite-field="invite-link"')
    expect(html).toContain('data-invite-field="room-id"')
    expect(html).toContain('data-invite-field="secret"')
    expect(html).toContain('data-copy-state="idle"')
    expect((html.match(/>Copy</g) || []).length).toBe(3)
  })

  it('omits copy buttons when copy callbacks are not provided', () => {
    const html = renderToStaticMarkup(
      <InviteLinkPanel
        baseUrl="https://app.gethoneystream.com"
        invite={{ roomId: 'room-1', secret: 'secret-token' }}
      />
    )

    expect(html).not.toContain('>Copy</button>')
  })
})

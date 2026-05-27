import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SessionParticipantUsernames } from './SessionParticipantUsernames'
import { SessionShell } from './SessionShell'
import { SessionStateLabel } from './SessionStateLabel'
import { SessionSystemErrors } from './SessionSystemErrors'
import { SESSION_VIEW_STATE_LABELS, SessionViewState } from './types'

describe('SessionStateLabel', () => {
  const states = Object.keys(SESSION_VIEW_STATE_LABELS) as SessionViewState[]

  states.forEach(state => {
    it(`renders ${state} state label`, () => {
      const html = renderToStaticMarkup(<SessionStateLabel state={state} />)
      expect(html).toContain(SESSION_VIEW_STATE_LABELS[state])
      expect(html).toContain(`data-session-state="${state}"`)
    })
  })
})

describe('SessionParticipantUsernames', () => {
  it('renders host and guest usernames', () => {
    const html = renderToStaticMarkup(
      <SessionParticipantUsernames
        participants={{ hostUsername: 'HostUser', guestUsername: 'GuestUser' }}
      />
    )

    expect(html).toContain('Host: HostUser')
    expect(html).toContain('Guest: GuestUser')
  })

  it('renders waiting text when guest username is not provided', () => {
    const html = renderToStaticMarkup(
      <SessionParticipantUsernames
        participants={{ hostUsername: 'HostUser' }}
        waitingForGuestLabel="Awaiting guest"
      />
    )

    expect(html).toContain('Guest: Awaiting guest')
  })

  it('keeps cozy Cat-side and Rabbit-side labels visible for runtime rooms', () => {
    const html = renderToStaticMarkup(
      <SessionParticipantUsernames
        hostLabel="Cat-side host"
        guestLabel="Rabbit-side guest"
        participants={{ hostUsername: 'HoneyHost' }}
        waitingForGuestLabel="Waiting for your watch buddy"
      />
    )

    expect(html).toContain('Cat-side host: HoneyHost')
    expect(html).toContain('Rabbit-side guest: Waiting for your watch buddy')
  })
})

describe('SessionSystemErrors', () => {
  it('returns empty markup when there are no errors', () => {
    const html = renderToStaticMarkup(<SessionSystemErrors errors={[]} />)
    expect(html).toBe('')
  })

  it('renders system errors with title', () => {
    const html = renderToStaticMarkup(
      <SessionSystemErrors
        errors={[
          { id: 'error-1', code: 'transport-timeout', message: 'Connection timed out.' },
          { id: 'error-2', code: 'protocol-rejected', message: 'Host rejected command.' }
        ]}
        title="System errors"
      />
    )

    expect(html).toContain('System errors')
    expect(html).toContain('transport-timeout')
    expect(html).toContain('Connection timed out.')
    expect(html).toContain('protocol-rejected')
    expect(html).toContain('Host rejected command.')
  })
})

describe('SessionShell', () => {
  it('renders session status, participants, and errors together', () => {
    const html = renderToStaticMarkup(
      <SessionShell
        state="connected"
        participantUsernames={{ hostUsername: 'HostUser', guestUsername: 'GuestUser' }}
        errors={[{ id: 'error-1', code: 'transport-disconnected', message: 'Peer disconnected.' }]}
        errorTitle="Sync issues"
      />
    )

    expect(html).toContain('Connected')
    expect(html).toContain('Host: HostUser')
    expect(html).toContain('Guest: GuestUser')
    expect(html).toContain('Sync issues')
    expect(html).toContain('transport-disconnected')
    expect(html).toContain('Peer disconnected.')
  })
})

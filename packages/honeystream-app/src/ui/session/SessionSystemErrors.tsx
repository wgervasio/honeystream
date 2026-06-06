import React, { memo } from 'react'
import { SessionSystemErrorViewModel } from './types'

interface SessionSystemErrorsProps {
  readonly className?: string
  readonly errors: readonly SessionSystemErrorViewModel[]
  readonly title?: string
}

const getErrorGuidance = (code: SessionSystemErrorViewModel['code']): string => {
  switch (code) {
    case 'invite-invalid':
      return 'Check the invite link and room secret, then try again.'
    case 'join-rejected':
      return 'The host may have closed the room or already paired with a guest.'
    case 'transport-disconnected':
      return 'The private control lane paused; reconnect with the same invite.'
    case 'transport-timeout':
      return 'The handshake is taking too long; refresh both seats if it does not recover.'
    case 'protocol-rejected':
      return 'Refresh both browsers so they agree on the same typed protocol.'
    case 'unknown':
    default:
      return 'Keep the room open while Honeystream surfaces the exact issue.'
  }
}

export const SessionSystemErrors = memo(function SessionSystemErrors(props: SessionSystemErrorsProps) {
  if (props.errors.length === 0) {
    return null
  }

  return (
    <section className={props.className} role="alert" aria-live="polite">
      {props.title ? <p>{props.title}</p> : null}
      <ul>
        {props.errors.map(error => (
          <li key={error.id} data-error-code={error.code}>
            <strong>{error.code}</strong>: {error.message}
            <p data-error-guidance="true">{getErrorGuidance(error.code)}</p>
          </li>
        ))}
      </ul>
    </section>
  )
})

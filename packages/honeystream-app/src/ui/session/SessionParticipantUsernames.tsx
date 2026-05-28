import React, { memo } from 'react'
import { SessionParticipantUsernames as SessionParticipantUsernamesModel } from './types'

interface SessionParticipantUsernamesProps {
  readonly className?: string
  readonly guestLabel?: string
  readonly hostLabel?: string
  readonly participants: SessionParticipantUsernamesModel
  readonly waitingForGuestLabel?: string
}

function getGuestUsername(
  guestUsername: string | undefined,
  waitingForGuestLabel: string | undefined
): string {
  if (guestUsername && guestUsername.trim().length > 0) {
    return guestUsername
  }

  return waitingForGuestLabel || 'Waiting for guest'
}

export const SessionParticipantUsernames = memo(function SessionParticipantUsernames(
  props: SessionParticipantUsernamesProps
) {
  const hostLabel = props.hostLabel || 'Host'
  const guestLabel = props.guestLabel || 'Guest'
  const guestUsername = getGuestUsername(
    props.participants.guestUsername,
    props.waitingForGuestLabel
  )
  const guestStatus = props.participants.guestUsername ? 'connected' : 'waiting'

  return (
    <div className={props.className} aria-live="polite">
      <span data-participant-role="host" data-participant-status="connected">
        {`${hostLabel}: ${props.participants.hostUsername}`}
      </span>
      <span aria-hidden="true">{' \u00b7 '}</span>
      <span data-participant-role="guest" data-participant-status={guestStatus}>
        {`${guestLabel}: ${guestUsername}`}
      </span>
    </div>
  )
})

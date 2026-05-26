import React, { memo } from 'react'
import { SessionParticipantUsernames } from './SessionParticipantUsernames'
import { SessionStateLabel } from './SessionStateLabel'
import { SessionSystemErrors } from './SessionSystemErrors'
import {
  SessionParticipantUsernames as SessionParticipantUsernamesModel,
  SessionSystemErrorViewModel,
  SessionViewState
} from './types'

const EMPTY_ERRORS: readonly SessionSystemErrorViewModel[] = Object.freeze([])

export interface SessionShellProps {
  readonly className?: string
  readonly errorTitle?: string
  readonly errors?: readonly SessionSystemErrorViewModel[]
  readonly guestLabel?: string
  readonly hostLabel?: string
  readonly participantUsernames: SessionParticipantUsernamesModel
  readonly state: SessionViewState
  readonly stateLabels?: Partial<Record<SessionViewState, string>>
  readonly waitingForGuestLabel?: string
}

export const SessionShell = memo(function SessionShell(props: SessionShellProps) {
  const errors = props.errors || EMPTY_ERRORS

  return (
    <section className={props.className}>
      <SessionStateLabel state={props.state} labels={props.stateLabels} />
      <SessionParticipantUsernames
        participants={props.participantUsernames}
        hostLabel={props.hostLabel}
        guestLabel={props.guestLabel}
        waitingForGuestLabel={props.waitingForGuestLabel}
      />
      <SessionSystemErrors errors={errors} title={props.errorTitle} />
    </section>
  )
})

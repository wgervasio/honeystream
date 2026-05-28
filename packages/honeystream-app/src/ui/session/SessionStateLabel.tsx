import React, { memo } from 'react'
import { SessionViewState, SESSION_VIEW_STATE_LABELS } from './types'

interface SessionStateLabelProps {
  readonly className?: string
  readonly labels?: Partial<Record<SessionViewState, string>>
  readonly state: SessionViewState
}

export const SessionStateLabel = memo(function SessionStateLabel(props: SessionStateLabelProps) {
  const label =
    (props.labels && props.labels[props.state]) || SESSION_VIEW_STATE_LABELS[props.state]

  return (
    <span
      className={props.className}
      data-session-state={props.state}
      role="status"
      aria-live="polite"
    >
      {label}
    </span>
  )
})

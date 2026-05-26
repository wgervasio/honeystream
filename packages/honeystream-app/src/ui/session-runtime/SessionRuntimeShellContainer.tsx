import React, { memo } from 'react'
import { ProjectionStore } from '../externalStoreProjection'
import { SessionShell, SessionViewState } from '../session'
import { useProjectionSelector } from '../useProjectionSelector'
import {
  createSessionRuntimeShellViewModel,
  SessionRuntimeShellViewModel
} from './sessionShellViewModel'
import { SessionRuntimeIntentCallbacks, SessionRuntimeProjectionSnapshot } from './types'

export interface SessionRuntimeShellContainerProps {
  readonly className?: string
  readonly errorTitle?: string
  readonly guestLabel?: string
  readonly hostLabel?: string
  readonly intents: SessionRuntimeIntentCallbacks
  readonly render?: (viewModel: SessionRuntimeShellViewModel) => React.ReactNode
  readonly stateLabels?: Partial<Record<SessionViewState, string>>
  readonly store: ProjectionStore<SessionRuntimeProjectionSnapshot>
  readonly waitingForGuestLabel?: string
}

export const SessionRuntimeShellContainer = memo(function SessionRuntimeShellContainer(
  props: SessionRuntimeShellContainerProps
) {
  const projectionSnapshot = useProjectionSelector({
    store: props.store,
    selector: snapshot => snapshot
  })
  const viewModel = createSessionRuntimeShellViewModel(projectionSnapshot, props.intents)

  if (props.render) {
    return <>{props.render(viewModel)}</>
  }

  return (
    <SessionShell
      className={props.className}
      errorTitle={props.errorTitle}
      guestLabel={props.guestLabel}
      hostLabel={props.hostLabel}
      stateLabels={props.stateLabels}
      waitingForGuestLabel={props.waitingForGuestLabel}
      {...viewModel.sessionShellProps}
    />
  )
})

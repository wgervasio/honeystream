import React, { useEffect, useMemo } from 'react'
import { RouteComponentProps } from 'react-router'
import {
  createProjectionStore,
  connectSessionEngineProjection,
  Disposable,
  SessionEngineSnapshotSource
} from '../ui'
import { SessionShell } from '../ui/session'
import type {
  SessionParticipantUsernamesModel,
  SessionSystemErrorViewModel,
  SessionViewState
} from '../ui/session'
import { useProjectionSelector } from '../ui/useProjectionSelector'

interface IRouteParams {
  lobbyId: string
}

interface RuntimeSessionShellSnapshot {
  readonly errors: readonly SessionSystemErrorViewModel[]
  readonly lobbyId: string
  readonly participantUsernames: SessionParticipantUsernamesModel
  readonly state: SessionViewState
}

interface RuntimeSessionShellSource
  extends SessionEngineSnapshotSource<RuntimeSessionShellSnapshot>,
    Disposable {
  readonly initialSnapshot: RuntimeSessionShellSnapshot
}

const EMPTY_ERRORS: readonly SessionSystemErrorViewModel[] = Object.freeze([])
const INITIAL_PARTICIPANTS: SessionParticipantUsernamesModel = Object.freeze({
  hostUsername: 'Host'
})

export const createRuntimeSessionShellSnapshot = (
  lobbyId: string
): RuntimeSessionShellSnapshot => ({
  errors: EMPTY_ERRORS,
  lobbyId: lobbyId.trim(),
  participantUsernames: INITIAL_PARTICIPANTS,
  state: 'joining'
})

export const createRuntimeSessionShellSource = (
  lobbyId: string
): RuntimeSessionShellSource => {
  const initialSnapshot = createRuntimeSessionShellSnapshot(lobbyId)
  let disposed = false

  return {
    initialSnapshot,
    subscribeToSnapshots(listener) {
      if (!disposed) {
        listener(initialSnapshot)
      }

      let unsubscribed = false
      return () => {
        if (unsubscribed) {
          return
        }

        unsubscribed = true
      }
    },
    dispose() {
      if (disposed) {
        return
      }

      disposed = true
    }
  }
}

const selectSnapshot = (
  snapshot: RuntimeSessionShellSnapshot
): RuntimeSessionShellSnapshot => snapshot

export const RuntimeSessionShellPage = ({
  match
}: RouteComponentProps<IRouteParams>) => {
  const lobbyId = match.params.lobbyId
  const source = useMemo(() => createRuntimeSessionShellSource(lobbyId), [lobbyId])
  const store = useMemo(() => createProjectionStore(source.initialSnapshot), [source])

  useEffect(() => {
    const projection = connectSessionEngineProjection(store, source)

    return () => {
      projection.dispose()
      source.dispose()
    }
  }, [source, store])

  const snapshot = useProjectionSelector({
    selector: selectSnapshot,
    store
  })

  return (
    <section data-runtime-session-shell="true">
      <h1>Runtime session shell</h1>
      <p>{`Lobby: ${snapshot.lobbyId}`}</p>
      <SessionShell
        state={snapshot.state}
        participantUsernames={snapshot.participantUsernames}
        errors={snapshot.errors}
        errorTitle="Session issues"
      />
    </section>
  )
}

import { SessionParticipantUsernamesModel, SessionSystemErrorViewModel, SessionViewState } from '../session'
import {
  Disposable,
  ProjectionStore,
  SessionEngineSnapshotSource
} from '../externalStoreProjection'

export interface SessionRuntimeSnapshot {
  readonly state: SessionViewState
  readonly participantUsernames: SessionParticipantUsernamesModel
  readonly errors: readonly SessionSystemErrorViewModel[]
}

export interface SessionRuntime
  extends Disposable,
    SessionEngineSnapshotSource<SessionRuntimeSnapshot> {
  getSnapshot(): SessionRuntimeSnapshot
}

export interface SessionRuntimeContextValue {
  readonly runtime: SessionRuntime
  readonly projectionStore: ProjectionStore<SessionRuntimeSnapshot>
}

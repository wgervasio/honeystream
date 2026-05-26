import { Unsubscribe } from 'redux'
import { SessionSnapshot } from 'protocol/types'
import { createProjectionStore, Disposable, ProjectionStore } from 'ui'
import {
  createLegacySessionSnapshot,
  LegacySessionBridgeState
} from './legacySessionSnapshotMapper'

export interface LegacySessionBridgeReduxStore {
  getState(): LegacySessionBridgeState
  subscribe(listener: () => void): Unsubscribe
}

export interface CreateLegacySessionProjectionBridgeOptions {
  readonly reduxStore: LegacySessionBridgeReduxStore
  readonly projectionStore?: ProjectionStore<SessionSnapshot>
  readonly now?: () => number
}

export interface LegacySessionProjectionBridge extends Disposable {
  readonly projectionStore: ProjectionStore<SessionSnapshot>
}

type ObservedLegacySlices = Pick<LegacySessionBridgeState, 'session' | 'mediaPlayer' | 'users'>

const selectObservedSlices = (state: LegacySessionBridgeState): ObservedLegacySlices => ({
  session: state.session,
  mediaPlayer: state.mediaPlayer,
  users: state.users
})

const haveObservedSlicesChanged = (
  previous: ObservedLegacySlices,
  next: ObservedLegacySlices
): boolean =>
  previous.session !== next.session ||
  previous.mediaPlayer !== next.mediaPlayer ||
  previous.users !== next.users

const readNowMs = (clock: () => number): number => {
  const nowMs = clock()
  return Number.isFinite(nowMs) && nowMs >= 0 ? nowMs : 0
}

/**
 * Context: Session/runtime cutover is in progress, but UI/session behavior still flows through
 * legacy Redux reducers today.
 * Invariant: This bridge is read-only. It must never dispatch Redux actions or mutate slices.
 * Options considered: (1) keep mapping logic inside React selectors, (2) create a dedicated
 * compatibility subscriber from Redux to projection snapshots.
 * Decision: Subscribe only to session/media/user slice references and publish typed snapshots to
 * a projection store for incremental runtime migration.
 * Performance impact: O(1) checks per dispatch, O(n) media mapping across the current+queue list.
 * Memory/lifecycle ownership: The bridge owns a single Redux subscription and releases it via
 * dispose().
 * Failure mode: If legacy slices contain malformed values, the mapper normalizes to safe defaults
 * while preserving existing behavior.
 * Validation: Covered by focused mapper/bridge unit tests and analyzer guardrails.
 * Removal condition: Delete this bridge once SessionRuntime (not Redux) is the sole owner of
 * SessionSnapshot/projection-store updates.
 */
export const createLegacySessionProjectionBridge = (
  options: CreateLegacySessionProjectionBridgeOptions
): LegacySessionProjectionBridge => {
  const clock = options.now || Date.now

  let eventCursor = 0
  let observedSlices = selectObservedSlices(options.reduxStore.getState())

  const initialSnapshot = createLegacySessionSnapshot(observedSlices, {
    eventCursor,
    nowMs: readNowMs(clock)
  })

  const projectionStore =
    options.projectionStore || createProjectionStore<SessionSnapshot>(initialSnapshot)

  if (options.projectionStore) {
    options.projectionStore.setSnapshot(initialSnapshot)
  }

  const unsubscribe = options.reduxStore.subscribe(() => {
    const nextObservedSlices = selectObservedSlices(options.reduxStore.getState())
    if (!haveObservedSlicesChanged(observedSlices, nextObservedSlices)) {
      return
    }

    observedSlices = nextObservedSlices
    eventCursor += 1

    const snapshot = createLegacySessionSnapshot(observedSlices, {
      eventCursor,
      nowMs: readNowMs(clock)
    })
    projectionStore.setSnapshot(snapshot)
  })

  let disposed = false

  return {
    projectionStore,
    dispose(): void {
      if (disposed) return
      disposed = true
      unsubscribe()
    }
  }
}

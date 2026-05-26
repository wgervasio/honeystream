import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ProjectionUnsubscribe } from '../externalStoreProjection'
import {
  SessionRuntimeProvider,
  useSessionRuntimeProjectionSelector
} from './SessionRuntimeProvider'
import { createSessionRuntimeProjectionBoundary } from './runtimeProjectionBoundary'
import { SessionRuntime, SessionRuntimeSnapshot } from './types'

interface SessionRuntimeMock {
  readonly runtime: SessionRuntime
  emitSnapshot(nextSnapshot: SessionRuntimeSnapshot): void
  getDisposeCount(): number
  getUnsubscribeCount(): number
}

const HOSTING_SNAPSHOT: SessionRuntimeSnapshot = {
  state: 'hosting',
  participantUsernames: { hostUsername: 'HostUser' },
  errors: []
}

const CONNECTED_SNAPSHOT: SessionRuntimeSnapshot = {
  state: 'connected',
  participantUsernames: { hostUsername: 'HostUser', guestUsername: 'GuestUser' },
  errors: []
}

const ENDED_SNAPSHOT: SessionRuntimeSnapshot = {
  state: 'ended',
  participantUsernames: { hostUsername: 'HostUser', guestUsername: 'GuestUser' },
  errors: []
}

function createRuntimeMock(initialSnapshot: SessionRuntimeSnapshot): SessionRuntimeMock {
  let snapshot = initialSnapshot
  let listener: ((nextSnapshot: SessionRuntimeSnapshot) => void) | undefined
  let unsubscribeCount = 0
  let disposeCount = 0

  const runtime: SessionRuntime = {
    getSnapshot(): SessionRuntimeSnapshot {
      return snapshot
    },
    subscribeToSnapshots(nextListener): ProjectionUnsubscribe {
      listener = nextListener
      return () => {
        if (!listener) {
          return
        }

        listener = undefined
        unsubscribeCount += 1
      }
    },
    dispose(): void {
      disposeCount += 1
    }
  }

  return {
    runtime,
    emitSnapshot(nextSnapshot: SessionRuntimeSnapshot): void {
      snapshot = nextSnapshot
      if (listener) {
        listener(nextSnapshot)
      }
    },
    getDisposeCount(): number {
      return disposeCount
    },
    getUnsubscribeCount(): number {
      return unsubscribeCount
    }
  }
}

function SessionStateText(): JSX.Element {
  const state = useSessionRuntimeProjectionSelector(snapshot => snapshot.state)
  return <span>{state}</span>
}

describe('session runtime projection boundary', () => {
  it('initializes the projection store and forwards runtime snapshots', () => {
    const runtimeMock = createRuntimeMock(HOSTING_SNAPSHOT)
    const boundary = createSessionRuntimeProjectionBoundary(runtimeMock.runtime)

    expect(boundary.projectionStore.getSnapshot()).toEqual(HOSTING_SNAPSHOT)

    runtimeMock.emitSnapshot(CONNECTED_SNAPSHOT)

    expect(boundary.projectionStore.getSnapshot()).toEqual(CONNECTED_SNAPSHOT)
    expect(boundary.projectionStore.getVersion()).toBe(1)
  })

  it('unsubscribes projection updates and disposes runtime once', () => {
    const runtimeMock = createRuntimeMock(HOSTING_SNAPSHOT)
    const boundary = createSessionRuntimeProjectionBoundary(runtimeMock.runtime)

    runtimeMock.emitSnapshot(CONNECTED_SNAPSHOT)
    boundary.dispose()
    boundary.dispose()

    expect(runtimeMock.getUnsubscribeCount()).toBe(1)
    expect(runtimeMock.getDisposeCount()).toBe(1)

    runtimeMock.emitSnapshot(ENDED_SNAPSHOT)
    expect(boundary.projectionStore.getSnapshot()).toEqual(CONNECTED_SNAPSHOT)
  })
})

describe('SessionRuntimeProvider', () => {
  it('renders the selected projection snapshot for consumers', () => {
    const runtimeMock = createRuntimeMock(HOSTING_SNAPSHOT)
    const html = renderToStaticMarkup(
      <SessionRuntimeProvider runtime={runtimeMock.runtime}>
        <SessionStateText />
      </SessionRuntimeProvider>
    )

    expect(html).toContain('hosting')
  })

  it('throws when selector hook is used without SessionRuntimeProvider', () => {
    expect(() => renderToStaticMarkup(<SessionStateText />)).toThrow(
      'useSessionRuntimeContext must be used within a SessionRuntimeProvider'
    )
  })
})

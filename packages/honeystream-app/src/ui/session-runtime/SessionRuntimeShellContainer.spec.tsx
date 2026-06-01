import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createProjectionStore } from '../externalStoreProjection'
import { SessionRuntimeShellContainer } from './SessionRuntimeShellContainer'
import {
  createSessionRuntimeShellViewModel,
  mapProjectionSnapshotToSessionShellProps,
  SessionRuntimeShellViewModel
} from './sessionShellViewModel'
import {
  SessionRuntimeIntentCallbacks,
  SessionRuntimeProjectionSnapshot,
  SessionRuntimeSystemErrorSnapshot
} from './types'

const buildProjectionSnapshot = (
  status: SessionRuntimeProjectionSnapshot['session']['status'] = 'connected',
  systemErrors: readonly SessionRuntimeSystemErrorSnapshot[] = []
): SessionRuntimeProjectionSnapshot => ({
  role: 'host',
  session: {
    roomId: 'room-1',
    status,
    participants: {
      host: {
        peerId: 'host-1',
        username: 'HostUser',
        role: 'host'
      },
      guest: {
        peerId: 'guest-1',
        username: 'GuestUser',
        role: 'guest'
      }
    },
    queue: [],
    currentMediaId: undefined,
    playback: {
      state: 'paused',
      positionMs: 1200,
      updatedAtHostMs: 1000,
      rate: 1,
      durationMs: 4800
    },
    eventCursor: 4
  },
  transportStatus: 'connected',
  systemErrors
})

describe('sessionShellViewModel', () => {
  it('maps projection snapshots into SessionShell props', () => {
    const snapshot = buildProjectionSnapshot('connected', [
      { id: 'error-1', code: 'protocol-rejected', message: 'Command rejected by host.' }
    ])

    const sessionShellProps = mapProjectionSnapshotToSessionShellProps(snapshot)

    expect(sessionShellProps.state).toBe('connected')
    expect(sessionShellProps.participantUsernames).toEqual({
      hostUsername: 'HostUser',
      guestUsername: 'GuestUser'
    })
    expect(sessionShellProps.errors).toEqual([
      { id: 'error-1', code: 'protocol-rejected', message: 'Command rejected by host.' }
    ])
  })

  it('normalizes unknown error codes to unknown', () => {
    const snapshot = buildProjectionSnapshot('hosting', [
      { id: 'error-1', code: 'unexpected-code', message: 'Unexpected failure.' }
    ])

    const sessionShellProps = mapProjectionSnapshotToSessionShellProps(snapshot)

    expect(sessionShellProps.errors).toEqual([
      { id: 'error-1', code: 'unknown', message: 'Unexpected failure.' }
    ])
  })

  it('keeps typed intent callbacks in the bridge view model', () => {
    const snapshot = buildProjectionSnapshot()
    const intents: SessionRuntimeIntentCallbacks = {
      onHostIntent: jest.fn(),
      onJoinIntent: jest.fn(),
      onLeaveIntent: jest.fn(),
      onPlaybackIntent: jest.fn()
    }

    const viewModel = createSessionRuntimeShellViewModel(snapshot, intents)

    expect(viewModel.intents).toBe(intents)
    expect(viewModel.snapshot).toBe(snapshot)
  })
})

describe('SessionRuntimeShellContainer', () => {
  it('renders SessionShell with projection state', () => {
    const store = createProjectionStore(
      buildProjectionSnapshot('connected', [
        { id: 'error-1', code: 'transport-disconnected', message: 'Peer disconnected.' }
      ])
    )
    const intents: SessionRuntimeIntentCallbacks = {
      onHostIntent: jest.fn(),
      onJoinIntent: jest.fn(),
      onLeaveIntent: jest.fn(),
      onPlaybackIntent: jest.fn()
    }

    const html = renderToStaticMarkup(
      <SessionRuntimeShellContainer store={store} intents={intents} errorTitle="Runtime issues" />
    )

    expect(html).toContain('Synced')
    expect(html).toContain('Host: HostUser')
    expect(html).toContain('Guest: GuestUser')
    expect(html).toContain('Runtime issues')
    expect(html).toContain('transport-disconnected')
    expect(html).toContain('Peer disconnected.')
  })

  it('exposes typed intent callbacks through the render bridge', () => {
    const store = createProjectionStore(buildProjectionSnapshot())
    const onHostIntent = jest.fn()
    const onJoinIntent = jest.fn()
    const onLeaveIntent = jest.fn()
    const onPlaybackIntent = jest.fn()
    const intents: SessionRuntimeIntentCallbacks = {
      onHostIntent,
      onJoinIntent,
      onLeaveIntent,
      onPlaybackIntent
    }

    let capturedViewModel: SessionRuntimeShellViewModel | undefined
    const html = renderToStaticMarkup(
      <SessionRuntimeShellContainer
        store={store}
        intents={intents}
        render={viewModel => {
          capturedViewModel = viewModel
          return <div>bridge-render</div>
        }}
      />
    )

    expect(html).toContain('bridge-render')
    expect(capturedViewModel).toBeDefined()
    if (!capturedViewModel) {
      throw new Error('Expected SessionRuntimeShellViewModel to be provided')
    }

    capturedViewModel.intents.onHostIntent({
      type: 'host',
      roomId: 'room-2',
      username: 'Host'
    })
    capturedViewModel.intents.onJoinIntent({
      type: 'join',
      username: 'Guest',
      inviteSecret: 'invite-secret'
    })
    capturedViewModel.intents.onLeaveIntent({
      type: 'leave',
      reason: 'manual'
    })
    capturedViewModel.intents.onPlaybackIntent({
      type: 'seek',
      positionMs: 3000
    })

    expect(onHostIntent).toHaveBeenCalledWith({
      type: 'host',
      roomId: 'room-2',
      username: 'Host'
    })
    expect(onJoinIntent).toHaveBeenCalledWith({
      type: 'join',
      username: 'Guest',
      inviteSecret: 'invite-secret'
    })
    expect(onLeaveIntent).toHaveBeenCalledWith({
      type: 'leave',
      reason: 'manual'
    })
    expect(onPlaybackIntent).toHaveBeenCalledWith({
      type: 'seek',
      positionMs: 3000
    })
  })
})

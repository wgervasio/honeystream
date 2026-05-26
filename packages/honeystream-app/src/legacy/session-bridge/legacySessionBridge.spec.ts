import { MediaType } from 'media/types'
import {
  IMediaItem,
  IMediaPlayerState,
  PlaybackRate,
  PlaybackState,
  RepeatMode
} from 'lobby/reducers/mediaPlayer'
import { ConnectionStatus, ISessionState } from 'lobby/reducers/session'
import { IUser, IUsersState, UserRole } from 'lobby/reducers/users'
import {
  createLegacySessionProjectionBridge,
  createLegacySessionSnapshot,
  LegacySessionBridgeState
} from './index'

const createMediaItem = (overrides: Partial<IMediaItem> = {}): IMediaItem => ({
  id: 'media-1',
  type: MediaType.Item,
  url: 'https://cdn.example.com/video.mp4',
  title: 'Example media',
  requestUrl: 'https://cdn.example.com/video.mp4',
  ...overrides
})

const createMediaPlayerState = (overrides: Partial<IMediaPlayerState> = {}): IMediaPlayerState => ({
  playback: PlaybackState.Idle,
  repeatMode: RepeatMode.Off,
  startTime: undefined,
  pauseTime: undefined,
  playbackRate: PlaybackRate.Default,
  current: undefined,
  queue: [],
  queueLocked: false,
  serverClockSkew: 0,
  localSnapshot: undefined,
  pendingMedia: undefined,
  ...overrides
})

const createSessionState = (overrides: Partial<ISessionState> = {}): ISessionState => ({
  id: 'room-1',
  users: 1,
  playback: PlaybackState.Idle,
  startTime: undefined,
  secret: 'secret',
  serverClockSkew: 0,
  ...overrides
})

const createUser = (overrides: Partial<IUser> = {}): IUser => ({
  id: 'user-1',
  name: 'User',
  color: '#ffffff',
  role: UserRole.Default,
  ...overrides
})

const createUsersState = (overrides: Partial<IUsersState> = {}): IUsersState => ({
  host: 'host-1',
  map: {
    'host-1': createUser({ id: 'host-1', name: 'Host', role: UserRole.Admin }),
    'guest-1': createUser({ id: 'guest-1', name: 'Guest' })
  },
  invites: [],
  ...overrides
})

const createLegacyState = (
  overrides: Partial<LegacySessionBridgeState> = {}
): LegacySessionBridgeState => ({
  session: createSessionState(),
  mediaPlayer: createMediaPlayerState(),
  users: createUsersState(),
  ...overrides
})

describe('legacy session bridge', () => {
  it('maps legacy session/media/user slices into a protocol session snapshot', () => {
    const legacyState = createLegacyState({
      session: createSessionState({
        id: 'room-9',
        startTime: 7000,
        connectionStatus: ConnectionStatus.Connected,
        authorized: true
      }),
      mediaPlayer: createMediaPlayerState({
        playback: PlaybackState.Playing,
        playbackRate: 2,
        startTime: 8000,
        serverClockSkew: 100,
        current: createMediaItem({
          id: 'local-1',
          title: 'Local clip',
          requestUrl: 'honeystream-local://clip-1',
          url: 'blob:https://app/clip-1',
          duration: 5000,
          state: { kind: 'local-file' }
        }),
        queue: [
          createMediaItem({
            id: 'direct-1',
            title: 'Direct clip',
            requestUrl: 'https://cdn.example.com/direct.mp4',
            url: 'https://cdn.example.com/direct.mp4',
            duration: 9000
          }),
          createMediaItem({
            id: 'site-1',
            title: 'Website clip',
            requestUrl: 'https://www.youtube.com/watch?v=abc',
            url: 'https://www.youtube.com/watch?v=abc'
          })
        ]
      }),
      users: createUsersState()
    })

    const snapshot = createLegacySessionSnapshot(legacyState, {
      eventCursor: 4,
      nowMs: 10000
    })

    expect(snapshot).toEqual({
      roomId: 'room-9',
      status: 'connected',
      participants: {
        host: {
          peerId: 'host-1',
          username: 'Host',
          role: 'host'
        },
        guest: {
          peerId: 'guest-1',
          username: 'Guest',
          role: 'guest'
        }
      },
      queue: [
        {
          mediaId: 'local-1',
          kind: 'localFile',
          source: 'honeystream-local://clip-1',
          title: 'Local clip',
          durationMs: 5000
        },
        {
          mediaId: 'direct-1',
          kind: 'url',
          source: 'https://cdn.example.com/direct.mp4',
          title: 'Direct clip',
          durationMs: 9000
        },
        {
          mediaId: 'site-1',
          kind: 'website',
          source: 'https://www.youtube.com/watch?v=abc',
          title: 'Website clip',
          durationMs: undefined
        }
      ],
      currentMediaId: 'local-1',
      playback: {
        state: 'playing',
        positionMs: 3800,
        updatedAtHostMs: 7000,
        rate: 2,
        durationMs: 5000
      },
      eventCursor: 4
    })
  })

  it('normalizes empty legacy data into a safe idle snapshot', () => {
    const legacyState = createLegacyState({
      session: createSessionState({
        id: '',
        connectionStatus: undefined,
        authorized: undefined
      }),
      users: createUsersState({
        host: '',
        map: {}
      })
    })

    const snapshot = createLegacySessionSnapshot(legacyState, {
      eventCursor: -10,
      nowMs: -1
    })

    expect(snapshot).toEqual({
      roomId: 'legacy-session',
      status: 'idle',
      participants: {
        host: {
          peerId: 'host',
          username: 'host',
          role: 'host'
        },
        guest: undefined
      },
      queue: [],
      currentMediaId: undefined,
      playback: {
        state: 'idle',
        positionMs: 0,
        updatedAtHostMs: 0,
        rate: 1,
        durationMs: undefined
      },
      eventCursor: 0
    })
  })

  it('publishes snapshot updates when observed slices change and stops after disposal', () => {
    let state = createLegacyState()
    const listeners = new Set<() => void>()

    const reduxStore = {
      getState(): LegacySessionBridgeState {
        return state
      },
      subscribe(listener: () => void) {
        listeners.add(listener)
        return () => {
          listeners.delete(listener)
        }
      }
    }

    const publish = () => {
      Array.from(listeners).forEach(listener => listener())
    }

    let nowMs = 1000
    const bridge = createLegacySessionProjectionBridge({
      reduxStore,
      now: () => nowMs
    })

    expect(bridge.projectionStore.getVersion()).toBe(0)
    expect(bridge.projectionStore.getSnapshot().eventCursor).toBe(0)

    state = { ...state }
    publish()
    expect(bridge.projectionStore.getVersion()).toBe(0)

    nowMs = 2000
    state = {
      ...state,
      session: {
        ...state.session,
        users: 2
      }
    }
    publish()

    expect(bridge.projectionStore.getVersion()).toBe(1)
    expect(bridge.projectionStore.getSnapshot().eventCursor).toBe(1)
    expect(bridge.projectionStore.getSnapshot().playback.updatedAtHostMs).toBe(2000)

    bridge.dispose()

    nowMs = 3000
    state = {
      ...state,
      users: {
        ...state.users,
        host: 'host-2'
      }
    }
    publish()

    expect(bridge.projectionStore.getVersion()).toBe(1)
  })
})

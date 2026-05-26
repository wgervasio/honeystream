import { SessionMediaItem, createSessionState } from './session-state'
import {
  transitionAdvanceQueue,
  transitionGuestJoined,
  transitionQueueMedia,
  transitionTogglePlayback
} from './transitions'

const makeMedia = (id: string): SessionMediaItem => ({
  id,
  url: `https://example.com/${id}`,
  title: id,
  requestedBy: 'host-1',
  durationMs: 5000
})

describe('domain/transitions', () => {
  it('allows one guest and rejects a second unique guest', () => {
    const initial = createSessionState({
      roomId: 'room-1',
      hostId: 'host-1',
      hostUsername: 'Host',
      nowHostMs: 0
    })

    const firstJoin = transitionGuestJoined(initial, 'guest-1', 'Guest', 100)
    expect(firstJoin.errors).toEqual([])
    expect(firstJoin.state.participants.guest).toMatchObject({ id: 'guest-1' })

    const secondJoin = transitionGuestJoined(firstJoin.state, 'guest-2', 'Other', 110)
    expect(secondJoin.errors).toHaveLength(1)
    expect(secondJoin.errors[0].code).toBe('guest-slot-occupied')
    expect(secondJoin.events[0]).toEqual({
      type: 'error',
      timestampMs: 110,
      code: 'guest-slot-occupied',
      message: 'Only one guest may join a session.'
    })
  })

  it('caps queue operations and advances playback using queued media', () => {
    const initial = createSessionState({
      roomId: 'room-1',
      hostId: 'host-1',
      hostUsername: 'Host',
      nowHostMs: 0
    })

    const first = transitionQueueMedia(initial, makeMedia('m1'), 0, 1)
    expect(first.state.current && first.state.current.id).toBe('m1')
    expect(first.state.queue).toEqual([])

    const second = transitionQueueMedia(first.state, makeMedia('m2'), 10, 1)
    expect(second.errors).toEqual([])
    expect(second.state.queue).toHaveLength(1)

    const third = transitionQueueMedia(second.state, makeMedia('m3'), 20, 1)
    expect(third.errors).toHaveLength(1)
    expect(third.errors[0].code).toBe('queue-cap-reached')

    const advanced = transitionAdvanceQueue(second.state, 30)
    expect(advanced.errors).toEqual([])
    expect(advanced.state.current && advanced.state.current.id).toBe('m2')
    expect(advanced.state.queue).toEqual([])
  })

  it('toggles playback state for active current media', () => {
    const initial = createSessionState({
      roomId: 'room-1',
      hostId: 'host-1',
      hostUsername: 'Host',
      nowHostMs: 0
    })

    const started = transitionQueueMedia(initial, makeMedia('m1'), 0, 1)
    expect(started.state.playback.state).toBe('playing')

    const paused = transitionTogglePlayback(started.state, 1000)
    expect(paused.errors).toEqual([])
    expect(paused.state.playback.state).toBe('paused')
  })
})

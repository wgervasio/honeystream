import {
  SessionMediaItem,
  createSessionState,
  transitionAdvanceQueue,
  transitionGuestJoined,
  transitionQueueMedia,
  transitionRemoveQueuedMedia
} from '../../domain'
import {
  bridgeTransitionToProtocol,
  toProtocolHostEventsFromTransition,
  toProtocolSessionSnapshot,
  toProtocolSnapshotHostEvent,
  validateClientCommandForRuntimeDispatch
} from './index'

const createMedia = (id: string): SessionMediaItem => ({
  id,
  url: `https://example.com/${id}`,
  title: `Media ${id}`,
  requestedBy: 'host-1',
  durationMs: 120000
})

const createBaseState = () =>
  createSessionState({
    roomId: 'room-1',
    hostId: 'host-1',
    hostUsername: 'Host',
    nowHostMs: 0
  })

describe('runtime/protocol bridge helpers', () => {
  it('maps session state into protocol snapshots with configurable cursor and media kind', () => {
    const joined = transitionGuestJoined(createBaseState(), 'guest-1', 'Guest', 5)
    const first = transitionQueueMedia(joined.state, createMedia('m1'), 10)
    const second = transitionQueueMedia(first.state, createMedia('m2'), 20)

    const snapshot = toProtocolSessionSnapshot(second.state, {
      eventCursor: 12,
      resolveMediaKind: media => (media.id === 'm2' ? 'website' : 'url')
    })

    expect(snapshot.roomId).toBe('room-1')
    expect(snapshot.status).toBe('connected')
    expect(snapshot.participants.host).toEqual({
      peerId: 'host-1',
      username: 'Host',
      role: 'host'
    })
    expect(snapshot.participants.guest).toEqual({
      peerId: 'guest-1',
      username: 'Guest',
      role: 'guest'
    })
    expect(snapshot.currentMediaId).toBe('m1')
    expect(snapshot.queue).toEqual([
      {
        mediaId: 'm2',
        kind: 'website',
        source: 'https://example.com/m2',
        title: 'Media m2',
        durationMs: 120000
      }
    ])
    expect(snapshot.playback.state).toBe('playing')
    expect(snapshot.eventCursor).toBe(12)

    const snapshotEvent = toProtocolSnapshotHostEvent(second.state)
    expect(snapshotEvent.type).toBe('snapshot')
  })

  it('emits mediaQueued when a transition appends queue items', () => {
    const first = transitionQueueMedia(createBaseState(), createMedia('m1'), 10)
    const second = transitionQueueMedia(first.state, createMedia('m2'), 20)

    const events = toProtocolHostEventsFromTransition(first.state, second)
    expect(events).toHaveLength(1)

    const queuedEvent = events[0]
    if (queuedEvent.type !== 'mediaQueued') {
      throw new Error('Expected mediaQueued event')
    }

    expect(queuedEvent.position).toBe(0)
    expect(queuedEvent.media).toEqual({
      mediaId: 'm2',
      kind: 'url',
      source: 'https://example.com/m2',
      title: 'Media m2',
      durationMs: 120000
    })
  })

  it('emits currentMediaChanged and playbackChanged when advancing the queue', () => {
    const first = transitionQueueMedia(createBaseState(), createMedia('m1'), 10)
    const second = transitionQueueMedia(first.state, createMedia('m2'), 20)
    const advanced = transitionAdvanceQueue(second.state, 30)

    const events = toProtocolHostEventsFromTransition(second.state, advanced)
    expect(events).toHaveLength(2)
    expect(events.some(event => event.type === 'mediaRemoved')).toBe(false)

    const currentChangedEvent = events[0]
    if (currentChangedEvent.type !== 'currentMediaChanged') {
      throw new Error('Expected currentMediaChanged event')
    }
    expect(currentChangedEvent.mediaId).toBe('m2')

    const playbackChangedEvent = events[1]
    if (playbackChangedEvent.type !== 'playbackChanged') {
      throw new Error('Expected playbackChanged event')
    }
    expect(playbackChangedEvent.playback).toMatchObject({
      state: 'playing',
      positionMs: 0,
      updatedAtHostMs: 30,
      rate: 1
    })
    expect(playbackChangedEvent.playback.durationMs).toBeUndefined()
  })

  it('emits mediaRemoved when queued media is explicitly removed', () => {
    const first = transitionQueueMedia(createBaseState(), createMedia('m1'), 10)
    const second = transitionQueueMedia(first.state, createMedia('m2'), 20)
    const removed = transitionRemoveQueuedMedia(second.state, 'm2', 40)

    const events = toProtocolHostEventsFromTransition(second.state, removed)
    expect(events).toEqual([{ type: 'mediaRemoved', mediaId: 'm2' }])
  })

  it('maps domain transition failures into systemError host events', () => {
    const firstJoin = transitionGuestJoined(createBaseState(), 'guest-1', 'Guest', 10)
    const secondJoin = transitionGuestJoined(firstJoin.state, 'guest-2', 'Other', 20)

    const events = toProtocolHostEventsFromTransition(firstJoin.state, secondJoin)
    expect(events).toHaveLength(1)

    const errorEvent = events[0]
    if (errorEvent.type !== 'systemError') {
      throw new Error('Expected systemError event')
    }
    expect(errorEvent.errorCode).toBe('guest-slot-occupied')
    expect(errorEvent.message).toBe('Only one guest may join a session.')
  })

  it('returns transition bridge outputs as protocol events plus snapshot', () => {
    const first = transitionQueueMedia(createBaseState(), createMedia('m1'), 10)
    const second = transitionQueueMedia(first.state, createMedia('m2'), 20)
    const removed = transitionRemoveQueuedMedia(second.state, 'm2', 40)

    const bridged = bridgeTransitionToProtocol(second.state, removed)
    expect(bridged.events).toEqual([{ type: 'mediaRemoved', mediaId: 'm2' }])
    expect(bridged.snapshot.currentMediaId).toBe('m1')
    expect(bridged.snapshot.queue).toEqual([])
  })

  it('validates inbound client commands for runtime dispatch', () => {
    const validCommand = validateClientCommandForRuntimeDispatch({
      type: 'seek',
      positionMs: 900
    })
    expect(validCommand.ok).toBe(true)
    if (validCommand.ok) {
      expect(validCommand.value).toEqual({
        type: 'seek',
        positionMs: 900
      })
    }

    const invalidCommand = validateClientCommandForRuntimeDispatch({
      type: 'seek',
      positionMs: -1
    })
    expect(invalidCommand.ok).toBe(false)
    if (!invalidCommand.ok) {
      expect(invalidCommand.error.code).toBe('malformedValue')
      expect(invalidCommand.error.path).toBe('command.positionMs')
    }
  })
})

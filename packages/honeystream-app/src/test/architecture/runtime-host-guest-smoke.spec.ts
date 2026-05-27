import {
  createSessionState,
  SessionMediaItem,
  SessionState,
  transitionGuestJoined,
  transitionQueueMedia,
  transitionSeekPlayback
} from '../../domain'
import { ClientCommand, HostEvent, PROTOCOL_VERSION, SessionSnapshot } from '../../protocol'
import {
  ClientToHostWireEnvelope,
  HostToClientWireEnvelope,
  createFakeTransportPair
} from './fake-transport'
import { createFakeClock, createFakeIdGenerator, createFixedIdGenerator } from './index'

type AddMediaCommand = Extract<ClientCommand, { type: 'addMedia' }>

const toSessionMediaItem = (
  command: AddMediaCommand,
  requestedBy: string
): SessionMediaItem => ({
  id: command.media.mediaId,
  url: command.media.source,
  title: command.media.title,
  durationMs: command.media.durationMs,
  requestedBy
})

const toSessionSnapshot = (state: SessionState): SessionSnapshot => ({
  roomId: state.roomId,
  status: state.status,
  participants: {
    host: {
      peerId: state.participants.host.id,
      username: state.participants.host.username,
      role: 'host'
    },
    guest: state.participants.guest
      ? {
          peerId: state.participants.guest.id,
          username: state.participants.guest.username,
          role: 'guest'
        }
      : undefined
  },
  queue: state.queue.map(media => ({
    mediaId: media.id,
    kind: 'url',
    source: media.url,
    title: media.title,
    durationMs: media.durationMs
  })),
  currentMediaId: state.current ? state.current.id : undefined,
  currentMedia: state.current
    ? {
        mediaId: state.current.id,
        kind: 'url',
        source: state.current.url,
        title: state.current.title,
        durationMs: state.current.durationMs
      }
    : undefined,
  playback: {
    state: state.playback.state,
    positionMs: state.playback.positionMs,
    updatedAtHostMs: state.playback.updatedAtHostMs,
    rate: state.playback.rate,
    durationMs: state.playback.durationMs
  },
  eventCursor: state.events.length
})

const applyGuestCommand = (
  state: SessionState,
  command: ClientCommand,
  guestPeerId: string,
  nowHostMs: number
): SessionState => {
  switch (command.type) {
    case 'join':
      return transitionGuestJoined(state, guestPeerId, command.username, nowHostMs).state
    case 'addMedia':
      return transitionQueueMedia(state, toSessionMediaItem(command, guestPeerId), nowHostMs).state
    case 'seek':
      return transitionSeekPlayback(state, command.positionMs, nowHostMs).state
    case 'requestSnapshot':
      return state
    default:
      throw new Error(`Unsupported smoke command "${command.type}"`)
  }
}

const createClientToHostEnvelope = (
  seq: number,
  sentAtMs: number,
  command: ClientCommand
): ClientToHostWireEnvelope => ({
  version: PROTOCOL_VERSION,
  seq,
  sentAtMs,
  direction: 'client-to-host',
  command
})

const createHostToClientEnvelope = (
  seq: number,
  sentAtMs: number,
  event: HostEvent
): HostToClientWireEnvelope => ({
  version: PROTOCOL_VERSION,
  seq,
  sentAtMs,
  direction: 'host-to-client',
  event
})

describe('runtime host/guest smoke', () => {
  it('runs a host-authoritative flow with fake clock, IDs, and transport without browser e2e', async () => {
    const clock = createFakeClock(1_000)
    const peerIds = createFixedIdGenerator(['host-peer-1', 'guest-peer-1'])
    const mediaIds = createFakeIdGenerator('media', 7)

    const hostPeerId = peerIds.next()
    const guestPeerId = peerIds.next()
    const pair = createFakeTransportPair({
      hostPeerId,
      guestPeerId,
      now: clock.nowMs
    })

    let hostState = createSessionState({
      roomId: 'room-1',
      hostId: hostPeerId,
      hostUsername: 'Host',
      nowHostMs: clock.nowMs()
    })

    const guestSnapshots: SessionSnapshot[] = []
    let hostSeq = 0
    let guestSeq = 0

    const sendHostEvent = (event: HostEvent): void => {
      hostSeq += 1
      const sentAtMs = clock.nowMs()
      const message = createHostToClientEnvelope(hostSeq, sentAtMs, event)
      pair.host.send({
        seq: hostSeq,
        sentAtMs,
        message
      })
    }

    const sendGuestCommand = (command: ClientCommand): void => {
      guestSeq += 1
      const sentAtMs = clock.nowMs()
      const message = createClientToHostEnvelope(guestSeq, sentAtMs, command)
      pair.guest.send({
        seq: guestSeq,
        sentAtMs,
        message
      })
    }

    pair.guest.subscribe(event => {
      if (event.type !== 'message') return
      const hostMessage = event.delivery.envelope.message
      if (hostMessage.event.type === 'snapshot') {
        guestSnapshots.push(hostMessage.event.snapshot)
      }
    })

    pair.host.subscribe(event => {
      if (event.type !== 'message') return

      const guestMessage = event.delivery.envelope.message
      hostState = applyGuestCommand(
        hostState,
        guestMessage.command,
        event.delivery.fromPeerId,
        clock.nowMs()
      )

      sendHostEvent({
        type: 'snapshot',
        snapshot: toSessionSnapshot(hostState)
      })
    })

    await pair.host.connect()

    sendGuestCommand({
      type: 'join',
      username: 'GuestUser',
      inviteSecret: 'invite-secret'
    })

    const mediaId = mediaIds.next()
    clock.advanceBy(25)
    sendGuestCommand({
      type: 'addMedia',
      media: {
        mediaId,
        kind: 'url',
        source: 'https://example.com/video.mp4',
        title: 'Example Clip',
        durationMs: 9_000
      }
    })

    clock.advanceBy(2_500)
    sendGuestCommand({
      type: 'seek',
      positionMs: 2_000
    })

    clock.advanceBy(10)
    sendGuestCommand({
      type: 'requestSnapshot',
      reason: 'manual'
    })

    expect(guestSnapshots).toHaveLength(4)
    const finalSnapshot = guestSnapshots[guestSnapshots.length - 1]
    if (!finalSnapshot) {
      throw new Error('Expected at least one guest snapshot.')
    }

    expect(hostState.status).toBe('connected')
    expect(hostState.participants.guest).toMatchObject({
      id: guestPeerId,
      username: 'GuestUser'
    })
    expect(hostState.current && hostState.current.id).toBe(mediaId)
    expect(hostState.playback).toEqual({
      state: 'playing',
      positionMs: 2_000,
      updatedAtHostMs: 3_525,
      rate: 1,
      durationMs: 9_000
    })

    expect(finalSnapshot.status).toBe('connected')
    expect(finalSnapshot.participants.host.peerId).toBe(hostPeerId)
    expect(finalSnapshot.participants.guest).toMatchObject({
      peerId: guestPeerId,
      username: 'GuestUser'
    })
    expect(finalSnapshot.currentMediaId).toBe(mediaId)
    expect(finalSnapshot.playback).toEqual(hostState.playback)
    expect(finalSnapshot.eventCursor).toBe(1)
  })
})

import {
  SessionMediaItem,
  SessionState,
  createSessionState
} from 'domain/session-state'
import { SystemEvent } from 'domain/event-log'
import {
  DomainError,
  TransitionResult,
  transitionAdvanceQueue,
  transitionGuestJoined,
  transitionGuestLeft,
  transitionQueueMedia,
  transitionRemoveQueuedMedia,
  transitionSeekPlayback,
  transitionSetPlaybackRate,
  transitionTogglePlayback
} from 'domain/transitions'
import {
  ClientCommand,
  ClientToHostEnvelope,
  HostEvent,
  HostToClientEnvelope,
  MediaSnapshot,
  PROTOCOL_VERSION,
  PlaybackSnapshot,
  ProtocolError,
  SessionSnapshot
} from 'protocol/types'
import { PeerTransport, PeerTransportEvent } from 'transport/contracts'
import { ProjectionStore, createProjectionStore } from 'ui'

export interface FlowClock {
  nowMs(): number
}

export interface FlowIdGenerator {
  nextId(): string
}

export interface CreateHostGuestSessionFlowOptions {
  readonly hostUsername: unknown
  readonly hostTransport: PeerTransport<ClientToHostEnvelope, HostToClientEnvelope>
  readonly guestTransport: PeerTransport<HostToClientEnvelope, ClientToHostEnvelope>
  readonly clock: FlowClock
  readonly idGenerator: FlowIdGenerator
  readonly queueCap?: number
}

export interface HostGuestSessionFlow {
  readonly roomId: string
  readonly inviteSecret: string
  readonly hostProjection: ProjectionStore<SessionSnapshot>
  readonly guestProjection: ProjectionStore<SessionSnapshot>
  connect(): Promise<void>
  sendGuestCommand(command: ClientCommand): void
  getHostEvents(): readonly HostEvent[]
  dispose(): void
}

const DEFAULT_QUEUE_CAP = 50

const normalizeQueueCap = (value: number | undefined): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value) || value < 1) {
    return DEFAULT_QUEUE_CAP
  }
  return value
}

const toMediaSnapshot = (media: SessionMediaItem): MediaSnapshot => ({
  mediaId: media.id,
  kind: 'url',
  source: media.url,
  title: media.title,
  durationMs: media.durationMs
})

const toSessionMediaItem = (media: MediaSnapshot, requestedBy: string): SessionMediaItem => ({
  id: media.mediaId,
  url: media.source,
  title: media.title,
  durationMs: media.durationMs,
  requestedBy
})

const toPlaybackSnapshot = (state: SessionState): PlaybackSnapshot => ({
  state: state.playback.state,
  positionMs: state.playback.positionMs,
  updatedAtHostMs: state.playback.updatedAtHostMs,
  rate: state.playback.rate,
  durationMs: state.playback.durationMs
})

const playbackSnapshotEquals = (left: PlaybackSnapshot, right: PlaybackSnapshot): boolean =>
  left.state === right.state &&
  left.positionMs === right.positionMs &&
  left.updatedAtHostMs === right.updatedAtHostMs &&
  left.rate === right.rate &&
  left.durationMs === right.durationMs

const toSessionSnapshot = (state: SessionState): SessionSnapshot => ({
  roomId: state.roomId,
  status: state.status,
  participants: {
    host: {
      peerId: state.participants.host.id,
      username: state.participants.host.username,
      role: state.participants.host.role
    },
    guest: state.participants.guest
      ? {
          peerId: state.participants.guest.id,
          username: state.participants.guest.username,
          role: state.participants.guest.role
        }
      : undefined
  },
  queue: state.queue.map(toMediaSnapshot),
  currentMediaId: state.current ? state.current.id : undefined,
  playback: toPlaybackSnapshot(state),
  eventCursor: state.events.length
})

const toProtocolRejected = (message: string, path: string): ProtocolError => ({
  type: 'protocolError',
  version: PROTOCOL_VERSION,
  code: 'invalidCommand',
  message,
  path
})

const mapSystemEventToHostEvent = (state: SessionState, event: SystemEvent): HostEvent | undefined => {
  if (event.type === 'participantJoined') {
    const participant =
      state.participants.host.id === event.participantId
        ? state.participants.host
        : state.participants.guest && state.participants.guest.id === event.participantId
          ? state.participants.guest
          : undefined

    if (!participant) {
      return undefined
    }

    return {
      type: 'participantJoined',
      participant: {
        peerId: participant.id,
        username: participant.username,
        role: participant.role
      }
    }
  }

  if (event.type === 'participantLeft') {
    return {
      type: 'participantLeft',
      peerId: event.participantId
    }
  }

  return {
    type: 'systemError',
    errorCode: event.code,
    message: event.message
  }
}

const insertQueuedMedia = (
  queue: readonly MediaSnapshot[],
  media: MediaSnapshot,
  position: number
): readonly MediaSnapshot[] => {
  const index = Math.max(0, Math.min(Math.floor(position), queue.length))
  const nextQueue = queue.slice()
  nextQueue.splice(index, 0, media)
  return nextQueue
}

export const applyHostEventToSnapshot = (
  snapshot: SessionSnapshot,
  event: HostEvent
): SessionSnapshot => {
  switch (event.type) {
    case 'snapshot':
      return event.snapshot
    case 'participantJoined':
      if (event.participant.role === 'host') {
        if (
          snapshot.participants.host.peerId === event.participant.peerId &&
          snapshot.participants.host.username === event.participant.username
        ) {
          return snapshot
        }

        return {
          ...snapshot,
          participants: {
            ...snapshot.participants,
            host: event.participant
          }
        }
      }

      if (
        snapshot.participants.guest &&
        snapshot.participants.guest.peerId === event.participant.peerId &&
        snapshot.participants.guest.username === event.participant.username
      ) {
        return snapshot
      }

      return {
        ...snapshot,
        status: 'connected',
        participants: {
          host: snapshot.participants.host,
          guest: event.participant
        }
      }
    case 'participantLeft':
      if (
        snapshot.participants.guest &&
        snapshot.participants.guest.peerId === event.peerId
      ) {
        return {
          ...snapshot,
          status: 'hosting',
          participants: {
            host: snapshot.participants.host
          }
        }
      }

      if (snapshot.participants.host.peerId === event.peerId) {
        return {
          ...snapshot,
          status: 'ended'
        }
      }

      return snapshot
    case 'mediaQueued':
      return {
        ...snapshot,
        queue: insertQueuedMedia(snapshot.queue, event.media, event.position)
      }
    case 'mediaRemoved': {
      const nextQueue = snapshot.queue.filter(item => item.mediaId !== event.mediaId)
      if (nextQueue.length === snapshot.queue.length) {
        return snapshot
      }

      return {
        ...snapshot,
        queue: nextQueue
      }
    }
    case 'currentMediaChanged':
      if (snapshot.currentMediaId === event.mediaId) {
        return snapshot
      }

      return {
        ...snapshot,
        currentMediaId: event.mediaId
      }
    case 'playbackChanged':
      if (playbackSnapshotEquals(snapshot.playback, event.playback)) {
        return snapshot
      }

      return {
        ...snapshot,
        playback: event.playback
      }
    case 'systemError':
    case 'protocolRejected':
      return snapshot
  }
}

const deriveCommandEvents = (
  previousState: SessionState,
  nextState: SessionState,
  command: ClientCommand
): readonly HostEvent[] => {
  const events: HostEvent[] = []

  if (command.type === 'addMedia') {
    if (previousState.current?.id !== nextState.current?.id) {
      events.push({
        type: 'currentMediaChanged',
        mediaId: nextState.current ? nextState.current.id : undefined
      })
    } else if (
      previousState.queue.length < nextState.queue.length &&
      nextState.queue.length > 0
    ) {
      const queued = nextState.queue[nextState.queue.length - 1]
      events.push({
        type: 'mediaQueued',
        media: toMediaSnapshot(queued),
        position: nextState.queue.length - 1
      })
    }
  } else if (command.type === 'removeMedia') {
    if (previousState.queue.length > nextState.queue.length) {
      events.push({
        type: 'mediaRemoved',
        mediaId: command.mediaId
      })
    }
  } else if (command.type === 'next') {
    if (previousState.current?.id !== nextState.current?.id) {
      events.push({
        type: 'currentMediaChanged',
        mediaId: nextState.current ? nextState.current.id : undefined
      })
    }
  }

  if (
    command.type === 'addMedia' ||
    command.type === 'next' ||
    command.type === 'playPause' ||
    command.type === 'seek' ||
    command.type === 'setRate'
  ) {
    const previousPlayback = toPlaybackSnapshot(previousState)
    const nextPlayback = toPlaybackSnapshot(nextState)
    if (!playbackSnapshotEquals(previousPlayback, nextPlayback)) {
      events.push({
        type: 'playbackChanged',
        playback: nextPlayback
      })
    }
  }

  return events
}

const commandPath = (command: ClientCommand): string => `command.${command.type}`

const isGuestCommand = (command: ClientCommand): boolean => command.type !== 'join'

const rejectDomainErrors = (
  command: ClientCommand,
  errors: readonly DomainError[],
  emitHostEvent: (event: HostEvent) => void
): void => {
  if (errors.length === 0) {
    return
  }

  for (const error of errors) {
    emitHostEvent({
      type: 'protocolRejected',
      error: toProtocolRejected(error.message, commandPath(command))
    })
  }
}

export const createHostGuestSessionFlow = (
  options: CreateHostGuestSessionFlowOptions
): HostGuestSessionFlow => {
  const queueCap = normalizeQueueCap(options.queueCap)
  const roomId = options.idGenerator.nextId()
  const inviteSecret = options.idGenerator.nextId()

  let state = createSessionState({
    roomId,
    hostId: options.hostTransport.localPeerId,
    hostUsername: options.hostUsername,
    nowHostMs: options.clock.nowMs()
  })

  const initialSnapshot = toSessionSnapshot(state)
  const hostProjection = createProjectionStore(initialSnapshot)
  const guestProjection = createProjectionStore(initialSnapshot)

  const hostEvents: HostEvent[] = []
  let nextClientSeq = 0
  let nextHostSeq = 0
  let disposed = false

  const emitHostEvent = (event: HostEvent): void => {
    const sentAtMs = options.clock.nowMs()
    const seq = nextHostSeq
    nextHostSeq += 1

    hostEvents.push(event)
    const message: HostToClientEnvelope = {
      version: PROTOCOL_VERSION,
      direction: 'host-to-client',
      seq,
      sentAtMs,
      event
    }

    options.hostTransport.send({
      seq,
      sentAtMs,
      message
    })
  }

  const emitSnapshot = (): void => {
    emitHostEvent({
      type: 'snapshot',
      snapshot: toSessionSnapshot(state)
    })
  }

  const commitTransition = (
    previousState: SessionState,
    transition: TransitionResult,
    command: ClientCommand
  ): void => {
    state = transition.state
    hostProjection.setSnapshot(toSessionSnapshot(state))

    rejectDomainErrors(command, transition.errors, emitHostEvent)

    for (const systemEvent of transition.events) {
      const hostEvent = mapSystemEventToHostEvent(state, systemEvent)
      if (hostEvent) {
        emitHostEvent(hostEvent)
      }
    }

    const commandEvents = deriveCommandEvents(previousState, state, command)
    for (const commandEvent of commandEvents) {
      emitHostEvent(commandEvent)
    }
  }

  const rejectCommand = (command: ClientCommand, message: string): void => {
    emitHostEvent({
      type: 'protocolRejected',
      error: toProtocolRejected(message, commandPath(command))
    })
  }

  const handleClientCommand = (
    envelope: ClientToHostEnvelope,
    fromPeerId: string
  ): void => {
    const command = envelope.command

    if (command.type === 'join') {
      if (command.inviteSecret !== inviteSecret) {
        rejectCommand(command, 'Invite secret does not match the host session.')
        return
      }

      const previousState = state
      const transition = transitionGuestJoined(
        state,
        fromPeerId,
        command.username,
        options.clock.nowMs()
      )
      commitTransition(previousState, transition, command)

      if (transition.errors.length === 0) {
        emitSnapshot()
      }
      return
    }

    const activeGuestId = state.participants.guest ? state.participants.guest.id : undefined
    if (isGuestCommand(command) && activeGuestId !== fromPeerId) {
      rejectCommand(command, 'Guest must join the host session before issuing commands.')
      return
    }

    if (command.type === 'requestSnapshot') {
      emitSnapshot()
      return
    }

    const nowHostMs = options.clock.nowMs()
    const previousState = state

    if (command.type === 'leave') {
      commitTransition(previousState, transitionGuestLeft(state, fromPeerId, nowHostMs), command)
      return
    }

    if (command.type === 'addMedia') {
      commitTransition(
        previousState,
        transitionQueueMedia(
          state,
          toSessionMediaItem(command.media, fromPeerId),
          nowHostMs,
          queueCap
        ),
        command
      )
      return
    }

    if (command.type === 'removeMedia') {
      commitTransition(previousState, transitionRemoveQueuedMedia(state, command.mediaId, nowHostMs), command)
      return
    }

    if (command.type === 'playPause') {
      const currentlyPlaying = state.playback.state === 'playing'
      if (currentlyPlaying === command.playing) {
        return
      }

      commitTransition(previousState, transitionTogglePlayback(state, nowHostMs), command)
      return
    }

    if (command.type === 'seek') {
      commitTransition(previousState, transitionSeekPlayback(state, command.positionMs, nowHostMs), command)
      return
    }

    if (command.type === 'setRate') {
      commitTransition(previousState, transitionSetPlaybackRate(state, command.rate, nowHostMs), command)
      return
    }

    commitTransition(previousState, transitionAdvanceQueue(state, nowHostMs), command)
  }

  const handleHostTransportEvent = (
    event: PeerTransportEvent<ClientToHostEnvelope>
  ): void => {
    if (event.type !== 'message') {
      return
    }

    handleClientCommand(event.delivery.envelope.message, event.delivery.fromPeerId)
  }

  const handleGuestTransportEvent = (
    event: PeerTransportEvent<HostToClientEnvelope>
  ): void => {
    if (event.type !== 'message') {
      return
    }

    const nextSnapshot = applyHostEventToSnapshot(
      guestProjection.getSnapshot(),
      event.delivery.envelope.message.event
    )
    guestProjection.setSnapshot(nextSnapshot)
  }

  const unsubscribeHost = options.hostTransport.subscribe(handleHostTransportEvent)
  const unsubscribeGuest = options.guestTransport.subscribe(handleGuestTransportEvent)

  return {
    roomId,
    inviteSecret,
    hostProjection,
    guestProjection,
    connect(): Promise<void> {
      if (disposed) {
        throw new Error('Cannot connect disposed host/guest session flow.')
      }

      return options.hostTransport.connect()
    },
    sendGuestCommand(command: ClientCommand): void {
      if (disposed) {
        throw new Error('Cannot send guest command after host/guest session flow disposal.')
      }

      const sentAtMs = options.clock.nowMs()
      const seq = nextClientSeq
      nextClientSeq += 1

      const message: ClientToHostEnvelope = {
        version: PROTOCOL_VERSION,
        direction: 'client-to-host',
        seq,
        sentAtMs,
        command
      }

      options.guestTransport.send({
        seq,
        sentAtMs,
        message
      })
    },
    getHostEvents(): readonly HostEvent[] {
      return hostEvents.slice()
    },
    dispose(): void {
      if (disposed) {
        return
      }

      disposed = true
      unsubscribeHost()
      unsubscribeGuest()
      options.hostTransport.dispose()
      options.guestTransport.dispose()
    }
  }
}

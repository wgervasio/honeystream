import {
  SessionMediaItem,
  SessionState,
  SystemEvent,
  TransitionResult
} from '../../domain'
import { HostEvent, SessionSnapshot } from '../../protocol/types'
import {
  ResolveMediaKind,
  SessionSnapshotBridgeOptions,
  toProtocolMediaSnapshot,
  toProtocolPlaybackSnapshot,
  toProtocolSessionSnapshot
} from './session-snapshot-bridge'

export interface TransitionProtocolBridge {
  readonly events: readonly HostEvent[]
  readonly snapshot: SessionSnapshot
}

const containsMediaId = (
  queue: readonly SessionMediaItem[],
  mediaId: string
): boolean => queue.some(media => media.id === mediaId)

const toHostEventFromSystemEvent = (
  event: SystemEvent,
  state: SessionState
): HostEvent => {
  switch (event.type) {
    case 'participantJoined':
      return {
        type: 'participantJoined',
        participant: {
          peerId: event.participantId,
          username: event.username,
          role: state.participants.host.id === event.participantId ? 'host' : 'guest'
        }
      }
    case 'participantLeft':
      return {
        type: 'participantLeft',
        peerId: event.participantId
      }
    case 'error':
      return {
        type: 'systemError',
        errorCode: event.code,
        message: event.message
      }
  }
}

const appendQueueDiffEvents = (
  hostEvents: HostEvent[],
  previousState: SessionState,
  nextState: SessionState,
  resolveMediaKind: ResolveMediaKind | undefined
): void => {
  for (let index = 0; index < nextState.queue.length; index += 1) {
    const nextQueueItem = nextState.queue[index]
    if (containsMediaId(previousState.queue, nextQueueItem.id)) continue
    hostEvents.push({
      type: 'mediaQueued',
      media: resolveMediaKind
        ? toProtocolMediaSnapshot(nextQueueItem, resolveMediaKind)
        : toProtocolMediaSnapshot(nextQueueItem),
      position: index
    })
  }

  const nextCurrentMediaId = nextState.current ? nextState.current.id : undefined
  for (const previousQueueItem of previousState.queue) {
    const removedFromQueue = !containsMediaId(nextState.queue, previousQueueItem.id)
    if (!removedFromQueue || nextCurrentMediaId === previousQueueItem.id) continue
    hostEvents.push({
      type: 'mediaRemoved',
      mediaId: previousQueueItem.id
    })
  }
}

const hasPlaybackChanged = (
  previousState: SessionState,
  nextState: SessionState
): boolean => {
  const previousPlayback = previousState.playback
  const nextPlayback = nextState.playback
  return (
    previousPlayback.state !== nextPlayback.state ||
    previousPlayback.positionMs !== nextPlayback.positionMs ||
    previousPlayback.updatedAtHostMs !== nextPlayback.updatedAtHostMs ||
    previousPlayback.rate !== nextPlayback.rate ||
    previousPlayback.durationMs !== nextPlayback.durationMs
  )
}

export const toProtocolHostEventsFromTransition = (
  previousState: SessionState,
  transition: TransitionResult,
  options: SessionSnapshotBridgeOptions = {}
): readonly HostEvent[] => {
  const nextState = transition.state
  const hostEvents: HostEvent[] = transition.events.map(event =>
    toHostEventFromSystemEvent(event, nextState)
  )

  appendQueueDiffEvents(hostEvents, previousState, nextState, options.resolveMediaKind)

  const previousCurrentMediaId = previousState.current ? previousState.current.id : undefined
  const nextCurrentMediaId = nextState.current ? nextState.current.id : undefined
  if (previousCurrentMediaId !== nextCurrentMediaId) {
    const media = nextState.current
      ? options.resolveMediaKind
        ? toProtocolMediaSnapshot(nextState.current, options.resolveMediaKind)
        : toProtocolMediaSnapshot(nextState.current)
      : undefined
    hostEvents.push({
      type: 'currentMediaChanged',
      mediaId: nextCurrentMediaId,
      media
    })
  }

  if (hasPlaybackChanged(previousState, nextState)) {
    hostEvents.push({
      type: 'playbackChanged',
      playback: toProtocolPlaybackSnapshot(nextState.playback)
    })
  }

  return hostEvents
}

export const bridgeTransitionToProtocol = (
  previousState: SessionState,
  transition: TransitionResult,
  options: SessionSnapshotBridgeOptions = {}
): TransitionProtocolBridge => ({
  events: toProtocolHostEventsFromTransition(previousState, transition, options),
  snapshot: toProtocolSessionSnapshot(transition.state, options)
})

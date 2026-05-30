import {
  ClientToHostEnvelope,
  HostToClientEnvelope,
  MediaSnapshot,
  ParticipantSnapshot,
  SessionSnapshot
} from 'protocol/types'
import { toStreamingSitePlaybackSnapshot } from './streaming-site-connection-snapshot'

type SendClientCommand = (command: ClientToHostEnvelope['command']) => void
type SendHostEvent = (event: HostToClientEnvelope['event']) => void

const LAB_HOST: ParticipantSnapshot = Object.freeze({
  peerId: 'streaming-lab-host',
  username: 'Cat Host',
  role: 'host'
})

const LAB_GUEST: ParticipantSnapshot = Object.freeze({
  peerId: 'streaming-lab-guest',
  username: 'Rabbit Guest',
  role: 'guest'
})

const createStreamingSiteSessionSnapshot = (
  media: MediaSnapshot,
  nowHostMs: number,
  positionMs: number,
  rate: number
): SessionSnapshot => ({
  roomId: 'streaming-site-lab',
  status: 'connected',
  participants: {
    host: LAB_HOST,
    guest: LAB_GUEST
  },
  queue: [media],
  current: media,
  currentMediaId: media.mediaId,
  currentMedia: media,
  playback: toStreamingSitePlaybackSnapshot(media, nowHostMs, positionMs, rate),
  eventCursor: 0
})

/*
Context: The streaming-site lab should exercise the real two-person protocol shape, not only
standalone playback controls.
Invariant: Join and resync snapshots remain typed host/guest wire messages and stay within byte,
loss, ordering, and latency budgets.
Options considered: Aggregate-only playback controls, live website checks, or deterministic protocol
traffic around each mocked site.
Decision: Add one join handshake and a bounded host snapshot response for every resync request.
Performance impact: Adds fixed small JSON envelopes per run/fixture; video bytes still stay local.
Memory/lifecycle ownership: No resources are allocated; simulated owners dispose in the lab.
Failure mode: Oversized snapshots, loss, reordering, or latency regressions fail existing gates.
Validation: Covered by streaming-site connection lab and merge-gate tests.
*/
export const emitSiteJoin = (
  sendClientCommand: SendClientCommand,
  sendHostEvent: SendHostEvent
): void => {
  sendClientCommand({ type: 'join', username: LAB_GUEST.username, inviteSecret: 'streaming-lab' })
  sendHostEvent({ type: 'participantJoined', participant: LAB_GUEST })
}

export const emitSiteSnapshot = (
  sendHostEvent: SendHostEvent,
  media: MediaSnapshot,
  nowHostMs: number,
  positionMs: number,
  rate: number
): void => {
  sendHostEvent({
    type: 'snapshot',
    snapshot: createStreamingSiteSessionSnapshot(media, nowHostMs, positionMs, rate)
  })
}

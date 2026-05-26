import { parseWireEnvelope } from 'protocol'
import { ClientToHostEnvelope, HostToClientEnvelope } from 'protocol/types'
import { createFakeClock, createFixedIdGenerator } from 'test/architecture'
import { TransportMessageValidator } from 'transport/contracts'
import { createInMemoryPeerTransportPair } from 'transport/in-memory-peer-transport-pair'
import { createHostGuestSessionFlow } from './hostGuestSessionFlow'

const isClientToHostEnvelope = (value: unknown): value is ClientToHostEnvelope => {
  const parsed = parseWireEnvelope(value)
  return parsed.ok && parsed.value.direction === 'client-to-host'
}

const isHostToClientEnvelope = (value: unknown): value is HostToClientEnvelope => {
  const parsed = parseWireEnvelope(value)
  return parsed.ok && parsed.value.direction === 'host-to-client'
}

const describeEnvelope = (value: unknown, direction: 'client-to-host' | 'host-to-client'): string => {
  const parsed = parseWireEnvelope(value)
  if (!parsed.ok) {
    return parsed.error.message
  }

  if (parsed.value.direction !== direction) {
    return `Expected ${direction} envelope.`
  }

  return `Expected ${direction} envelope.`
}

const clientToHostValidator: TransportMessageValidator<ClientToHostEnvelope> = {
  validate: isClientToHostEnvelope,
  describeInvalidMessage: value => describeEnvelope(value, 'client-to-host')
}

const hostToClientValidator: TransportMessageValidator<HostToClientEnvelope> = {
  validate: isHostToClientEnvelope,
  describeInvalidMessage: value => describeEnvelope(value, 'host-to-client')
}

const createFlowHarness = () => {
  const clock = createFakeClock(1000)
  const peerIds = createFixedIdGenerator(['host-peer', 'guest-peer'])
  const flowIds = createFixedIdGenerator(['room-1', 'invite-1'])

  const pair = createInMemoryPeerTransportPair<ClientToHostEnvelope, HostToClientEnvelope>({
    hostPeerId: peerIds.nextId(),
    guestPeerId: peerIds.nextId(),
    hostInboundValidator: clientToHostValidator,
    guestInboundValidator: hostToClientValidator,
    now: clock.nowMs
  })

  const flow = createHostGuestSessionFlow({
    hostUsername: 'HostUser',
    hostTransport: pair.host,
    guestTransport: pair.guest,
    clock,
    idGenerator: {
      nextId: flowIds.nextId
    }
  })

  return { flow, clock }
}

describe('runtime/flows/hostGuestSessionFlow', () => {
  it('creates host session, joins guest by invite secret, and updates both projections', async () => {
    const { flow, clock } = createFlowHarness()

    try {
      await flow.connect()

      expect(flow.roomId).toBe('room-1')
      expect(flow.inviteSecret).toBe('invite-1')
      expect(flow.hostProjection.getSnapshot().status).toBe('hosting')
      expect(flow.hostProjection.getSnapshot().participants.host.peerId).toBe('host-peer')

      flow.sendGuestCommand({
        type: 'join',
        username: 'GuestUser',
        inviteSecret: flow.inviteSecret
      })

      clock.advanceBy(50)
      flow.sendGuestCommand({
        type: 'addMedia',
        media: {
          mediaId: 'media-1',
          kind: 'url',
          source: 'https://example.com/watch',
          title: 'Example',
          durationMs: 2000
        }
      })

      const hostSnapshot = flow.hostProjection.getSnapshot()
      const guestSnapshot = flow.guestProjection.getSnapshot()

      expect(hostSnapshot.status).toBe('connected')
      expect(guestSnapshot.status).toBe('connected')
      expect(hostSnapshot.participants.guest?.peerId).toBe('guest-peer')
      expect(guestSnapshot.participants.guest?.peerId).toBe('guest-peer')
      expect(hostSnapshot.currentMediaId).toBe('media-1')
      expect(guestSnapshot.currentMediaId).toBe('media-1')
      expect(hostSnapshot.playback.state).toBe('playing')
      expect(guestSnapshot.playback.state).toBe('playing')

      const hostEvents = flow.getHostEvents()
      expect(hostEvents.map(event => event.type)).toEqual([
        'participantJoined',
        'snapshot',
        'currentMediaChanged',
        'playbackChanged'
      ])

      const snapshotEvent = hostEvents[1]
      if (snapshotEvent.type !== 'snapshot') {
        throw new Error('Expected host join flow to emit a snapshot event.')
      }
      expect(snapshotEvent.snapshot.eventCursor).toBe(1)
    } finally {
      flow.dispose()
    }
  })

  it('rejects join commands with an invalid invite secret', async () => {
    const { flow } = createFlowHarness()

    try {
      await flow.connect()

      flow.sendGuestCommand({
        type: 'join',
        username: 'GuestUser',
        inviteSecret: 'wrong-secret'
      })

      const hostEvents = flow.getHostEvents()
      expect(hostEvents).toHaveLength(1)

      const event = hostEvents[0]
      if (event.type !== 'protocolRejected') {
        throw new Error('Expected invalid join to emit a protocolRejected event.')
      }

      expect(event.error.code).toBe('invalidCommand')
      expect(event.error.path).toBe('command.join')
      expect(flow.hostProjection.getSnapshot().participants.guest).toBeUndefined()
      expect(flow.guestProjection.getSnapshot().participants.guest).toBeUndefined()
    } finally {
      flow.dispose()
    }
  })

  it('rejects guest commands before successful join', async () => {
    const { flow } = createFlowHarness()

    try {
      await flow.connect()

      flow.sendGuestCommand({
        type: 'next'
      })

      const hostEvents = flow.getHostEvents()
      expect(hostEvents).toHaveLength(1)

      const event = hostEvents[0]
      if (event.type !== 'protocolRejected') {
        throw new Error('Expected pre-join command to emit a protocolRejected event.')
      }

      expect(event.error.code).toBe('invalidCommand')
      expect(event.error.path).toBe('command.next')
      expect(flow.hostProjection.getSnapshot().status).toBe('hosting')
      expect(flow.guestProjection.getSnapshot().status).toBe('hosting')
      expect(flow.hostProjection.getSnapshot().currentMediaId).toBeUndefined()
      expect(flow.guestProjection.getSnapshot().currentMediaId).toBeUndefined()
    } finally {
      flow.dispose()
    }
  })
})

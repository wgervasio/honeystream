import { parseWireEnvelope } from 'protocol'
import { ClientToHostEnvelope, HostToClientEnvelope } from 'protocol/types'
import { classifyMediaUrl } from 'protocol/url-classifier'
import { createFakeClock, createFixedIdGenerator } from 'test/architecture'
import { TransportMessageValidator } from 'transport/contracts'
import { createInMemoryPeerTransportPair } from 'transport/in-memory-peer-transport-pair'
import { createSimulatedPeerTransportPair } from 'transport/simulated-peer-transport-pair'
import { createHostGuestSessionFlow } from './hostGuestSessionFlow'

const isClientToHostEnvelope = (value: unknown): value is ClientToHostEnvelope => {
  const parsed = parseWireEnvelope(value)
  return parsed.ok && parsed.value.direction === 'client-to-host'
}

const isHostToClientEnvelope = (value: unknown): value is HostToClientEnvelope => {
  const parsed = parseWireEnvelope(value)
  return parsed.ok && parsed.value.direction === 'host-to-client'
}

const describeEnvelope = (
  value: unknown,
  direction: 'client-to-host' | 'host-to-client'
): string => {
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

const createFlowHarness = (hostEventsCap?: number) => {
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
    },
    hostEventsCap
  })

  return { flow, clock }
}

const streamingSiteFixtures = [
  {
    mediaId: 'site-youtube',
    title: 'YouTube watch page',
    source: 'https://www.youtube.com/watch?v=abc123'
  },
  {
    mediaId: 'site-animepahe',
    title: 'AnimePahe watch page',
    source: 'https://animepahe.ru/play/example'
  },
  {
    mediaId: 'site-cineby',
    title: 'Cineby movie page',
    source: 'https://cineby.app/movie/example'
  },
  {
    mediaId: 'site-miruro',
    title: 'Miruro watch page',
    source: 'https://www.miruro.tv/watch/example'
  }
]

const createSimulatedFlowHarness = () => {
  const clock = createFakeClock(2000)
  const peerIds = createFixedIdGenerator(['host-peer', 'guest-peer'])
  const flowIds = createFixedIdGenerator(['room-1', 'invite-1'])

  const pair = createSimulatedPeerTransportPair<ClientToHostEnvelope, HostToClientEnvelope>({
    hostPeerId: peerIds.nextId(),
    guestPeerId: peerIds.nextId(),
    hostInboundValidator: clientToHostValidator,
    guestInboundValidator: hostToClientValidator,
    now: clock.nowMs,
    random: () => 0.5,
    network: {
      latencyMs: 12,
      jitterMs: 4,
      maxQueuedFrames: 64
    }
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

  return { flow, clock, pair }
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
      const hostGuestParticipant = hostSnapshot.participants.guest
      const guestGuestParticipant = guestSnapshot.participants.guest

      expect(hostSnapshot.status).toBe('connected')
      expect(guestSnapshot.status).toBe('connected')
      expect(hostGuestParticipant).toBeDefined()
      expect(guestGuestParticipant).toBeDefined()
      if (!hostGuestParticipant || !guestGuestParticipant) {
        throw new Error(
          'Expected both host and guest projections to include guest participant data.'
        )
      }
      expect(hostGuestParticipant.peerId).toBe('guest-peer')
      expect(guestGuestParticipant.peerId).toBe('guest-peer')
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

  it('keeps streaming-site commands lossless under simulated low-latency transport', async () => {
    const { flow, clock, pair } = createSimulatedFlowHarness()

    try {
      await flow.connect()

      flow.sendGuestCommand({
        type: 'join',
        username: 'GuestUser',
        inviteSecret: flow.inviteSecret
      })
      pair.flushAll()

      for (let index = 0; index < streamingSiteFixtures.length; index += 1) {
        const fixture = streamingSiteFixtures[index]
        clock.advanceBy(16)
        flow.sendGuestCommand({
          type: 'addMedia',
          media: {
            mediaId: fixture.mediaId,
            kind: classifyMediaUrl(fixture.source),
            source: fixture.source,
            title: fixture.title,
            durationMs: 120000
          }
        })
        pair.flushAll()
      }

      const hostSnapshot = flow.hostProjection.getSnapshot()
      const guestSnapshot = flow.guestProjection.getSnapshot()
      const queuedSources = streamingSiteFixtures.slice(1).map(fixture => fixture.source)

      expect(hostSnapshot.status).toBe('connected')
      expect(guestSnapshot.status).toBe('connected')
      expect(hostSnapshot.currentMediaId).toBe('site-youtube')
      expect(guestSnapshot.currentMediaId).toBe('site-youtube')
      expect(hostSnapshot.queue.map(media => media.source)).toEqual(queuedSources)
      expect(guestSnapshot.queue.map(media => media.source)).toEqual(queuedSources)
      expect(hostSnapshot.queue.map(media => media.kind)).toEqual(['website', 'website', 'website'])
      expect(guestSnapshot.queue.map(media => media.kind)).toEqual([
        'website',
        'website',
        'website'
      ])

      const metrics = pair.getAggregateMetrics()
      expect(metrics.combinedSentMessages).toBeGreaterThan(0)
      expect(metrics.combinedDroppedMessages).toBe(0)
      expect(metrics.combinedLostBytes).toBe(0)
      expect(metrics.combinedDeliveryRate).toBe(1)
      expect(metrics.combinedByteLossRate).toBe(0)
      expect(metrics.combinedMaxLatencyMs).toBe(12)
      expect(metrics.combinedAverageMessageBytes).toBeLessThan(2500)
    } finally {
      flow.dispose()
    }
  })

  it('rejects lost guest commands and holds sequence state until a safe reconnect', async () => {
    const clock = createFakeClock(3000)
    const peerIds = createFixedIdGenerator(['host-peer', 'guest-peer'])
    const flowIds = createFixedIdGenerator(['room-1', 'invite-1'])
    const randomSamples = [0.9, 0.9, 0.9, 0.1, 0.9, 0.9, 0.9]
    const pair = createSimulatedPeerTransportPair<ClientToHostEnvelope, HostToClientEnvelope>({
      hostPeerId: peerIds.nextId(),
      guestPeerId: peerIds.nextId(),
      hostInboundValidator: clientToHostValidator,
      guestInboundValidator: hostToClientValidator,
      now: clock.nowMs,
      random: () => {
        const sample = randomSamples.shift()
        return typeof sample === 'number' ? sample : 0.9
      },
      network: {
        latencyMs: 5,
        dropRate: 0.5,
        maxQueuedFrames: 64
      }
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

    try {
      await flow.connect()
      flow.sendGuestCommand({
        type: 'join',
        username: 'GuestUser',
        inviteSecret: flow.inviteSecret
      })
      pair.flushAll()

      flow.sendGuestCommand({
        type: 'addMedia',
        media: {
          mediaId: 'lost-media',
          kind: 'website',
          source: 'https://animepahe.ru/play/lost',
          title: 'Lost command',
          durationMs: 120000
        }
      })
      flow.sendGuestCommand({
        type: 'addMedia',
        media: {
          mediaId: 'rejected-after-loss',
          kind: 'website',
          source: 'https://cineby.app/movie/rejected',
          title: 'Rejected after loss',
          durationMs: 120000
        }
      })
      pair.flushAll()

      expect(flow.hostProjection.getSnapshot().currentMediaId).toBeUndefined()
      expect(flow.getHostEvents()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'protocolRejected'
          })
        ])
      )

      flow.sendGuestCommand({
        type: 'addMedia',
        media: {
          mediaId: 'recovered-media',
          kind: 'website',
          source: 'https://miruro.to/watch/recovered',
          title: 'Recovered command',
          durationMs: 120000
        }
      })
      pair.flushAll()

      expect(flow.hostProjection.getSnapshot().currentMediaId).toBeUndefined()
      expect(flow.guestProjection.getSnapshot().currentMediaId).toBeUndefined()
      expect(flow.getHostEvents()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'protocolRejected'
          })
        ])
      )
      expect(pair.getAggregateMetrics().combinedDroppedMessages).toBeGreaterThan(0)
    } finally {
      flow.dispose()
    }
  })

  it('bounds retained host events while projections keep their latest state', async () => {
    const { flow } = createFlowHarness(3)

    try {
      await flow.connect()

      flow.sendGuestCommand({
        type: 'join',
        username: 'GuestUser',
        inviteSecret: flow.inviteSecret
      })
      for (let index = 0; index < 4; index += 1) {
        flow.sendGuestCommand({
          type: 'addMedia',
          media: {
            mediaId: `media-${index}`,
            kind: 'website',
            source: `https://www.youtube.com/watch?v=${index}`,
            title: `Media ${index}`,
            durationMs: 120000
          }
        })
      }

      expect(flow.getHostEvents()).toHaveLength(3)
      expect(flow.hostProjection.getSnapshot().queue.map(item => item.mediaId)).toEqual([
        'media-1',
        'media-2',
        'media-3'
      ])
    } finally {
      flow.dispose()
    }
  })
})

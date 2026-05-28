import {
  PlaybackEngineApplyResult,
  PlaybackEngineDesiredState
} from 'playback/engine/playbackEngineContract'
import { classifyMediaProvider, parseWireEnvelope, WireEnvelope } from 'protocol'
import { MediaSnapshot } from 'protocol/types'
import { TransportMessageValidator } from 'transport/contracts'
import { evaluateSimulatedPeerTransportBudget } from 'transport/simulated-peer-transport-performance'
import { createSimulatedPeerTransportPair } from 'transport/simulated-peer-transport-pair'
import { SessionRuntimePlaybackEngine } from './contracts'
import { createSessionRuntime } from './sessionRuntime'

type ClientToHostWireEnvelope = Extract<WireEnvelope, { direction: 'client-to-host' }>
type HostToClientWireEnvelope = Extract<WireEnvelope, { direction: 'host-to-client' }>

class CapturingPlaybackEngine implements SessionRuntimePlaybackEngine {
  readonly desiredStates: PlaybackEngineDesiredState[] = []
  disposeCallCount = 0

  async applyDesiredState(
    desiredState: PlaybackEngineDesiredState
  ): Promise<PlaybackEngineApplyResult> {
    this.desiredStates.push(desiredState)
    return {
      adapterCreated: false,
      mediaChanged: false,
      adapterDisposed: false,
      seekToleranceMs: 250,
      appliedPlayback: desiredState.playback
    }
  }

  dispose(): void {
    this.disposeCallCount += 1
  }
}

const createWireEnvelopeValidator = <TDirection extends WireEnvelope['direction']>(
  direction: TDirection
): TransportMessageValidator<Extract<WireEnvelope, { direction: TDirection }>> => ({
  validate: (value: unknown): value is Extract<WireEnvelope, { direction: TDirection }> => {
    const parsed = parseWireEnvelope(value)
    return parsed.ok && parsed.value.direction === direction
  },
  describeInvalidMessage: () => `Expected ${direction} wire envelope payload.`
})

const streamingRoundTripMedia: readonly MediaSnapshot[] = Object.freeze([
  {
    mediaId: 'youtube-main',
    kind: 'website',
    source: 'https://www.youtube.com/watch?v=honeystream-sync',
    title: 'YouTube watch page',
    durationMs: 180000
  },
  {
    mediaId: 'animepahe-main',
    kind: 'website',
    source: 'https://animepahe.ru/play/honeystream-test',
    title: 'AnimePahe episode',
    durationMs: 1440000
  },
  {
    mediaId: 'cineby-main',
    kind: 'website',
    source: 'https://cineby.app/movie/honeystream-test',
    title: 'Cineby movie',
    durationMs: 5400000
  },
  {
    mediaId: 'miruro-main',
    kind: 'website',
    source: 'https://miruro.to/watch/honeystream-test',
    title: 'Miruro watch page',
    durationMs: 1440000
  },
  {
    mediaId: 'direct-media-main',
    kind: 'url',
    source: 'https://cdn.example.com/honeystream/cozy-night.mp4',
    title: 'Direct MP4',
    durationMs: 90000
  }
])

const settleRuntime = async (): Promise<void> => {
  for (let pass = 0; pass < 6; pass += 1) {
    await Promise.resolve()
  }
}

const hasPlaybackMediaId = (
  desiredState: PlaybackEngineDesiredState,
  mediaId: string
): boolean => Boolean(desiredState.media && desiredState.media.mediaId === mediaId)

const findPlaybackMediaSource = (
  desiredStates: readonly PlaybackEngineDesiredState[],
  mediaId: string
): string => {
  const match = desiredStates.find(desiredState => hasPlaybackMediaId(desiredState, mediaId))
  if (!match || !match.media) {
    throw new Error(`Expected playback engine to apply media "${mediaId}".`)
  }

  return match.media.source
}

describe('runtime/session mocked host-guest e2e', () => {
  it('runs join, queue, play, seek, rate, next, and leave with zero control-byte loss', async () => {
    let nowMs = 50000
    const pair = createSimulatedPeerTransportPair<
      ClientToHostWireEnvelope,
      HostToClientWireEnvelope
    >({
      hostInboundValidator: createWireEnvelopeValidator('client-to-host'),
      guestInboundValidator: createWireEnvelopeValidator('host-to-client'),
      now: () => nowMs,
      random: () => 0.5,
      network: {
        latencyMs: 7,
        jitterMs: 2,
        maxQueuedFrames: 128
      }
    })
    const hostPlayback = new CapturingPlaybackEngine()
    const guestPlayback = new CapturingPlaybackEngine()
    const hostRuntime = createSessionRuntime({
      transport: pair.host,
      playback: hostPlayback,
      now: () => nowMs
    })
    const guestRuntime = createSessionRuntime({
      transport: pair.guest,
      playback: guestPlayback,
      now: () => nowMs
    })

    const flushConnection = async (): Promise<void> => {
      for (let pass = 0; pass < 5; pass += 1) {
        pair.flushAll()
        await settleRuntime()
      }
      nowMs += 16
    }

    try {
      await hostRuntime.startHostSession({
        roomId: 'mocked-e2e-room',
        hostUsername: 'Honey Cat',
        inviteSecret: 'invite-secret'
      })
      await guestRuntime.startGuestSession({
        roomId: 'mocked-e2e-room',
        username: 'Rabbit Buddy',
        inviteSecret: 'invite-secret'
      })
      await flushConnection()

      for (let index = 0; index < streamingRoundTripMedia.length; index += 1) {
        const media = streamingRoundTripMedia[index]
        if (index % 2 === 0) {
          await hostRuntime.dispatchHostCommand({ type: 'addMedia', media })
        } else {
          await guestRuntime.dispatchGuestCommand({ type: 'addMedia', media })
        }
        await flushConnection()

        if (index > 0) {
          await hostRuntime.dispatchHostCommand({ type: 'next' })
          await flushConnection()
        }

        await hostRuntime.dispatchHostCommand({ type: 'playPause', playing: false })
        await flushConnection()
        await hostRuntime.dispatchHostCommand({
          type: 'seek',
          positionMs: Math.min(30000 + index * 1000, media.durationMs || 30000)
        })
        await flushConnection()
        await hostRuntime.dispatchHostCommand({
          type: 'setRate',
          rate: index % 2 === 0 ? 1 : 1.25
        })
        await flushConnection()
        await hostRuntime.dispatchHostCommand({ type: 'playPause', playing: true })
        await flushConnection()

        const hostSession = hostRuntime.getSnapshot().session
        const guestSession = guestRuntime.getSnapshot().session
        expect(hostSession && hostSession.currentMediaId).toBe(media.mediaId)
        expect(guestSession && guestSession.currentMediaId).toBe(media.mediaId)
      }

      await guestRuntime.dispatchGuestCommand({ type: 'leave', reason: 'done' })
      await flushConnection()

      const finalHostSession = hostRuntime.getSnapshot().session
      const finalGuestSession = guestRuntime.getSnapshot().session
      expect(finalHostSession && finalHostSession.status).toBe('hosting')
      expect(finalGuestSession && finalGuestSession.status).toBe('hosting')
      expect(finalHostSession && finalHostSession.participants.guest).toBeUndefined()
      expect(finalGuestSession && finalGuestSession.participants.guest).toBeUndefined()

      expect(streamingRoundTripMedia.map(media => classifyMediaProvider(media.source))).toEqual([
        'youtube',
        'animepahe',
        'cineby',
        'miruro',
        'unknown'
      ])
      expect(findPlaybackMediaSource(guestPlayback.desiredStates, 'youtube-main')).toBe('website')
      expect(findPlaybackMediaSource(guestPlayback.desiredStates, 'animepahe-main')).toBe('website')
      expect(findPlaybackMediaSource(guestPlayback.desiredStates, 'cineby-main')).toBe('website')
      expect(findPlaybackMediaSource(guestPlayback.desiredStates, 'miruro-main')).toBe('website')
      expect(findPlaybackMediaSource(guestPlayback.desiredStates, 'direct-media-main')).toBe(
        'direct-media'
      )

      const metrics = pair.getAggregateMetrics()
      expect(metrics.combinedSentMessages).toBeGreaterThan(streamingRoundTripMedia.length)
      expect(metrics.combinedDeliveredMessages).toBe(metrics.combinedSentMessages)
      expect(metrics.combinedDroppedMessages).toBe(0)
      expect(metrics.combinedOutOfOrderMessages).toBe(0)
      expect(metrics.combinedSequenceGapMessages).toBe(0)
      expect(metrics.combinedLostBytes).toBe(0)
      expect(metrics.combinedDeliveryRate).toBe(1)
      expect(metrics.combinedByteLossRate).toBe(0)
      expect(metrics.maxDirectionalByteLossRate).toBe(0)
      expect(metrics.maxDirectionalAverageLatencyMs).toBeLessThanOrEqual(8)
      expect(metrics.maxDirectionalAverageLatencyJitterMs).toBeLessThanOrEqual(2)
      expect(metrics.maxDirectionalQueuedMessages).toBe(0)
      expect(metrics.estimatedRoundTripP95LatencyMs).toBeLessThanOrEqual(16)
      expect(metrics.estimatedRoundTripMaxLatencyMs).toBeLessThanOrEqual(16)
      expect(metrics.combinedAverageMessageBytes).toBeLessThan(1200)
      expect(metrics.combinedMaxMessageBytes).toBeLessThanOrEqual(2048)
      expect(evaluateSimulatedPeerTransportBudget(metrics)).toEqual({
        ok: true,
        failures: []
      })
    } finally {
      hostRuntime.dispose()
      guestRuntime.dispose()
    }
  })
})

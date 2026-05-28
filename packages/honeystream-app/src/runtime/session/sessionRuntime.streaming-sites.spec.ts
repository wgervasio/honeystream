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

const streamingSiteMedia: readonly MediaSnapshot[] = Object.freeze([
  {
    mediaId: 'youtube-watch',
    kind: 'website',
    source: 'https://www.youtube.com/watch?v=honeystream-sync',
    title: 'YouTube watch page',
    durationMs: 180000
  },
  {
    mediaId: 'youtube-short',
    kind: 'website',
    source: 'https://youtu.be/honeystream-sync',
    title: 'YouTube short link',
    durationMs: 180000
  },
  {
    mediaId: 'animepahe-play',
    kind: 'website',
    source: 'https://animepahe.ru/play/honeystream-test',
    title: 'AnimePahe episode',
    durationMs: 1440000
  },
  {
    mediaId: 'animepahe-alt',
    kind: 'website',
    source: 'https://animepahe.si/anime/honeystream-test',
    title: 'AnimePahe alternate domain',
    durationMs: 1440000
  },
  {
    mediaId: 'cineby-movie',
    kind: 'website',
    source: 'https://cineby.app/movie/honeystream-test',
    title: 'Cineby movie',
    durationMs: 5400000
  },
  {
    mediaId: 'cineby-alt',
    kind: 'website',
    source: 'https://watch.cineby.to/tv/honeystream-test',
    title: 'Cineby alternate domain',
    durationMs: 5400000
  },
  {
    mediaId: 'miruro-watch',
    kind: 'website',
    source: 'https://miruro.to/watch/honeystream-test',
    title: 'Miruro watch page',
    durationMs: 1440000
  },
  {
    mediaId: 'miruro-alt',
    kind: 'website',
    source: 'https://www.miruro.tv/watch/honeystream-test',
    title: 'Miruro alternate domain',
    durationMs: 1440000
  },
  {
    mediaId: 'direct-mp4',
    kind: 'url',
    source: 'https://cdn.example.com/honeystream/cozy-night.mp4',
    title: 'Direct MP4',
    durationMs: 90000
  },
  {
    mediaId: 'local-file-copy',
    kind: 'localFile',
    source: 'honeystream-local://cozy-night-copy',
    title: 'Local file copy',
    durationMs: 90000
  }
])

const settleRuntime = async (): Promise<void> => {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

describe('runtime/session streaming-site simulation', () => {
  it('keeps host and guest projections synced with zero byte loss under a low-latency profile', async () => {
    let nowMs = 10000
    const pair = createSimulatedPeerTransportPair<
      ClientToHostWireEnvelope,
      HostToClientWireEnvelope
    >({
      hostInboundValidator: createWireEnvelopeValidator('client-to-host'),
      guestInboundValidator: createWireEnvelopeValidator('host-to-client'),
      now: () => nowMs,
      random: () => 0.5,
      network: {
        latencyMs: 12,
        jitterMs: 4,
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

    const flushTransportAndRuntime = async (): Promise<void> => {
      for (let pass = 0; pass < 4; pass += 1) {
        pair.flushAll()
        await settleRuntime()
      }
      nowMs += 20
    }

    try {
      await hostRuntime.startHostSession({
        roomId: 'streaming-sites-room',
        hostUsername: 'Cat Host',
        inviteSecret: 'invite-secret'
      })
      await guestRuntime.startGuestSession({
        roomId: 'streaming-sites-room',
        username: 'Rabbit Guest',
        inviteSecret: 'invite-secret'
      })
      await flushTransportAndRuntime()

      for (let index = 0; index < streamingSiteMedia.length; index += 1) {
        const media = streamingSiteMedia[index]
        if (index % 2 === 0) {
          await hostRuntime.dispatchHostCommand({ type: 'addMedia', media })
        } else {
          await guestRuntime.dispatchGuestCommand({ type: 'addMedia', media })
        }
        await flushTransportAndRuntime()

        if (index > 0) {
          await hostRuntime.dispatchHostCommand({ type: 'next' })
          await flushTransportAndRuntime()
        }

        await hostRuntime.dispatchHostCommand({
          type: 'seek',
          positionMs: Math.min(42000, media.durationMs || 42000)
        })
        await flushTransportAndRuntime()

        const hostSession = hostRuntime.getSnapshot().session
        const guestSession = guestRuntime.getSnapshot().session
        expect(hostSession && hostSession.currentMediaId).toBe(media.mediaId)
        expect(guestSession && guestSession.currentMediaId).toBe(media.mediaId)
      }

      const guestMediaIds = guestPlayback.desiredStates
        .map(state => state.media && state.media.mediaId)
        .filter((mediaId): mediaId is string => typeof mediaId === 'string')

      for (const media of streamingSiteMedia) {
        expect(guestMediaIds).toContain(media.mediaId)
      }

      expect(streamingSiteMedia.map(media => classifyMediaProvider(media.source))).toEqual([
        'youtube',
        'youtube',
        'animepahe',
        'animepahe',
        'cineby',
        'cineby',
        'miruro',
        'miruro',
        'unknown',
        'unknown'
      ])

      const metrics = pair.getAggregateMetrics()
      expect(metrics.combinedSentMessages).toBeGreaterThan(streamingSiteMedia.length)
      expect(metrics.combinedDeliveredMessages).toBe(metrics.combinedSentMessages)
      expect(metrics.combinedOutOfOrderMessages).toBe(0)
      expect(metrics.combinedSequenceGapMessages).toBe(0)
      expect(metrics.combinedLostBytes).toBe(0)
      expect(metrics.combinedQueuedMessages).toBe(0)
      expect(metrics.maxDirectionalByteLossRate).toBe(0)
      expect(metrics.maxDirectionalAverageLatencyMs).toBeLessThanOrEqual(16)
      expect(metrics.maxDirectionalAverageLatencyJitterMs).toBeLessThanOrEqual(4)
      expect(metrics.directionalAverageLatencySkewMs).toBeLessThanOrEqual(4)
      expect(metrics.maxDirectionalQueuedMessages).toBe(0)
      expect(metrics.combinedPeakQueuedMessages).toBeLessThanOrEqual(64)
      expect(metrics.maxDirectionalPeakQueuedMessages).toBeLessThanOrEqual(32)
      expect(metrics.maxDirectionalLatencyJitterMs).toBeLessThanOrEqual(8)
      expect(metrics.estimatedRoundTripP95LatencyMs).toBeLessThanOrEqual(32)
      expect(metrics.estimatedRoundTripMaxLatencyMs).toBeLessThanOrEqual(32)
      expect(metrics.combinedAverageMessageBytes).toBeLessThan(1200)
      expect(metrics.combinedMaxMessageBytes).toBeLessThanOrEqual(2048)
      expect(metrics.combinedP95LatencyMs).toBeLessThanOrEqual(16)
      expect(metrics.combinedMaxLatencyMs).toBeLessThanOrEqual(16)
      expect(evaluateSimulatedPeerTransportBudget(metrics)).toEqual({
        ok: true,
        failures: []
      })
    } finally {
      hostRuntime.dispose()
      guestRuntime.dispose()
    }
  })

  it('keeps supported streaming-site control bursts under an asymmetric latency budget', async () => {
    let nowMs = 30000
    const pair = createSimulatedPeerTransportPair<
      ClientToHostWireEnvelope,
      HostToClientWireEnvelope
    >({
      hostInboundValidator: createWireEnvelopeValidator('client-to-host'),
      guestInboundValidator: createWireEnvelopeValidator('host-to-client'),
      now: () => nowMs,
      random: () => 0.5,
      hostNetwork: {
        latencyMs: 8,
        jitterMs: 2,
        maxQueuedFrames: 128
      },
      guestNetwork: {
        latencyMs: 12,
        jitterMs: 4,
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

    const flushTransportAndRuntime = async (): Promise<void> => {
      for (let pass = 0; pass < 4; pass += 1) {
        pair.flushAll()
        await settleRuntime()
      }
      nowMs += 16
    }

    try {
      await hostRuntime.startHostSession({
        roomId: 'asymmetric-sites-room',
        hostUsername: 'Cat Host',
        inviteSecret: 'invite-secret'
      })
      await guestRuntime.startGuestSession({
        roomId: 'asymmetric-sites-room',
        username: 'Rabbit Guest',
        inviteSecret: 'invite-secret'
      })
      await flushTransportAndRuntime()

      const websiteMedia = streamingSiteMedia.filter(media => media.kind === 'website')
      for (let index = 0; index < websiteMedia.length; index += 1) {
        const media = websiteMedia[index]
        await guestRuntime.dispatchGuestCommand({ type: 'addMedia', media })
        await flushTransportAndRuntime()

        if (index > 0) {
          await hostRuntime.dispatchHostCommand({ type: 'next' })
          await flushTransportAndRuntime()
        }

        await hostRuntime.dispatchHostCommand({
          type: 'playPause',
          playing: index % 2 === 0
        })
        await hostRuntime.dispatchHostCommand({
          type: 'seek',
          positionMs: Math.min(24000 + index * 1000, media.durationMs || 24000)
        })
        await flushTransportAndRuntime()
      }

      const finalMedia = websiteMedia[websiteMedia.length - 1]
      const hostSession = hostRuntime.getSnapshot().session
      const guestSession = guestRuntime.getSnapshot().session
      expect(hostSession && hostSession.currentMediaId).toBe(finalMedia.mediaId)
      expect(guestSession && guestSession.currentMediaId).toBe(finalMedia.mediaId)

      const metrics = pair.getAggregateMetrics()
      expect(metrics.combinedDroppedMessages).toBe(0)
      expect(metrics.combinedOutOfOrderMessages).toBe(0)
      expect(metrics.combinedSequenceGapMessages).toBe(0)
      expect(metrics.combinedLostBytes).toBe(0)
      expect(metrics.combinedQueuedMessages).toBe(0)
      expect(metrics.combinedDeliveryRate).toBe(1)
      expect(metrics.combinedByteLossRate).toBe(0)
      expect(metrics.maxDirectionalByteLossRate).toBe(0)
      expect(metrics.maxDirectionalAverageLatencyMs).toBeLessThanOrEqual(12)
      expect(metrics.maxDirectionalAverageLatencyJitterMs).toBeLessThanOrEqual(4)
      expect(metrics.directionalAverageLatencySkewMs).toBeLessThanOrEqual(4)
      expect(metrics.maxDirectionalQueuedMessages).toBe(0)
      expect(metrics.combinedPeakQueuedMessages).toBeLessThanOrEqual(64)
      expect(metrics.maxDirectionalPeakQueuedMessages).toBeLessThanOrEqual(32)
      expect(metrics.maxDirectionalLatencyJitterMs).toBeLessThanOrEqual(8)
      expect(metrics.estimatedRoundTripP95LatencyMs).toBeLessThanOrEqual(24)
      expect(metrics.estimatedRoundTripMaxLatencyMs).toBeLessThanOrEqual(24)
      expect(metrics.combinedAverageLatencyMs).toBeLessThanOrEqual(12)
      expect(metrics.combinedMaxMessageBytes).toBeLessThanOrEqual(2048)
      expect(metrics.combinedP95LatencyMs).toBeLessThanOrEqual(12)
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

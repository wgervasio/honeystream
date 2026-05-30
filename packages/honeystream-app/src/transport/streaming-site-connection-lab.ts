import { classifyMediaProvider, MediaProvider, parseWireEnvelope, PROTOCOL_VERSION } from 'protocol'
import { ClientToHostEnvelope, HostToClientEnvelope, WireEnvelope } from 'protocol/types'
import { TransportMessageValidator } from './contracts'
import {
  evaluateSimulatedPeerTransportBudget,
  SimulatedPeerTransportBudget,
  SimulatedPeerTransportBudgetResult
} from './simulated-peer-transport-performance'
import {
  AggregateSimulatedPeerTransportMetrics,
  createSimulatedPeerTransportPair
} from './simulated-peer-transport-pair'
import {
  rankSimulatedPeerTransportCandidates,
  SimulatedPeerTransportCandidate,
  SimulatedPeerTransportCandidateRank
} from './simulated-peer-transport-tuning'
import {
  resolveStreamingSiteSeekPositionMs,
  toStreamingSiteMediaSnapshot,
  toStreamingSitePlaybackSnapshot
} from './streaming-site-connection-snapshot'
import {
  createStreamingSiteFixtureObservation,
  StreamingSiteFixtureObservation
} from './streaming-site-connection-site-observation'
import {
  countStreamingSiteProviders,
  StreamingSiteProviderCoverage
} from './streaming-site-provider-coverage'
import { Clock, SimulatedPeerNetworkProfile } from './simulated-peer-transport-types'

export interface StreamingSiteConnectionFixture {
  readonly durationMs?: number | null
  readonly id: string
  readonly source: string
  readonly title?: string
}

export interface StreamingSiteConnectionProfile {
  readonly id: string
  readonly label: string
  readonly network?: SimulatedPeerNetworkProfile
  readonly hostNetwork?: SimulatedPeerNetworkProfile
  readonly guestNetwork?: SimulatedPeerNetworkProfile
}

export interface StreamingSiteConnectionLabOptions {
  readonly budget?: SimulatedPeerTransportBudget
  readonly fixtures: readonly StreamingSiteConnectionFixture[]
  readonly includeBurstControls?: boolean
  readonly nowStartMs?: number
  readonly profiles: readonly StreamingSiteConnectionProfile[]
  readonly random?: Clock
}

export interface StreamingSiteConnectionObservation {
  readonly budgetResult: SimulatedPeerTransportBudgetResult
  readonly candidate: SimulatedPeerTransportCandidate
  readonly fixtureObservations: readonly StreamingSiteFixtureObservation[]
  readonly metrics: AggregateSimulatedPeerTransportMetrics
  readonly profile: StreamingSiteConnectionProfile
  readonly providerCoverage: readonly StreamingSiteProviderCoverage[]
  readonly providers: readonly MediaProvider[]
  readonly siteCount: number
}

export interface StreamingSiteConnectionProfileRank extends SimulatedPeerTransportCandidateRank {
  readonly profile: StreamingSiteConnectionProfile
  readonly providerCoverage: readonly StreamingSiteProviderCoverage[]
  readonly providers: readonly MediaProvider[]
  readonly siteCount: number
}

export interface StreamingSiteConnectionLabResult {
  readonly bestProfile?: StreamingSiteConnectionProfileRank
  readonly observations: readonly StreamingSiteConnectionObservation[]
  readonly rankedProfiles: readonly StreamingSiteConnectionProfileRank[]
}

const FLUSH_ADVANCE_MS = 16
const createWireEnvelopeValidator = <TDirection extends WireEnvelope['direction']>(
  direction: TDirection
): TransportMessageValidator<Extract<WireEnvelope, { direction: TDirection }>> => ({
  validate: (value: unknown): value is Extract<WireEnvelope, { direction: TDirection }> => {
    const parsed = parseWireEnvelope(value)
    return parsed.ok && parsed.value.direction === direction
  },
  describeInvalidMessage: () => `Expected ${direction} wire envelope payload.`
})

const findObservation = (
  observations: readonly StreamingSiteConnectionObservation[],
  profileId: string
): StreamingSiteConnectionObservation => {
  const observation = observations.find(item => item.profile.id === profileId)
  if (!observation)
    throw new Error(`Streaming connection lab profile "${profileId}" was not observed.`)
  return observation
}

const observeStreamingSiteConnectionProfile = async (
  profile: StreamingSiteConnectionProfile,
  fixtures: readonly StreamingSiteConnectionFixture[],
  options: StreamingSiteConnectionLabOptions
): Promise<StreamingSiteConnectionObservation> => {
  let nowMs = options.nowStartMs || 10000
  let clientSeq = 0
  let hostSeq = 0
  const providers = fixtures.map(fixture => classifyMediaProvider(fixture.source))
  const providerCoverage = countStreamingSiteProviders(providers)
  const fixtureObservations: StreamingSiteFixtureObservation[] = []
  const pair = createSimulatedPeerTransportPair<ClientToHostEnvelope, HostToClientEnvelope>({
    hostInboundValidator: createWireEnvelopeValidator('client-to-host'),
    guestInboundValidator: createWireEnvelopeValidator('host-to-client'),
    now: () => nowMs,
    random: options.random || (() => 0.5),
    network: profile.network,
    hostNetwork: profile.hostNetwork,
    guestNetwork: profile.guestNetwork
  })
  try {
    const flushAndAdvance = (): void => {
      pair.flushAll()
      nowMs += FLUSH_ADVANCE_MS
    }

    const sendClientCommand = (command: ClientToHostEnvelope['command']): void => {
      clientSeq += 1
      const envelope: ClientToHostEnvelope = {
        version: PROTOCOL_VERSION,
        direction: 'client-to-host',
        seq: clientSeq,
        sentAtMs: nowMs,
        command
      }
      pair.guest.send({ seq: envelope.seq, sentAtMs: envelope.sentAtMs, message: envelope })
    }

    const sendHostEvent = (event: HostToClientEnvelope['event']): void => {
      hostSeq += 1
      const envelope: HostToClientEnvelope = {
        version: PROTOCOL_VERSION,
        direction: 'host-to-client',
        seq: hostSeq,
        sentAtMs: nowMs,
        event
      }
      pair.host.send({ seq: envelope.seq, sentAtMs: envelope.sentAtMs, message: envelope })
    }

    await pair.host.connect()

    for (let index = 0; index < fixtures.length; index += 1) {
      const fixture = fixtures[index]
      const provider = providers[index]
      const beforeFixtureMetrics = pair.getAggregateMetrics()
      const media = toStreamingSiteMediaSnapshot(fixture, index)
      const seekPositionMs = resolveStreamingSiteSeekPositionMs(media, index)
      const rate = index % 2 === 0 ? 1 : 1.25

      sendClientCommand({ type: 'addMedia', media })
      flushAndAdvance()
      sendHostEvent({ type: 'currentMediaChanged', mediaId: media.mediaId, media })
      sendHostEvent({
        type: 'playbackChanged',
        playback: toStreamingSitePlaybackSnapshot(media, nowMs, 0, 1)
      })
      flushAndAdvance()
      sendClientCommand({ type: 'seek', positionMs: seekPositionMs })
      flushAndAdvance()
      sendHostEvent({
        type: 'playbackChanged',
        playback: toStreamingSitePlaybackSnapshot(media, nowMs, seekPositionMs, 1)
      })
      flushAndAdvance()
      sendClientCommand({ type: 'setRate', rate })
      flushAndAdvance()
      sendHostEvent({
        type: 'playbackChanged',
        playback: toStreamingSitePlaybackSnapshot(media, nowMs, seekPositionMs, rate)
      })
      flushAndAdvance()
      if (options.includeBurstControls !== false) {
        sendClientCommand({ type: 'seek', positionMs: Math.max(0, seekPositionMs - 5000) })
        sendClientCommand({ type: 'playPause', playing: false })
        sendClientCommand({ type: 'playPause', playing: true })
        flushAndAdvance()
        sendHostEvent({
          type: 'playbackChanged',
          playback: toStreamingSitePlaybackSnapshot(media, nowMs, seekPositionMs, rate)
        })
        flushAndAdvance()
      }
      fixtureObservations.push(
        createStreamingSiteFixtureObservation(
          { fixtureId: fixture.id, provider, source: fixture.source },
          beforeFixtureMetrics,
          pair.getAggregateMetrics()
        )
      )
    }

    const metrics = pair.getAggregateMetrics()
    const candidate: SimulatedPeerTransportCandidate = {
      id: profile.id,
      label: profile.label,
      metrics
    }

    return {
      budgetResult: evaluateSimulatedPeerTransportBudget(metrics, options.budget),
      candidate,
      fixtureObservations,
      metrics,
      profile,
      providerCoverage,
      providers,
      siteCount: fixtures.length
    }
  } finally {
    pair.host.dispose()
    pair.guest.dispose()
  }
}

export const runStreamingSiteConnectionLab = async (
  options: StreamingSiteConnectionLabOptions
): Promise<StreamingSiteConnectionLabResult> => {
  const observations: StreamingSiteConnectionObservation[] = []
  for (const profile of options.profiles) {
    observations.push(
      await observeStreamingSiteConnectionProfile(profile, options.fixtures, options)
    )
  }
  const rankedProfiles = rankSimulatedPeerTransportCandidates(
    observations.map(observation => observation.candidate),
    options.budget
  ).map(rank => {
    const observation = findObservation(observations, rank.candidate.id)
    return {
      ...rank,
      profile: observation.profile,
      providerCoverage: observation.providerCoverage,
      providers: observation.providers,
      siteCount: observation.siteCount
    }
  })
  return {
    bestProfile: rankedProfiles.find(rank => rank.budgetResult.ok),
    observations,
    rankedProfiles
  }
}

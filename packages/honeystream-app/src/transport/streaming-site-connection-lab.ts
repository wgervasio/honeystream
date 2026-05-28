import {
  classifyMediaProvider,
  classifyMediaUrl,
  MediaProvider,
  parseWireEnvelope,
  PROTOCOL_VERSION
} from 'protocol'
import {
  ClientToHostEnvelope,
  HostToClientEnvelope,
  MediaSnapshot,
  PlaybackSnapshot,
  WireEnvelope
} from 'protocol/types'
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
import { Clock, SimulatedPeerNetworkProfile } from './simulated-peer-transport-types'

export interface StreamingSiteConnectionFixture {
  readonly id: string
  readonly source: string
  readonly title?: string
  readonly durationMs?: number
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
  readonly nowStartMs?: number
  readonly profiles: readonly StreamingSiteConnectionProfile[]
  readonly random?: Clock
}

export interface StreamingSiteConnectionObservation {
  readonly budgetResult: SimulatedPeerTransportBudgetResult
  readonly candidate: SimulatedPeerTransportCandidate
  readonly metrics: AggregateSimulatedPeerTransportMetrics
  readonly profile: StreamingSiteConnectionProfile
  readonly providers: readonly MediaProvider[]
  readonly siteCount: number
}

export interface StreamingSiteConnectionProfileRank extends SimulatedPeerTransportCandidateRank {
  readonly profile: StreamingSiteConnectionProfile
  readonly providers: readonly MediaProvider[]
  readonly siteCount: number
}

export interface StreamingSiteConnectionLabResult {
  readonly bestProfile?: StreamingSiteConnectionProfileRank
  readonly observations: readonly StreamingSiteConnectionObservation[]
  readonly rankedProfiles: readonly StreamingSiteConnectionProfileRank[]
}

const DEFAULT_DURATION_MS = 180000
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

const toMediaSnapshot = (
  fixture: StreamingSiteConnectionFixture,
  index: number
): MediaSnapshot => {
  const source = fixture.source.trim()
  return {
    mediaId: fixture.id || `streaming-site-${index + 1}`,
    kind: classifyMediaUrl(source),
    source,
    title: fixture.title || fixture.id,
    durationMs: fixture.durationMs || DEFAULT_DURATION_MS
  }
}

const toPlaybackSnapshot = (
  media: MediaSnapshot,
  nowHostMs: number,
  positionMs: number,
  rate: number
): PlaybackSnapshot => ({
  state: 'playing',
  positionMs,
  updatedAtHostMs: nowHostMs,
  rate,
  durationMs: media.durationMs
})

const findObservation = (
  observations: readonly StreamingSiteConnectionObservation[],
  profileId: string
): StreamingSiteConnectionObservation => {
  const observation = observations.find(item => item.profile.id === profileId)
  if (!observation) throw new Error(`Streaming connection lab profile "${profileId}" was not observed.`)
  return observation
}
/*
Context: Streaming-site merge gates need a repeatable host/guest mock connection lab.
Invariant: Website media bytes stay local; only typed protocol envelopes cross the mocked transport.
Options considered: UI-only assertions, runtime-only smoke tests, or a reusable transport lab.
Decision: Drive real protocol envelopes through simulated transports and rank profiles by loss, latency, jitter, queue pressure, and byte budget.
Performance impact: The lab is deterministic and bounded by fixture/profile counts.
Memory/lifecycle ownership: Simulated transports own bounded frame queues and are disposed after each profile observation.
Failure mode: Over-budget profiles return typed metric failures and cannot become the selected profile.
Validation: Covered by streaming-site-connection-lab tests.
*/
const observeStreamingSiteConnectionProfile = async (
  profile: StreamingSiteConnectionProfile,
  fixtures: readonly StreamingSiteConnectionFixture[],
  options: StreamingSiteConnectionLabOptions
): Promise<StreamingSiteConnectionObservation> => {
  let nowMs = options.nowStartMs || 10000
  let clientSeq = 0
  let hostSeq = 0
  const providers = fixtures.map(fixture => classifyMediaProvider(fixture.source))
  const pair = createSimulatedPeerTransportPair<ClientToHostEnvelope, HostToClientEnvelope>({
    hostInboundValidator: createWireEnvelopeValidator('client-to-host'),
    guestInboundValidator: createWireEnvelopeValidator('host-to-client'),
    now: () => nowMs,
    random: options.random || (() => 0.5),
    network: profile.network,
    hostNetwork: profile.hostNetwork,
    guestNetwork: profile.guestNetwork
  })

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
    const media = toMediaSnapshot(fixtures[index], index)
    const seekPositionMs = Math.min(24000 + index * 1000, media.durationMs || DEFAULT_DURATION_MS)
    const rate = index % 2 === 0 ? 1 : 1.25

    sendClientCommand({ type: 'addMedia', media })
    flushAndAdvance()
    sendHostEvent({ type: 'currentMediaChanged', mediaId: media.mediaId, media })
    sendHostEvent({
      type: 'playbackChanged',
      playback: toPlaybackSnapshot(media, nowMs, 0, 1)
    })
    flushAndAdvance()
    sendClientCommand({ type: 'seek', positionMs: seekPositionMs })
    flushAndAdvance()
    sendHostEvent({
      type: 'playbackChanged',
      playback: toPlaybackSnapshot(media, nowMs, seekPositionMs, 1)
    })
    flushAndAdvance()
    sendClientCommand({ type: 'setRate', rate })
    flushAndAdvance()
    sendHostEvent({
      type: 'playbackChanged',
      playback: toPlaybackSnapshot(media, nowMs, seekPositionMs, rate)
    })
    flushAndAdvance()
  }

  const metrics = pair.getAggregateMetrics()
  const candidate: SimulatedPeerTransportCandidate = {
    id: profile.id,
    label: profile.label,
    metrics
  }
  pair.host.dispose()
  pair.guest.dispose()

  return {
    budgetResult: evaluateSimulatedPeerTransportBudget(metrics, options.budget),
    candidate,
    metrics,
    profile,
    providers,
    siteCount: fixtures.length
  }
}

export const runStreamingSiteConnectionLab = async (
  options: StreamingSiteConnectionLabOptions
): Promise<StreamingSiteConnectionLabResult> => {
  const observations: StreamingSiteConnectionObservation[] = []

  for (const profile of options.profiles) {
    observations.push(await observeStreamingSiteConnectionProfile(profile, options.fixtures, options))
  }

  const rankedProfiles = rankSimulatedPeerTransportCandidates(
    observations.map(observation => observation.candidate),
    options.budget
  ).map(rank => {
    const observation = findObservation(observations, rank.candidate.id)
    return {
      ...rank,
      profile: observation.profile,
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

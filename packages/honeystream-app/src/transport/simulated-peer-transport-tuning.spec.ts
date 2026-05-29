import { TransportMessageValidator } from './contracts'
import { createSimulatedPeerTransportPair } from './simulated-peer-transport-pair'
import {
  STREAMING_SITE_TRANSPORT_BUDGET,
  SimulatedPeerTransportBudget
} from './simulated-peer-transport-performance'
import {
  rankSimulatedPeerTransportCandidates,
  selectBestSimulatedPeerTransportCandidate,
  SimulatedPeerTransportCandidate,
  SimulatedPeerTransportCandidateRank
} from './simulated-peer-transport-tuning'
import { SimulatedPeerNetworkProfile } from './simulated-peer-transport-types'

type ClientToHostMessage = {
  readonly type: 'ping'
  readonly nonce: number
}

type HostToClientMessage = {
  readonly type: 'pong'
  readonly nonce: number
}

type UnknownRecord = { readonly [key: string]: unknown }

const isUnknownRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null

const clientToHostValidator: TransportMessageValidator<ClientToHostMessage> = {
  validate: (value: unknown): value is ClientToHostMessage =>
    isUnknownRecord(value) &&
    value.type === 'ping' &&
    typeof value.nonce === 'number' &&
    value.nonce >= 0,
  describeInvalidMessage: () => 'Expected ping message.'
}

const hostToClientValidator: TransportMessageValidator<HostToClientMessage> = {
  validate: (value: unknown): value is HostToClientMessage =>
    isUnknownRecord(value) &&
    value.type === 'pong' &&
    typeof value.nonce === 'number' &&
    value.nonce >= 0,
  describeInvalidMessage: () => 'Expected pong message.'
}

const findCandidateRank = (
  ranks: readonly SimulatedPeerTransportCandidateRank[],
  id: string
): SimulatedPeerTransportCandidateRank => {
  const rank = ranks.find(candidateRank => candidateRank.candidate.id === id)
  if (!rank) throw new Error(`Expected simulated transport candidate "${id}" to be ranked.`)
  return rank
}

describe('simulated peer transport tuning', () => {
  it('selects the lowest-latency zero-loss mock connection candidate', async () => {
    let nowMs = 11000
    const observeCandidate = async (
      id: string,
      label: string,
      network: SimulatedPeerNetworkProfile
    ): Promise<SimulatedPeerTransportCandidate> => {
      const pair = createSimulatedPeerTransportPair({
        hostInboundValidator: clientToHostValidator,
        guestInboundValidator: hostToClientValidator,
        now: () => nowMs,
        random: () => 0.5,
        network: { maxQueuedFrames: 128, ...network }
      })

      await pair.host.connect()
      for (let nonce = 1; nonce <= 8; nonce += 1) {
        pair.guest.send({ seq: nonce, sentAtMs: nowMs, message: { type: 'ping', nonce } })
        pair.host.send({ seq: nonce + 100, sentAtMs: nowMs, message: { type: 'pong', nonce } })
        nowMs += 1
      }
      pair.flushAll()
      nowMs += 50

      return { id, label, metrics: pair.getAggregateMetrics() }
    }

    const candidates = [
      await observeCandidate('lossy-fast', 'Lossy fast lane', {
        latencyMs: 4,
        dropEveryNthMessage: 5
      }),
      await observeCandidate('slow-reliable', 'Slow reliable lane', { latencyMs: 24 }),
      await observeCandidate('balanced-reliable', 'Balanced reliable lane', {
        latencyMs: 8,
        jitterMs: 2
      })
    ]

    const rankedCandidates = rankSimulatedPeerTransportCandidates(candidates)
    const bestCandidate = selectBestSimulatedPeerTransportCandidate(candidates)
    if (!bestCandidate) throw new Error('Expected a streaming-safe transport candidate.')

    const lossyCandidate = findCandidateRank(rankedCandidates, 'lossy-fast')
    const slowCandidate = findCandidateRank(rankedCandidates, 'slow-reliable')

    expect(bestCandidate.candidate.id).toBe('balanced-reliable')
    expect(bestCandidate.budgetResult.ok).toBe(true)
    expect(bestCandidate.candidate.metrics.host.byteLossRate).toBe(0)
    expect(rankedCandidates[0].candidate.id).toBe('balanced-reliable')
    expect(rankedCandidates[0].budgetResult.failures).toEqual([])
    expect(lossyCandidate.budgetResult.ok).toBe(false)
    expect(lossyCandidate.budgetResult.failures).toEqual(
      expect.arrayContaining([expect.objectContaining({ metric: 'combinedByteLossRate' })])
    )
    expect(slowCandidate.budgetResult.ok).toBe(false)
    expect(slowCandidate.budgetResult.failures).toEqual(
      expect.arrayContaining([expect.objectContaining({ metric: 'combinedP95LatencyMs' })])
    )
  })

  it('prefers lower byte loss before latency when a relaxed budget allows drops', async () => {
    let nowMs = 12000
    const relaxedLossBudget: SimulatedPeerTransportBudget = {
      ...STREAMING_SITE_TRANSPORT_BUDGET,
      minDeliveryRate: 0.7,
      maxDroppedMessages: 2,
      maxByteLossRate: 0.35,
      maxDirectionalByteLossRate: 0.35
    }
    const observeCandidate = async (
      id: string,
      label: string,
      network: SimulatedPeerNetworkProfile
    ): Promise<SimulatedPeerTransportCandidate> => {
      const pair = createSimulatedPeerTransportPair({
        hostInboundValidator: clientToHostValidator,
        guestInboundValidator: hostToClientValidator,
        now: () => nowMs,
        random: () => 0.5,
        network: { maxQueuedFrames: 128, ...network }
      })

      await pair.host.connect()
      for (let nonce = 1; nonce <= 4; nonce += 1) {
        pair.guest.send({ seq: nonce, sentAtMs: nowMs, message: { type: 'ping', nonce } })
        pair.host.send({ seq: nonce + 100, sentAtMs: nowMs, message: { type: 'pong', nonce } })
        nowMs += 1
      }
      pair.flushAll()
      nowMs += 50

      return { id, label, metrics: pair.getAggregateMetrics() }
    }
    const candidates = [
      await observeCandidate('lossy-low-latency', 'Lossy low-latency lane', {
        latencyMs: 2,
        dropEveryNthMessage: 4
      }),
      await observeCandidate('zero-loss-balanced', 'Zero-loss balanced lane', { latencyMs: 12 })
    ]

    const rankedCandidates = rankSimulatedPeerTransportCandidates(candidates, relaxedLossBudget)
    const lossyCandidate = findCandidateRank(rankedCandidates, 'lossy-low-latency')
    const zeroLossCandidate = findCandidateRank(rankedCandidates, 'zero-loss-balanced')

    expect(lossyCandidate.budgetResult.ok).toBe(true)
    expect(zeroLossCandidate.budgetResult.ok).toBe(true)
    expect(lossyCandidate.candidate.metrics.combinedDroppedMessages).toBeGreaterThan(0)
    expect(zeroLossCandidate.candidate.metrics.combinedDroppedMessages).toBe(0)
    expect(rankedCandidates[0].candidate.id).toBe('zero-loss-balanced')
  })
})

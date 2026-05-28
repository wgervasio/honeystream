import {
  evaluateSimulatedPeerTransportBudget,
  SimulatedPeerTransportBudget,
  SimulatedPeerTransportBudgetResult
} from './simulated-peer-transport-performance'
import { AggregateSimulatedPeerTransportMetrics } from './simulated-peer-transport-pair'

export interface SimulatedPeerTransportCandidate {
  readonly id: string
  readonly label: string
  readonly metrics: AggregateSimulatedPeerTransportMetrics
}

export interface SimulatedPeerTransportCandidateRank {
  readonly budgetResult: SimulatedPeerTransportBudgetResult
  readonly candidate: SimulatedPeerTransportCandidate
  readonly score: number
}

const FAILED_CANDIDATE_SCORE_OFFSET = 1_000_000

const scoreMetrics = (metrics: AggregateSimulatedPeerTransportMetrics): number =>
  metrics.estimatedRoundTripP95LatencyMs * 1000 +
  metrics.combinedP95LatencyMs * 100 +
  metrics.maxDirectionalAverageLatencyJitterMs * 20 +
  metrics.combinedPeakQueuedMessages * 10 +
  metrics.combinedAverageMessageBytes

const scoreCandidate = (
  candidate: SimulatedPeerTransportCandidate,
  budgetResult: SimulatedPeerTransportBudgetResult
): number => {
  const failurePenalty = budgetResult.failures.length * FAILED_CANDIDATE_SCORE_OFFSET
  return scoreMetrics(candidate.metrics) + failurePenalty
}

export const rankSimulatedPeerTransportCandidates = (
  candidates: readonly SimulatedPeerTransportCandidate[],
  budget?: SimulatedPeerTransportBudget
): readonly SimulatedPeerTransportCandidateRank[] =>
  candidates
    .map(candidate => {
      const budgetResult = evaluateSimulatedPeerTransportBudget(candidate.metrics, budget)
      return {
        budgetResult,
        candidate,
        score: scoreCandidate(candidate, budgetResult)
      }
    })
    .sort(
      (left, right) =>
        Number(right.budgetResult.ok) - Number(left.budgetResult.ok) ||
        left.score - right.score ||
        left.candidate.id.localeCompare(right.candidate.id)
    )

export const selectBestSimulatedPeerTransportCandidate = (
  candidates: readonly SimulatedPeerTransportCandidate[],
  budget?: SimulatedPeerTransportBudget
): SimulatedPeerTransportCandidateRank | undefined =>
  rankSimulatedPeerTransportCandidates(candidates, budget).find(rank => rank.budgetResult.ok)

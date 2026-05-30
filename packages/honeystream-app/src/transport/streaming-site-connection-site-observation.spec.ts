import { STREAMING_SITE_TRANSPORT_BUDGET } from './simulated-peer-transport-performance'
import {
  runStreamingSiteConnectionLab,
  StreamingSiteConnectionObservation
} from './streaming-site-connection-lab'
import {
  STREAMING_SITE_CONNECTION_BUDGET,
  STREAMING_SITE_CONNECTION_FASTEST_ROUND_TRIP_MS,
  STREAMING_SITE_CONNECTION_FIXTURES,
  STREAMING_SITE_CONNECTION_PROFILES
} from './streaming-site-connection-defaults'
import { StreamingSiteFixtureObservation } from './streaming-site-connection-site-observation'

const findObservation = (
  observations: readonly StreamingSiteConnectionObservation[],
  id: string
): StreamingSiteConnectionObservation => {
  const observation = observations.find(item => item.profile.id === id)
  if (!observation) throw new Error(`Expected observation for profile "${id}".`)
  return observation
}

const findFixtureObservation = (
  observations: readonly StreamingSiteFixtureObservation[],
  id: string
): StreamingSiteFixtureObservation => {
  const observation = observations.find(item => item.fixtureId === id)
  if (!observation) throw new Error(`Expected fixture observation for "${id}".`)
  return observation
}

describe('streaming site fixture observations', () => {
  it('records zero-loss telemetry for every requested site fixture on the selected lane', async () => {
    const result = await runStreamingSiteConnectionLab({
      budget: STREAMING_SITE_CONNECTION_BUDGET,
      fixtures: STREAMING_SITE_CONNECTION_FIXTURES,
      profiles: STREAMING_SITE_CONNECTION_PROFILES,
      nowStartMs: 15000,
      random: () => 0.5
    })

    const observation = findObservation(result.observations, 'clean-ultra-low-latency')

    expect(observation.fixtureObservations.map(item => item.fixtureId)).toEqual(
      STREAMING_SITE_CONNECTION_FIXTURES.map(fixture => fixture.id)
    )
    expect(findFixtureObservation(observation.fixtureObservations, 'youtube-watch')).toEqual(
      expect.objectContaining({ provider: 'youtube' })
    )
    expect(findFixtureObservation(observation.fixtureObservations, 'animepahe-ru')).toEqual(
      expect.objectContaining({ provider: 'animepahe' })
    )
    expect(findFixtureObservation(observation.fixtureObservations, 'cineby-app')).toEqual(
      expect.objectContaining({ provider: 'cineby' })
    )
    expect(findFixtureObservation(observation.fixtureObservations, 'miruro-to')).toEqual(
      expect.objectContaining({ provider: 'miruro' })
    )
    expect(findFixtureObservation(observation.fixtureObservations, 'generic-site')).toEqual(
      expect.objectContaining({ provider: 'unknown' })
    )

    for (const fixtureObservation of observation.fixtureObservations) {
      expect(fixtureObservation.sentMessages).toBeGreaterThan(0)
      expect(fixtureObservation.deliveredMessages).toBe(fixtureObservation.sentMessages)
      expect(fixtureObservation.droppedMessages).toBe(0)
      expect(fixtureObservation.lostBytes).toBe(0)
      expect(fixtureObservation.byteLossRate).toBe(0)
      expect(fixtureObservation.retransmittedMessages).toBe(0)
      expect(fixtureObservation.retransmissionRate).toBe(0)
      expect(fixtureObservation.outOfOrderMessages).toBe(0)
      expect(fixtureObservation.sequenceGapMessages).toBe(0)
      expect(fixtureObservation.estimatedRoundTripP95LatencyMs).toBeLessThanOrEqual(
        STREAMING_SITE_CONNECTION_FASTEST_ROUND_TRIP_MS
      )
      expect(fixtureObservation.maxMessageBytes).toBeLessThanOrEqual(
        STREAMING_SITE_TRANSPORT_BUDGET.maxMessageBytes
      )
      expect(fixtureObservation.averageMessageBytes).toBeLessThan(
        STREAMING_SITE_TRANSPORT_BUDGET.maxAverageMessageBytes
      )
    }
  })

  it('exposes recovered retry telemetry without counting it as byte loss', async () => {
    const result = await runStreamingSiteConnectionLab({
      budget: STREAMING_SITE_CONNECTION_BUDGET,
      fixtures: STREAMING_SITE_CONNECTION_FIXTURES,
      profiles: STREAMING_SITE_CONNECTION_PROFILES,
      nowStartMs: 19000,
      random: () => 0.5
    })

    const observation = findObservation(result.observations, 'retry-guarded')

    expect(observation.fixtureObservations.some(item => item.retransmittedMessages > 0)).toBe(true)
    for (const fixtureObservation of observation.fixtureObservations) {
      expect(fixtureObservation.byteLossRate).toBe(0)
      expect(fixtureObservation.lostBytes).toBe(0)
      expect(fixtureObservation.sequenceGapMessages).toBe(0)
      expect(fixtureObservation.estimatedRoundTripP95LatencyMs).toBeLessThanOrEqual(
        STREAMING_SITE_CONNECTION_BUDGET.maxEstimatedRoundTripP95LatencyMs
      )
    }
  })
})

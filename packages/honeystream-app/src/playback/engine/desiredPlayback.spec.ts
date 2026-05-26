import { DesiredPlaybackModel } from '../adapters/shared/playbackAdapter'
import {
  deriveDesiredPlaybackPositionMs,
  normalizeDesiredPlaybackModel,
  normalizeSeekToleranceMs
} from './desiredPlayback'

const createDesiredPlayback = (
  overrides: Partial<DesiredPlaybackModel> = {}
): DesiredPlaybackModel => ({
  state: 'playing',
  positionMs: 1000,
  updatedAtHostMs: 5000,
  rate: 1,
  durationMs: 10000,
  ...overrides
})

describe('desired playback model', () => {
  it('clamps position to duration', () => {
    const normalized = normalizeDesiredPlaybackModel(
      createDesiredPlayback({
        positionMs: 12000
      })
    )

    expect(normalized.positionMs).toBe(10000)
  })

  it('derives moving position while playing', () => {
    const positionMs = deriveDesiredPlaybackPositionMs(
      createDesiredPlayback({
        positionMs: 3000,
        updatedAtHostMs: 1000,
        rate: 1.5
      }),
      2000
    )

    expect(positionMs).toBe(4500)
  })

  it('returns the stored position while paused', () => {
    const positionMs = deriveDesiredPlaybackPositionMs(
      createDesiredPlayback({
        state: 'paused',
        positionMs: 3200
      }),
      9000
    )

    expect(positionMs).toBe(3200)
  })

  it('rejects invalid rates', () => {
    expect(() =>
      normalizeDesiredPlaybackModel(
        createDesiredPlayback({
          rate: 0
        })
      )
    ).toThrow('rate must be a finite number greater than 0.')
  })

  it('normalizes seek tolerance with explicit override', () => {
    expect(normalizeSeekToleranceMs(120, 250)).toBe(120)
  })

  it('uses default seek tolerance when override is missing', () => {
    expect(normalizeSeekToleranceMs(undefined, 250)).toBe(250)
  })
})

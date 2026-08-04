import { interpolatePercentile } from './latency-percentile'

describe('latency percentile telemetry', () => {
  it('keeps small-sample P95 sensitive without letting one warm-up spike become the whole distribution', () => {
    const stableSamples = Array.from({ length: 16 }, () => 300)
    const percentile = interpolatePercentile([...stableSamples, 2200], 0.95)

    expect(percentile).toBeGreaterThan(300)
    expect(percentile).toBeLessThan(1500)
  })

  it('clamps percentile requests and handles empty samples', () => {
    expect(interpolatePercentile([], 0.95)).toBe(0)
    expect(interpolatePercentile([20, 10], -1)).toBe(10)
    expect(interpolatePercentile([20, 10], 2)).toBe(20)
  })
})

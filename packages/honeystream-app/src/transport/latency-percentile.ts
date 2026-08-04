export const interpolatePercentile = (
  samples: readonly number[],
  percentileValue: number
): number => {
  if (samples.length === 0) return 0

  const clampedPercentile = Math.min(1, Math.max(0, percentileValue))
  const sortedSamples = samples.slice().sort((left, right) => left - right)
  const position = (sortedSamples.length - 1) * clampedPercentile
  const lowerIndex = Math.floor(position)
  const upperIndex = Math.ceil(position)
  if (lowerIndex === upperIndex) return sortedSamples[lowerIndex]

  const lowerValue = sortedSamples[lowerIndex]
  const upperValue = sortedSamples[upperIndex]
  return lowerValue + (upperValue - lowerValue) * (position - lowerIndex)
}

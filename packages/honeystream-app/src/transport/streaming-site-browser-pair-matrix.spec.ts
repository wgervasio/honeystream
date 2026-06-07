import { classifyMediaProvider, MediaProvider } from 'protocol'
import {
  STREAMING_SITE_BROWSER_PAIR_E2E_LANE_COUNT,
  STREAMING_SITE_BROWSER_PAIR_E2E_LANES,
  STREAMING_SITE_BROWSER_PAIR_E2E_PATH_COUNT,
  STREAMING_SITE_BROWSER_PAIR_E2E_SOURCES,
  StreamingSiteBrowserPairE2ELane
} from './streaming-site-browser-pair-e2e-matrix'

const normalizeSource = (source: string): string =>
  /^https?:\/\//.test(source) ? source : `https://${source}`

const providerToLane = (provider: MediaProvider): StreamingSiteBrowserPairE2ELane =>
  provider === 'unknown' ? 'generic' : provider

describe('streaming site browser-pair matrix', () => {
  it('keeps one full control burst for every browser-pair lane', () => {
    expect(STREAMING_SITE_BROWSER_PAIR_E2E_LANE_COUNT).toBe(
      STREAMING_SITE_BROWSER_PAIR_E2E_LANES.length
    )
    expect(STREAMING_SITE_BROWSER_PAIR_E2E_PATH_COUNT).toBe(
      STREAMING_SITE_BROWSER_PAIR_E2E_SOURCES.length
    )
    expect(STREAMING_SITE_BROWSER_PAIR_E2E_PATH_COUNT).toBeGreaterThan(
      STREAMING_SITE_BROWSER_PAIR_E2E_LANE_COUNT
    )

    for (const lane of STREAMING_SITE_BROWSER_PAIR_E2E_LANES) {
      const laneSources = STREAMING_SITE_BROWSER_PAIR_E2E_SOURCES.filter(
        source => source.lane === lane
      )
      expect(laneSources.length).toBeGreaterThanOrEqual(4)
      expect(laneSources.filter(source => source.exerciseControls)).toHaveLength(1)
    }
  })

  it('matches each browser-pair source to the provider classifier', () => {
    for (const source of STREAMING_SITE_BROWSER_PAIR_E2E_SOURCES) {
      expect(providerToLane(classifyMediaProvider(normalizeSource(source.url)))).toBe(source.lane)
    }
  })
})

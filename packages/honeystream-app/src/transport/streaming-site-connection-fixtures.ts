import type { StreamingSiteConnectionFixture } from './streaming-site-connection-lab'
import { STREAMING_SITE_ANIMEPAHE_FIXTURES } from './streaming-site-connection-fixtures-animepahe'
import { STREAMING_SITE_CINEBY_FIXTURES } from './streaming-site-connection-fixtures-cineby'
import { STREAMING_SITE_GENERIC_FIXTURES } from './streaming-site-connection-fixtures-generic'
import { STREAMING_SITE_MIRURO_FIXTURES } from './streaming-site-connection-fixtures-miruro'
import { STREAMING_SITE_YOUTUBE_FIXTURES } from './streaming-site-connection-fixtures-youtube'

export const STREAMING_SITE_CONNECTION_FIXTURES: readonly StreamingSiteConnectionFixture[] = Object.freeze(
  [
    ...STREAMING_SITE_YOUTUBE_FIXTURES,
    ...STREAMING_SITE_ANIMEPAHE_FIXTURES,
    ...STREAMING_SITE_CINEBY_FIXTURES,
    ...STREAMING_SITE_MIRURO_FIXTURES,
    ...STREAMING_SITE_GENERIC_FIXTURES
  ]
)

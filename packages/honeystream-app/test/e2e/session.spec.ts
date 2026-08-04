import { Browser, Page, BrowserContext, chromium } from 'playwright-core'
import {
  STREAMING_SITE_BROWSER_PAIR_E2E_LANES,
  STREAMING_SITE_BROWSER_PAIR_E2E_LANE_COUNT,
  STREAMING_SITE_BROWSER_PAIR_E2E_PATH_COUNT,
  STREAMING_SITE_BROWSER_PAIR_E2E_SOURCES,
  StreamingSiteBrowserPairE2ESource
} from '../../src/transport/streaming-site-browser-pair-e2e-matrix'
import { STREAMING_SITE_CONNECTION_FIXTURES } from '../../src/transport/streaming-site-connection-fixtures'

const { getAppBaseUrl } = require('../environment/server-config') as {
  getAppBaseUrl(): string
}
const playwrightConfig = require('../../jest-playwright.config') as {
  readonly context?: Parameters<Browser['newContext']>[0]
  readonly launchBrowserApp?: Parameters<typeof chromium.launch>[0]
}

const RUNTIME_SHELL_SELECTOR = '[data-runtime-session-shell="true"]'
const INVITE_LINK_SELECTOR = '[data-invite-field="invite-link"] code'
const SESSION_E2E_TIMEOUT_MS = 180e3
const STREAMING_SITE_SESSION_E2E_TIMEOUT_MS = 600e3
const APP_READY_OPTIONS = { waitUntil: 'domcontentloaded' as const }
const PLAYBACK_POSITION_SELECTOR = '#runtime_playback_controls [data-intent="positionMs"]'
const PLAYBACK_PLAY_PAUSE_SELECTOR = '#runtime_playback_controls [data-intent="playPause"]'
const SEEK_FORWARD_STEP_MS = 10000
const PLAYBACK_SYNC_TOLERANCE_MS = 750
const PLAYBACK_SYNC_ASSERTION_TIMEOUT_MS = 15000
const USE_BROADCAST_RTC_E2E = process.env.HONEYSTREAM_E2E_BROADCAST_RTC !== 'false'
const PLAYBACK_STATE_RETRY_COUNT = 3
const PLAYBACK_STATE_RETRY_TIMEOUT_MS = USE_BROADCAST_RTC_E2E ? 15000 : 30000
const QUEUE_STATE_TIMEOUT_MS = 60000
const RUNTIME_TEXT_TIMEOUT_MS = 30000
const BROWSER_RESOURCE_CLOSE_TIMEOUT_MS = 5000
const STREAMING_SITE_BROWSER_PAIR_CONTROL_SOURCES = STREAMING_SITE_BROWSER_PAIR_E2E_SOURCES.filter(
  source => source.exerciseControls
)
const createStreamingSiteBrowserPairSourceGroups = () => {
  const groups: {
    readonly label: string
    readonly lane: string
    readonly sources: readonly StreamingSiteBrowserPairE2ESource[]
  }[] = []

  STREAMING_SITE_BROWSER_PAIR_E2E_LANES.forEach(lane => {
    const laneSources = STREAMING_SITE_BROWSER_PAIR_E2E_SOURCES.filter(
      source => source.lane === lane
    )
    const controlSources = STREAMING_SITE_BROWSER_PAIR_CONTROL_SOURCES.filter(
      source => source.lane === lane
    )
    if (laneSources.length === 0) {
      throw new Error(`Expected at least one browser-pair source for ${lane}.`)
    }
    if (controlSources.length !== 1) {
      throw new Error(`Expected exactly one browser-pair control source for ${lane}.`)
    }
    groups.push({ label: lane, lane, sources: laneSources })
  })

  return groups
}
const STREAMING_SITE_BROWSER_PAIR_SESSION_SOURCE_GROUPS = createStreamingSiteBrowserPairSourceGroups()
const STREAMING_SITE_CONNECTION_FIXTURE_COUNT = STREAMING_SITE_CONNECTION_FIXTURES.length
const STREAMING_SITE_PROVIDER_MATCHERS = Object.freeze([
  { label: 'YouTube', domains: ['youtube.com', 'youtube-nocookie.com', 'youtu.be'] },
  { label: 'AnimePahe', domains: ['animepahe.com', 'animepahe.ru', 'animepahe.si'] },
  { label: 'Cineby', domains: ['cineby.app', 'cineby.ru', 'cineby.to'] },
  { label: 'Miruro', domains: ['miruro.to', 'miruro.tv'] }
])
const STREAMING_SITE_BROWSER_PAIR_LANE_LABELS: Record<
  StreamingSiteBrowserPairE2ESource['lane'],
  string
> = {
  youtube: 'YouTube',
  animepahe: 'AnimePahe',
  cineby: 'Cineby',
  miruro: 'Miruro',
  generic: 'Website'
}
const STREAMING_SITE_NAMED_PROVIDER_COUNT = STREAMING_SITE_PROVIDER_MATCHERS.length
const normalizeHostname = (hostname: string): string =>
  hostname
    .trim()
    .toLowerCase()
    .replace(/\.$/, '')
const isHostOrSubdomain = (hostname: string, domain: string): boolean =>
  hostname === domain || hostname.endsWith(`.${domain}`)
const countFixtureHostsForDomains = (domains: readonly string[]): number =>
  STREAMING_SITE_CONNECTION_FIXTURES.filter(fixture => {
    const hostname = normalizeHostname(new URL(fixture.source).hostname)
    return domains.some(domain => isHostOrSubdomain(hostname, domain))
  }).length
const STREAMING_SITE_PROVIDER_COVERAGE_LABELS = STREAMING_SITE_PROVIDER_MATCHERS.map(
  matcher => `${matcher.label} x${countFixtureHostsForDomains(matcher.domains)}`
)
const GENERIC_STREAMING_SITE_EXAMPLES =
  'Vimeo, Twitch, Netflix-style, Hulu, Prime Video, Tubi, Dailymotion, TikTok, Instagram, ' +
  'Plex, Disney+, Crunchyroll, Apple TV+, Peacock, Max, Paramount+, Roku Channel, Kanopy, ' +
  'Bilibili, Rumble, SoundCloud, and Facebook Watch'
const LIVE_CONTROL_LATENCY_BUDGET_MS = 1500
const LIVE_CONTROL_ACTION_P95_BUDGET_MS = 5000
const LIVE_CONTROL_PROGRESS_BUDGET_MS = 10000
const LIVE_CONTROL_PAIR_LOSSLESS_BUDGET_MS = USE_BROADCAST_RTC_E2E ? 5000 : 2000
const LIVE_CONTROL_FRAME_BUDGET_BYTES = 2048
const LIVE_BROWSER_PAIR_MODE = 'separate-browser-processes'
const LIVE_BROWSER_PROCESS_COUNT = 2
const LIVE_PAIR_RECEIPT_CHECK = 'host-and-guest-sent-received-lossless'
const CONNECTION_CONFIDENCE_SELECTOR =
  '#runtime_connection_confidence[data-byte-loss-rate="0"]' +
  '[data-lost-control-bytes="0"][data-dropped-control-messages="0"]' +
  '[data-reordered-control-messages="0"][data-sequence-gap-control-messages="0"]' +
  '[data-missing-directional-deliveries="0"]' +
  '[data-tail-latency-ms-budget="10"][data-best-round-trip-ms="2"]' +
  `[data-provider-count="${STREAMING_SITE_NAMED_PROVIDER_COUNT}"]` +
  `[data-site-count="${STREAMING_SITE_CONNECTION_FIXTURE_COUNT}"]` +
  `[data-site-lane-count="${STREAMING_SITE_BROWSER_PAIR_E2E_LANE_COUNT}"]` +
  `[data-site-path-count="${STREAMING_SITE_BROWSER_PAIR_E2E_PATH_COUNT}"]` +
  '[data-test-modes="broadcast+isolated-live"]'
const BROWSER_SYNC_RECEIPT_READY_SELECTOR =
  '#runtime_browser_sync_receipt[data-receipt-state="ready"][data-byte-loss-rate="0"]' +
  '[data-lost-control-bytes="0"][data-dropped-control-messages="0"]' +
  '[data-live-control-receipt-state="ready"]' +
  '[data-reordered-control-messages="0"][data-sequence-gap-control-messages="0"]' +
  '[data-missing-directional-deliveries="0"]' +
  '[data-tail-latency-ms-budget="10"]' +
  `[data-site-lane-count="${STREAMING_SITE_BROWSER_PAIR_E2E_LANE_COUNT}"]` +
  `[data-site-path-count="${STREAMING_SITE_BROWSER_PAIR_E2E_PATH_COUNT}"]` +
  '[data-test-modes="broadcast+isolated-live"]'
const HAPPY_SYNC_SEAL_READY_SELECTOR =
  '#runtime_happy_sync_seal[data-seal-state="ready"][data-byte-loss-rate="0"]' +
  '[data-browser-path-coverage="all"]' +
  '[data-lost-control-bytes="0"][data-dropped-control-messages="0"]' +
  '[data-live-control-receipt-state="ready"]' +
  '[data-reordered-control-messages="0"][data-sequence-gap-control-messages="0"]' +
  '[data-missing-directional-deliveries="0"]' +
  '[data-tail-latency-ms-budget="10"]' +
  `[data-site-lane-count="${STREAMING_SITE_BROWSER_PAIR_E2E_LANE_COUNT}"]` +
  `[data-site-path-count="${STREAMING_SITE_BROWSER_PAIR_E2E_PATH_COUNT}"]` +
  '[data-test-modes="broadcast+isolated-live"]'
const LIVE_CONTROL_RECEIPT_READY_SELECTOR =
  '#runtime_live_control_receipt[data-live-receipt-state="ready"]' +
  `[data-live-action-p95-budget-ms="${LIVE_CONTROL_ACTION_P95_BUDGET_MS}"]` +
  `[data-live-browser-mode="${LIVE_BROWSER_PAIR_MODE}"]` +
  `[data-live-browser-process-count="${LIVE_BROWSER_PROCESS_COUNT}"]` +
  '[data-live-byte-reconciliation="sent-equals-received"]' +
  '[data-live-sent-control-state="observed"][data-live-received-control-state="observed"]' +
  '[data-live-latency-state="under-budget"][data-live-frame-state="under-budget"]' +
  `[data-live-latency-budget-ms="${LIVE_CONTROL_LATENCY_BUDGET_MS}"]` +
  `[data-live-pair-check="${LIVE_PAIR_RECEIPT_CHECK}"]` +
  `[data-live-frame-budget-bytes="${LIVE_CONTROL_FRAME_BUDGET_BYTES}"]`
const BROWSER_PAIR_MATRIX_SELECTOR =
  '[data-merge-gate-metric="browser-pair-matrix"]' +
  `[data-merge-gate-value="${STREAMING_SITE_BROWSER_PAIR_E2E_PATH_COUNT} browser paths"]`
const findStreamingSiteBrowserPairSource = (
  lane: StreamingSiteBrowserPairE2ESource['lane'],
  url: string
): StreamingSiteBrowserPairE2ESource => {
  const source = STREAMING_SITE_BROWSER_PAIR_E2E_SOURCES.find(
    candidate => candidate.lane === lane && candidate.url === url
  )
  if (!source) throw new Error(`Missing ${lane} browser-pair e2e source "${url}".`)
  return source
}
const MIXED_SITE_HANDOFF_YOUTUBE_SOURCE = findStreamingSiteBrowserPairSource(
  'youtube',
  'youtube.com/watch?v=two-browser-youtube'
)
const MIXED_SITE_HANDOFF_SOURCES: readonly StreamingSiteBrowserPairE2ESource[] = Object.freeze(
  [
    MIXED_SITE_HANDOFF_YOUTUBE_SOURCE,
    findStreamingSiteBrowserPairSource('animepahe', 'animepahe.ru/play/two-browser-animepahe'),
    findStreamingSiteBrowserPairSource('cineby', 'cineby.app/movie/two-browser-cineby'),
    findStreamingSiteBrowserPairSource('miruro', 'miruro.to/watch/two-browser-miruro'),
    findStreamingSiteBrowserPairSource('generic', 'vimeo.com/123456789')
  ]
)
const getBrowserPairPreviewProvider = (source: StreamingSiteBrowserPairE2ESource): string =>
  source.lane === 'generic' ? 'unknown' : source.lane
const getBrowserPairPreviewLabel = (source: StreamingSiteBrowserPairE2ESource): string =>
  `${STREAMING_SITE_BROWSER_PAIR_LANE_LABELS[source.lane]} lane`
interface LiveControlMetricSnapshot {
  readonly maxFrameBytes: number
  readonly p95LatencyMs: number
  readonly receivedBytes: number
  readonly receivedMessages: number
  readonly sentBytes: number
  readonly sentMessages: number
}

interface LiveControlPairMetricSnapshot {
  readonly client: LiveControlMetricSnapshot
  readonly host: LiveControlMetricSnapshot
}

interface LiveControlPairAggregate {
  readonly maxFrameBytes: number
  readonly maxP95LatencyMs: number
  readonly receivedBytes: number
  readonly receivedMessages: number
  readonly sentBytes: number
  readonly sentMessages: number
}

type LiveControlActionRunner = (label: string, action: () => Promise<void>) => Promise<void>
type FocusableE2EPage = Page & {
  readonly bringToFront?: () => Promise<void>
}

let runtimeVisitCounter = 0
let e2eRelayRoomCounter = 0

jest.setTimeout(STREAMING_SITE_SESSION_E2E_TIMEOUT_MS)

async function getRuntimeInviteSecret(page: Page): Promise<string> {
  await page.waitForSelector(INVITE_LINK_SELECTOR, { timeout: RUNTIME_TEXT_TIMEOUT_MS })
  const inviteLink = await page.$eval(INVITE_LINK_SELECTOR, e => e.textContent || '')
  const inviteUrl = new URL(inviteLink)
  const secret = inviteUrl.searchParams.get('secret')
  if (!secret) {
    throw new Error('Expected runtime invite link to include a secret.')
  }

  return secret
}

async function waitForRuntimeText(page: Page, text: string): Promise<void> {
  try {
    await waitForPageStringCondition(
      page,
      expectedText =>
        Boolean(
          document.body &&
            document.body.textContent &&
            document.body.textContent.includes(expectedText)
        ),
      text,
      RUNTIME_TEXT_TIMEOUT_MS,
      `runtime text: ${text}`
    )
  } catch (error) {
    if (!isTimeoutError(error)) throw error
    const bodyTextExcerpt = await getBodyTextExcerpt(page)
    throw new Error(
      `Timed out waiting for runtime text: ${text}\nVisible text excerpt: ${bodyTextExcerpt}`
    )
  }
}

async function waitForRuntimeShell(page: Page, label: string): Promise<void> {
  try {
    await waitForPageReadyCondition(
      page,
      () =>
        Boolean(document.querySelector('[data-runtime-session-shell="true"]')) ||
        Boolean(
          document.body &&
            document.body.textContent &&
            document.body.textContent.includes('Cozy watch room') &&
            document.body.textContent.includes('Room code')
        ),
      RUNTIME_TEXT_TIMEOUT_MS,
      `runtime shell on ${label}`
    )
  } catch (error) {
    if (!isTimeoutError(error)) throw error
    const pageState = await getRuntimePageState(page)
    if (pageState.bodyText.includes('Cozy watch room') && pageState.bodyText.includes('Room code')) {
      return
    }
    throw new Error(
      `Timed out waiting for runtime shell on ${label}. ` +
        `URL: ${pageState.href}. welcomed=${pageState.welcomed || ''}. ` +
        `identity.pub=${pageState.publicId || ''}. ` +
        `Visible text excerpt: ${pageState.bodyText
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 800)}`
    )
  }
}

async function getRuntimePageState(
  page: Page
): Promise<{
  readonly bodyText: string
  readonly href: string
  readonly publicId: string
  readonly welcomed: string
}> {
  try {
    return await page.evaluate(() => ({
      bodyText: document.body && document.body.textContent ? document.body.textContent : '',
      href: window.location.href,
      publicId: window.localStorage.getItem('identity.pub') || '',
      welcomed: window.localStorage.getItem('welcomed') || ''
    }))
  } catch (stateError) {
    return {
      bodyText: `page state unavailable: ${formatErrorMessage(stateError)}`,
      href: '',
      publicId: '',
      welcomed: ''
    }
  }
}

async function getPlaybackPositionMs(page: Page): Promise<number> {
  const positionText = await page.$eval(
    PLAYBACK_POSITION_SELECTOR,
    element => element.getAttribute('data-position-ms') || '0'
  )
  const positionMs = Number(positionText)
  if (!Number.isFinite(positionMs)) {
    throw new Error(`Expected playback position to be numeric, received "${positionText}".`)
  }

  return positionMs
}

async function getPlaybackRateLabel(page: Page): Promise<string> {
  return page.$eval('#runtime_playback_controls [data-intent="rateValue"]', element =>
    (element.textContent || '').trim()
  )
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const totalLiveControlBytes = (snapshot: LiveControlMetricSnapshot): number =>
  snapshot.sentBytes + snapshot.receivedBytes

const totalLiveControlMessages = (snapshot: LiveControlMetricSnapshot): number =>
  snapshot.sentMessages + snapshot.receivedMessages

const aggregateLiveControlPairMetrics = (
  snapshot: LiveControlPairMetricSnapshot
): LiveControlPairAggregate => ({
  maxFrameBytes: Math.max(snapshot.host.maxFrameBytes, snapshot.client.maxFrameBytes),
  maxP95LatencyMs: Math.max(snapshot.host.p95LatencyMs, snapshot.client.p95LatencyMs),
  receivedBytes: snapshot.host.receivedBytes + snapshot.client.receivedBytes,
  receivedMessages: snapshot.host.receivedMessages + snapshot.client.receivedMessages,
  sentBytes: snapshot.host.sentBytes + snapshot.client.sentBytes,
  sentMessages: snapshot.host.sentMessages + snapshot.client.sentMessages
})

const isLiveControlPairLossless = (snapshot: LiveControlPairMetricSnapshot): boolean => {
  const aggregate = aggregateLiveControlPairMetrics(snapshot)
  return (
    snapshot.host.sentMessages > 0 &&
    snapshot.host.receivedMessages > 0 &&
    snapshot.client.sentMessages > 0 &&
    snapshot.client.receivedMessages > 0 &&
    aggregate.sentMessages === aggregate.receivedMessages &&
    aggregate.sentBytes === aggregate.receivedBytes &&
    aggregate.maxFrameBytes > 0 &&
    aggregate.maxFrameBytes <= LIVE_CONTROL_FRAME_BUDGET_BYTES &&
    aggregate.maxP95LatencyMs <= LIVE_CONTROL_ACTION_P95_BUDGET_MS
  )
}

async function focusE2EPage(page: Page): Promise<void> {
  const focusablePage = page as FocusableE2EPage
  if (focusablePage.bringToFront) {
    await focusablePage.bringToFront()
    return
  }
  await page.evaluate(() => window.focus())
}

async function getLiveControlMetricSnapshot(page: Page): Promise<LiveControlMetricSnapshot> {
  return page.$eval('#runtime_live_control_receipt', element => {
    const readNumber = (name: string): number => {
      const value = Number(element.getAttribute(name) || '0')
      return Number.isFinite(value) ? value : 0
    }

    return {
      maxFrameBytes: readNumber('data-live-max-frame-bytes'),
      p95LatencyMs: readNumber('data-live-p95-latency-ms'),
      receivedBytes: readNumber('data-live-received-control-bytes'),
      receivedMessages: readNumber('data-live-received-control-messages'),
      sentBytes: readNumber('data-live-sent-control-bytes'),
      sentMessages: readNumber('data-live-sent-control-messages')
    }
  })
}

async function getLiveControlPairMetricSnapshot(input: {
  readonly clientPage: Page
  readonly hostPage: Page
}): Promise<LiveControlPairMetricSnapshot> {
  const host = await getLiveControlMetricSnapshot(input.hostPage)
  const client = await getLiveControlMetricSnapshot(input.clientPage)
  return { client, host }
}

async function waitForLiveControlMetricProgress(
  page: Page,
  before: LiveControlMetricSnapshot,
  label: string
): Promise<LiveControlMetricSnapshot> {
  const startedAtMs = Date.now()
  let after = await getLiveControlMetricSnapshot(page)
  while (
    Date.now() - startedAtMs <= LIVE_CONTROL_PROGRESS_BUDGET_MS &&
    (totalLiveControlMessages(after) <= totalLiveControlMessages(before) ||
      totalLiveControlBytes(after) <= totalLiveControlBytes(before))
  ) {
    await delay(25)
    after = await getLiveControlMetricSnapshot(page)
  }

  const elapsedMs = Date.now() - startedAtMs
  expect(totalLiveControlMessages(after)).toBeGreaterThan(totalLiveControlMessages(before))
  expect(totalLiveControlBytes(after)).toBeGreaterThan(totalLiveControlBytes(before))
  expect(elapsedMs).toBeLessThanOrEqual(LIVE_CONTROL_PROGRESS_BUDGET_MS)
  expect(after.maxFrameBytes).toBeGreaterThan(0)
  expect(after.maxFrameBytes).toBeLessThanOrEqual(LIVE_CONTROL_FRAME_BUDGET_BYTES)
  if (after.receivedMessages > 0) {
    expect(after.p95LatencyMs).toBeLessThanOrEqual(LIVE_CONTROL_ACTION_P95_BUDGET_MS)
  }
  return after
}

async function waitForLiveControlPairLossless(input: {
  readonly clientPage: Page
  readonly hostPage: Page
  readonly label: string
}): Promise<void> {
  const startedAtMs = Date.now()
  let snapshot = await getLiveControlPairMetricSnapshot(input)
  while (
    Date.now() - startedAtMs <= LIVE_CONTROL_PAIR_LOSSLESS_BUDGET_MS &&
    !isLiveControlPairLossless(snapshot)
  ) {
    await delay(25)
    snapshot = await getLiveControlPairMetricSnapshot(input)
  }

  if (!isLiveControlPairLossless(snapshot)) {
    const aggregate = aggregateLiveControlPairMetrics(snapshot)
    throw new Error(
      `Expected live control pair to settle losslessly after ${input.label}. ` +
        `sent=${aggregate.sentMessages}/${aggregate.sentBytes}B ` +
        `received=${aggregate.receivedMessages}/${aggregate.receivedBytes}B ` +
        `maxFrame=${aggregate.maxFrameBytes}B maxP95=${aggregate.maxP95LatencyMs}ms.`
    )
  }
}

async function expectLiveControlProgress(input: {
  readonly before: LiveControlPairMetricSnapshot
  readonly clientPage: Page
  readonly hostPage: Page
  readonly label: string
}): Promise<LiveControlPairMetricSnapshot> {
  await focusE2EPage(input.hostPage)
  const host = await waitForLiveControlMetricProgress(
    input.hostPage,
    input.before.host,
    `${input.label} host`
  )
  await focusE2EPage(input.clientPage)
  const client = await waitForLiveControlMetricProgress(
    input.clientPage,
    input.before.client,
    `${input.label} client`
  )
  await waitForLiveControlPairLossless({
    clientPage: input.clientPage,
    hostPage: input.hostPage,
    label: input.label
  })
  return { client, host }
}

function createLiveControlActionRunner(input: {
  readonly clientPage: Page
  readonly hostPage: Page
}): LiveControlActionRunner {
  return async (label: string, action: () => Promise<void>): Promise<void> => {
    const before = await getLiveControlPairMetricSnapshot(input)
    await action()
    await expectLiveControlProgress({
      before,
      clientPage: input.clientPage,
      hostPage: input.hostPage,
      label
    })
  }
}

async function waitForBoundedPageOperation(
  operation: () => Promise<unknown>,
  timeoutMs: number,
  label: string
): Promise<void> {
  try {
    await operation()
  } catch (error) {
    if (!isTimeoutError(error)) {
      throw error
    }
    throw new Error(`Timed out waiting for ${label} after ${timeoutMs}ms.`)
  }
}

async function waitForPageStringCondition(
  page: Page,
  condition: (arg: string) => boolean,
  arg: string,
  timeoutMs: number,
  label: string
): Promise<void> {
  await waitForBoundedPageOperation(
    () => page.waitForFunction(condition, arg, { timeout: timeoutMs }),
    timeoutMs,
    label
  )
}

async function waitForPageNumberCondition(
  page: Page,
  condition: (arg: number) => boolean,
  arg: number,
  timeoutMs: number,
  label: string
): Promise<void> {
  await waitForBoundedPageOperation(
    () => page.waitForFunction(condition, arg, { timeout: timeoutMs }),
    timeoutMs,
    label
  )
}

async function waitForPageReadyCondition(
  page: Page,
  condition: () => boolean,
  timeoutMs: number,
  label: string
): Promise<void> {
  await waitForBoundedPageOperation(
    () => page.waitForFunction(condition, undefined, { timeout: timeoutMs }),
    timeoutMs,
    label
  )
}

async function gotoWithBoundedNavigation(
  page: Page,
  url: string,
  timeoutMs: number
): Promise<void> {
  await page.goto(url, {
    ...APP_READY_OPTIONS,
    timeout: timeoutMs
  })
}

type CloseableBrowserResource = {
  readonly close: () => Promise<void>
}

type KillableBrowserProcess = {
  readonly killed?: boolean
  readonly exitCode?: number | null
  readonly pid?: number
  readonly signalCode?: string | null
  kill(): void
}

type BrowserWithProcess = Browser & {
  process?: () => KillableBrowserProcess | null
}

async function closeBrowserResource(
  label: string,
  resource: CloseableBrowserResource | undefined
): Promise<void> {
  if (!resource) return

  let timedOut = false
  const closePromise = resource.close().catch(error => {
    if (!timedOut) {
      console.warn(`${label} close failed:`, error && error.message ? error.message : error)
    }
  })
  const timeoutPromise = delay(BROWSER_RESOURCE_CLOSE_TIMEOUT_MS).then(() => {
    timedOut = true
  })

  await Promise.race([closePromise, timeoutPromise])
}

async function closeBrowserForE2E(browserToClose: Browser | undefined): Promise<void> {
  if (!browserToClose) return

  const getProcess = (browserToClose as BrowserWithProcess).process
  const browserProcess = getProcess ? getProcess() : undefined
  await closeBrowserResource('Playwright browser', browserToClose)
  if (
    browserProcess &&
    !browserProcess.killed &&
    (browserProcess.exitCode === null || typeof browserProcess.exitCode === 'undefined') &&
    !browserProcess.signalCode
  ) {
    browserProcess.kill()
  }
}

function getBrowserProcessId(browserInstance: Browser | undefined): number | undefined {
  if (!browserInstance) return undefined
  const getProcess = (browserInstance as BrowserWithProcess).process
  const browserProcess = getProcess ? getProcess() : undefined
  return browserProcess && typeof browserProcess.pid === 'number' ? browserProcess.pid : undefined
}

async function expectPlaybackPositionsSynced(input: {
  readonly clientPage: Page
  readonly hostPage: Page
  readonly label: string
}): Promise<void> {
  const startedAtMs = Date.now()
  let lastClientPositionMs = 0
  let lastHostPositionMs = 0

  while (Date.now() - startedAtMs < PLAYBACK_SYNC_ASSERTION_TIMEOUT_MS) {
    lastHostPositionMs = await getPlaybackPositionMs(input.hostPage)
    lastClientPositionMs = await getPlaybackPositionMs(input.clientPage)
    if (Math.abs(lastHostPositionMs - lastClientPositionMs) <= PLAYBACK_SYNC_TOLERANCE_MS) {
      return
    }
    await delay(250)
  }

  throw new Error(
    `Expected playback positions to stay within ${PLAYBACK_SYNC_TOLERANCE_MS}ms for ${
      input.label
    }. Last host=${lastHostPositionMs}ms client=${lastClientPositionMs}ms.`
  )
}

async function getRuntimePlaybackState(
  page: Page
): Promise<'idle' | 'playing' | 'paused' | undefined> {
  const state = await page.$eval('#runtime_playback_controls', element =>
    element.getAttribute('data-playback-state')
  )
  return state === 'idle' || state === 'playing' || state === 'paused' ? state : undefined
}

async function waitForPlaybackPositionAtLeast(
  page: Page,
  expectedPositionMs: number,
  label: string
): Promise<void> {
  try {
    await waitForPageNumberCondition(
      page,
      expectedPosition => {
        const positionElement = document.querySelector(
          '#runtime_playback_controls [data-intent="positionMs"]'
        )
        if (!positionElement) {
          return false
        }

        const positionMs = Number(positionElement.getAttribute('data-position-ms') || 'NaN')
        return Number.isFinite(positionMs) && positionMs >= expectedPosition
      },
      expectedPositionMs,
      PLAYBACK_STATE_RETRY_TIMEOUT_MS,
      `playback position on ${label}`
    )
  } catch (error) {
    if (!isTimeoutError(error)) throw error
    const playbackState = await page.evaluate(() => {
      const controls = document.querySelector('#runtime_playback_controls')
      const positionElement = document.querySelector(
        '#runtime_playback_controls [data-intent="positionMs"]'
      )
      return {
        playbackState: controls ? controls.getAttribute('data-playback-state') || '' : '',
        positionMs: positionElement ? positionElement.getAttribute('data-position-ms') || '' : '',
        syncConfident: positionElement
          ? positionElement.getAttribute('data-sync-confident') || ''
          : ''
      }
    })
    throw new Error(
      `Timed out waiting for playback position on ${label}. ` +
        `expected>=${expectedPositionMs}; actual=${playbackState.positionMs}; ` +
        `state=${playbackState.playbackState}; sync=${playbackState.syncConfident}. ` +
        `Visible text excerpt: ${await getBodyTextExcerpt(page)}`
    )
  }
}

async function waitForPlaybackState(
  page: Page,
  state: 'playing' | 'paused',
  timeout?: number
): Promise<void> {
  const waitTimeout = typeof timeout === 'number' ? timeout : PLAYBACK_STATE_RETRY_TIMEOUT_MS
  try {
    await waitForPageStringCondition(
      page,
      expectedState => {
        const controls = document.querySelector('#runtime_playback_controls')
        return Boolean(controls && controls.getAttribute('data-playback-state') === expectedState)
      },
      state,
      waitTimeout,
      `playback state ${state}`
    )
  } catch (error) {
    if (!isTimeoutError(error)) throw error
    const actualState = await getRuntimePlaybackState(page)
    throw new Error(
      `Timed out waiting for playback state ${state}. Last state=${actualState || 'missing'}. ` +
        `Visible text excerpt: ${await getBodyTextExcerpt(page)}`
    )
  }
}

async function waitForPlaybackRateLabel(page: Page, expectedLabel: string): Promise<void> {
  await waitForPageStringCondition(
    page,
    label => {
      const rateElement = document.querySelector(
        '#runtime_playback_controls [data-intent="rateValue"]'
      )
      return Boolean(
        rateElement && rateElement.textContent && rateElement.textContent.trim() === label
      )
    },
    expectedLabel,
    PLAYBACK_STATE_RETRY_TIMEOUT_MS,
    `playback rate label ${expectedLabel}`
  )
}

async function waitForPlaybackRateLabelChange(page: Page, previousLabel: string): Promise<string> {
  await waitForPageStringCondition(
    page,
    label => {
      const rateElement = document.querySelector(
        '#runtime_playback_controls [data-intent="rateValue"]'
      )
      const nextLabel = rateElement && rateElement.textContent ? rateElement.textContent.trim() : ''
      return nextLabel.length > 0 && nextLabel !== label
    },
    previousLabel,
    PLAYBACK_STATE_RETRY_TIMEOUT_MS,
    `playback rate label change from ${previousLabel}`
  )

  return getPlaybackRateLabel(page)
}

async function waitForCurrentQueueTitle(page: Page, title: string): Promise<void> {
  await waitForPageStringCondition(
    page,
    expectedTitle => {
      const currentTitle = document.querySelector('[data-queue-state="current"] strong')
      return Boolean(
        currentTitle &&
          currentTitle.textContent &&
          currentTitle.textContent.indexOf(expectedTitle) !== -1
      )
    },
    title,
    QUEUE_STATE_TIMEOUT_MS,
    `current queue title ${title}`
  )
}

async function waitForQueuedItemTitle(page: Page, title: string): Promise<void> {
  await waitForPageStringCondition(
    page,
    expectedTitle =>
      Array.prototype.some.call(
        document.querySelectorAll('[data-queue-item-id] span:first-child'),
        (element: Element) =>
          Boolean(element.textContent && element.textContent.indexOf(expectedTitle) !== -1)
      ),
    title,
    QUEUE_STATE_TIMEOUT_MS,
    `queued item title ${title}`
  )
}

async function addRuntimeMediaUrl(page: Page, url: string): Promise<void> {
  await page.fill('#runtime-add-media-url', '')
  await page.type('#runtime-add-media-url', url)
  await waitForRuntimeText(page, 'Honeystream will add https:// automatically')
  await page.press('#runtime-add-media-url', 'Enter')
  await waitForRuntimeText(page, 'Media added with https:// filled in')
}

async function getCurrentQueueMediaId(page: Page): Promise<string> {
  return page.$eval(
    '[data-queue-state="current"]',
    element => element.getAttribute('data-queue-current-id') || ''
  )
}

async function waitForCurrentQueueMediaIdChange(
  page: Page,
  previousMediaId: string,
  label: string
): Promise<string> {
  try {
    await waitForPageStringCondition(
      page,
      mediaId => {
        const current = document.querySelector('[data-queue-state="current"]')
        const nextMediaId = current ? current.getAttribute('data-queue-current-id') || '' : ''
        return nextMediaId.length > 0 && nextMediaId !== mediaId
      },
      previousMediaId,
      QUEUE_STATE_TIMEOUT_MS,
      `current queue media change on ${label}`
    )
  } catch (error) {
    if (!isTimeoutError(error)) throw error
    throw new Error(
      `Timed out waiting for current queue media to change on ${label}. ` +
        `Visible text excerpt: ${await getBodyTextExcerpt(page)}`
    )
  }

  return getCurrentQueueMediaId(page)
}

async function waitForQueueEmpty(page: Page, label: string): Promise<void> {
  try {
    await page.waitForSelector('[data-queue-empty="true"]', { timeout: QUEUE_STATE_TIMEOUT_MS })
  } catch (error) {
    if (!isTimeoutError(error)) throw error
    const queueState = await page.evaluate(() => ({
      currentMediaId: (() => {
        const current = document.querySelector('[data-queue-state="current"]')
        return current ? current.getAttribute('data-queue-current-id') || '' : ''
      })(),
      nextDisabled: Boolean(
        document.querySelector('#runtime_playback_controls [data-intent="next"][disabled]')
      ),
      queuedMediaIds: Array.from(document.querySelectorAll('[data-queue-item-id]')).map(
        item => item.getAttribute('data-queue-item-id') || ''
      )
    }))
    throw new Error(
      `Timed out waiting for empty queue on ${label}. ` +
        `current=${queueState.currentMediaId}. nextDisabled=${queueState.nextDisabled}. ` +
        `queued=${queueState.queuedMediaIds.join(',')}. ` +
        `Visible text excerpt: ${await getBodyTextExcerpt(page)}`
    )
  }
}

async function waitForStreamingMergeProof(page: Page): Promise<void> {
  await page.waitForSelector('[data-streaming-proof="byte-loss"][data-byte-loss-rate="0"]')
  await page.waitForSelector(
    `#runtime_connection_lab_proof[data-site-count="${STREAMING_SITE_CONNECTION_FIXTURE_COUNT}"]` +
      '[data-trial-count="3"]'
  )
  await page.waitForSelector(
    '#runtime_merge_gate[data-zero-loss-required="true"]' +
      `[data-provider-count="${STREAMING_SITE_NAMED_PROVIDER_COUNT}"]` +
      '[data-queue-byte-cap="262144"][data-trace-cap="64"]'
  )
  await page.waitForSelector(
    `#runtime_merge_gate[data-site-lane-count="${STREAMING_SITE_BROWSER_PAIR_E2E_LANE_COUNT}"]` +
      `[data-site-path-count="${STREAMING_SITE_BROWSER_PAIR_E2E_PATH_COUNT}"]`
  )
  await page.waitForSelector('[data-merge-gate-metric="byte-loss"][data-merge-gate-value="0%"]')
  await page.waitForSelector(
    '[data-merge-gate-metric="provider-lost-bytes"][data-merge-gate-value="0B"]'
  )
  await page.waitForSelector(
    '[data-merge-gate-metric="two-way-delivery"][data-merge-gate-value="both ways"]'
  )
  await page.waitForSelector(
    '[data-merge-gate-metric="tail-latency"][data-merge-gate-value="<=10ms P95"]'
  )
  await page.waitForSelector(
    '[data-merge-gate-metric="directional-skew"][data-merge-gate-value="<=4ms skew"]'
  )
  await page.waitForSelector(
    '[data-merge-gate-metric="payload-cap"][data-merge-gate-value="<=2048B"]'
  )
  await page.waitForSelector(
    '[data-merge-gate-metric="queue-byte-pressure"][data-merge-gate-value="<=262144B"]'
  )
  await page.waitForSelector(
    '[data-merge-gate-metric="retry-byte-overhead"][data-merge-gate-value="<=50%"]'
  )
  await page.waitForSelector(
    '[data-merge-gate-metric="per-site-observation"]' +
      `[data-merge-gate-value="${STREAMING_SITE_CONNECTION_FIXTURE_COUNT} observed"]`
  )
  await page.waitForSelector(BROWSER_PAIR_MATRIX_SELECTOR)
  await page.waitForSelector(
    '[data-merge-gate-metric="browser-isolation"][data-merge-gate-value="isolated live mode"]'
  )
  await page.waitForSelector(
    '[data-merge-gate-metric="merge-command"][data-merge-gate-value="unit + dual e2e"]'
  )
  await page.waitForSelector(CONNECTION_CONFIDENCE_SELECTOR)
  await waitForRuntimeText(
    page,
    'Live e2e mode runs cat-side and rabbit-side in separate browser processes through the real connection flow'
  )
  await waitForRuntimeText(
    page,
    'The default test command runs unit checks, broadcast e2e, and isolated live e2e before merge'
  )
  await waitForRuntimeText(page, 'Connection confidence')
  await waitForRuntimeText(page, 'Secret handshake')
  await waitForRuntimeText(
    page,
    'Missing-secret guests fail before live WebRTC starts; valid invite links move both seats to Synced'
  )
  await waitForRuntimeText(page, 'Two isolated browsers')
  await waitForRuntimeText(
    page,
    `Transport reliability covers all ${STREAMING_SITE_BROWSER_PAIR_E2E_PATH_COUNT} named and generic website paths`
  )
  await waitForRuntimeText(
    page,
    'broadcast and isolated live e2e queue every browser path and drive one full control burst per lane'
  )
  await waitForRuntimeText(page, 'Zero-loss controls')
  await waitForRuntimeText(
    page,
    'Every supported site lane requires 0B lost, 0 skipped controls, and both-way delivery'
  )
  await waitForRuntimeText(page, 'Under-10ms tail')
  await waitForRuntimeText(
    page,
    'Selected lanes stay under 10ms P95 with 2ms best mock round trips'
  )
  await waitForRuntimeText(page, 'Local website load')
  await waitForRuntimeText(
    page,
    `${GENERIC_STREAMING_SITE_EXAMPLES} pages stay generic`
  )
  await waitForRuntimeText(
    page,
    'YouTube, AnimePahe, Cineby, Miruro, and generic pages load locally'
  )
  await waitForRuntimeText(page, 'Browser sync receipt')
  await waitForRuntimeText(page, 'Happy sync sealed')
  await waitForRuntimeText(
    page,
    `all ${STREAMING_SITE_BROWSER_PAIR_E2E_PATH_COUNT} website paths are ready`
  )
  await page.waitForSelector(
    '#runtime_happy_path_assurance[data-happy-path-state="ready"][data-byte-loss-rate="0"]' +
      '[data-lost-control-bytes="0"][data-dropped-control-messages="0"]' +
      '[data-live-control-receipt-state="ready"]' +
      '[data-reordered-control-messages="0"][data-sequence-gap-control-messages="0"]' +
      '[data-missing-directional-deliveries="0"]' +
      '[data-connection-checklist="invite-secret-join-transport-heartbeat-queue-controls-next"]' +
      '[data-connection-flow="invite-join-queue-controls-next"]' +
      `[data-site-lane-count="${STREAMING_SITE_BROWSER_PAIR_E2E_LANE_COUNT}"]` +
      `[data-site-path-count="${STREAMING_SITE_BROWSER_PAIR_E2E_PATH_COUNT}"]`
  )
  await waitForRuntimeText(page, 'Happy path assurance')
  await waitForRuntimeText(
    page,
    'Invite, join, source, controls, next, and zero dropped or reordered controls are glowing green'
  )
  await page.waitForSelector(
    '#runtime_site_matrix_receipt[data-byte-loss-rate="0"]' +
      '[data-lost-control-bytes="0"][data-dropped-control-messages="0"]' +
      '[data-reordered-control-messages="0"][data-sequence-gap-control-messages="0"]' +
      '[data-missing-directional-deliveries="0"]' +
      '[data-tail-latency-ms-budget="10"]' +
      `[data-source-path-count="${STREAMING_SITE_BROWSER_PAIR_E2E_PATH_COUNT}"]` +
      `[data-control-burst-lanes="${STREAMING_SITE_BROWSER_PAIR_E2E_LANE_COUNT}"]`
  )
  await waitForRuntimeText(page, 'Site matrix receipt')
  await waitForRuntimeText(page, 'YouTube routes checked')
  await waitForRuntimeText(page, 'Any-site routes checked')
  await waitForRuntimeText(page, 'One burst per lane')
  await waitForRuntimeText(page, 'preview as local website lanes before queueing')
  await waitForRuntimeText(page, 'pause, resume, seek, rate, and next control burst with 0B lost')
  await waitForRuntimeText(page, 'Invite to sync')
  await waitForRuntimeText(
    page,
    'Private secret, rabbit join, connected transport, and heartbeat clock check must all turn green'
  )
  await waitForRuntimeText(page, 'YouTube to any site')
  await waitForRuntimeText(
    page,
    'YouTube watch, shorts, live, mobile, music, nocookie, and generic watch pages stay in the'
  )
  await waitForRuntimeText(page, 'YouTube to every site hop')
  await waitForRuntimeText(
    page,
    'One connected room tests a YouTube start, AnimePahe, Cineby, Miruro, a generic website next, both-seat controls, and zero lost bytes before merge'
  )
  await waitForRuntimeText(page, '0B loss lane')
  await waitForRuntimeText(page, 'Every control burst must keep 0B lost, 0 dropped, 0 skipped')
  await waitForRuntimeText(page, 'Happy handoff')
  await waitForRuntimeText(
    page,
    'Queue, pause, resume, seek, rate, and next are exercised from both seats before merge'
  )
  await waitForRuntimeText(page, 'Two browsers synced')
  await waitForRuntimeText(page, 'Two browsers, one cozy lane')
  await waitForRuntimeText(page, '0B control loss')
  await waitForRuntimeText(page, 'YouTube plus any-site matrix')
  await waitForRuntimeText(
    page,
    `${STREAMING_SITE_BROWSER_PAIR_E2E_PATH_COUNT} two-browser transport paths`
  )
  await waitForRuntimeText(page, 'Media bytes stay local')
  await waitForRuntimeText(page, 'Flawless handoff')
  await waitForRuntimeText(
    page,
    'Invite, join, queue, pause, resume, seek, rate, and next all stay on the zero-loss happy path.'
  )
}

function isConnectionAlert(message: string): boolean {
  return /connection|invite secret|join|lobby|network|peer|protocol|sync|transport|webrtc/i.test(
    message
  )
}

async function expectNoRuntimeConnectionAlerts(page: Page): Promise<void> {
  const alertMessages = await page.$$eval('[data-system-event-tone="alert"]', nodes =>
    nodes.map(node => node.textContent || '')
  )
  const connectionAlerts = alertMessages.filter(isConnectionAlert)
  expect(connectionAlerts).toEqual([])
}

async function waitForAttachedSelector(page: Page, selector: string, label: string): Promise<void> {
  try {
    await waitForPageStringCondition(
      page,
      expectedSelector => Boolean(document.querySelector(expectedSelector)),
      selector,
      RUNTIME_TEXT_TIMEOUT_MS,
      label
    )
  } catch (error) {
    if (!isTimeoutError(error)) throw error
    throw new Error(
      `Timed out waiting for ${label}. Selector: ${selector}. ` +
        `Visible text excerpt: ${await getBodyTextExcerpt(page)}`
    )
  }
}

async function expectConnectionRunwayReady(page: Page): Promise<void> {
  await waitForAttachedSelector(
    page,
    '#runtime_connection_runway[data-transport-status="connected"]' +
      '[data-guest-seat-state="present"][data-invite-secret-state="present"]' +
      '[data-connection-checklist="invite-secret-join-transport-heartbeat-queue-controls-next"]' +
      '[data-byte-loss-rate="0"][data-tail-latency-ms-budget="10"]' +
      '[data-lost-control-bytes="0"][data-dropped-control-messages="0"]' +
      '[data-reordered-control-messages="0"][data-sequence-gap-control-messages="0"]' +
      '[data-missing-directional-deliveries="0"]' +
      '[data-best-round-trip-ms="2"]',
    'connected runway'
  )
  await waitForRuntimeText(page, 'Buddy connection runway')
  await waitForRuntimeText(page, 'Invite secret sealed')
  await waitForRuntimeText(page, 'Control lane connected')
  await waitForRuntimeText(page, 'Both seats synced')
  await waitForRuntimeText(page, 'zero control bytes lost')
}

async function expectLiveControlReceiptReady(page: Page, label: string): Promise<void> {
  try {
    await waitForAttachedSelector(page, LIVE_CONTROL_RECEIPT_READY_SELECTOR, label)
  } catch (error) {
    if (!isTimeoutError(error)) throw error
    const receiptState = await page.$eval('#runtime_live_control_receipt', element =>
      Array.from(element.attributes)
        .map(attribute => `${attribute.name}=${attribute.value}`)
        .join(' ')
    )
    throw new Error(`${formatErrorMessage(error)} Live receipt: ${receiptState}`)
  }
  await waitForRuntimeText(page, 'Live control receipt')
  await waitForRuntimeText(
    page,
    `sent and received real typed control frames under the ${LIVE_CONTROL_LATENCY_BUDGET_MS}ms live latency and frame-size budgets`
  )
  await waitForRuntimeText(page, 'Different browser processes')
  await waitForRuntimeText(page, 'Both seats sent + received')
  await waitForRuntimeText(page, 'Pair bytes reconcile')
  await waitForRuntimeText(page, 'Live controls stay light')
  await waitForRuntimeText(
    page,
    `${LIVE_BROWSER_PROCESS_COUNT} isolated browser processes run the same private room before the e2e gate turns green`
  )
  await waitForRuntimeText(
    page,
    `Action P95 stays <=${LIVE_CONTROL_ACTION_P95_BUDGET_MS}ms, frames stay <=${LIVE_CONTROL_FRAME_BUDGET_BYTES}B`
  )
}

async function expectHealthyTwoBrowserConnection(input: {
  readonly clientPage: Page
  readonly hostPage: Page
}): Promise<void> {
  await waitForAttachedSelector(
    input.hostPage,
    '[data-session-state-tone="synced"]',
    'host sync tone'
  )
  await waitForAttachedSelector(
    input.clientPage,
    '[data-session-state-tone="synced"]',
    'client sync tone'
  )
  await expectConnectionRunwayReady(input.hostPage)
  await expectConnectionRunwayReady(input.clientPage)
  await waitForAttachedSelector(
    input.clientPage,
    '#runtime_connection_runway[data-clock-sync-state="synced"]',
    'client clock sync'
  )
  await waitForAttachedSelector(
    input.hostPage,
    '#runtime_playback_controls [data-intent="positionMs"][data-sync-confident="yes"]',
    'host playback sync confidence'
  )
  await waitForAttachedSelector(
    input.clientPage,
    '#runtime_playback_controls [data-intent="positionMs"][data-sync-confident="yes"]',
    'client playback sync confidence'
  )
  await waitForAttachedSelector(input.hostPage, BROWSER_SYNC_RECEIPT_READY_SELECTOR, 'host receipt')
  await waitForAttachedSelector(
    input.clientPage,
    BROWSER_SYNC_RECEIPT_READY_SELECTOR,
    'client receipt'
  )
  await waitForAttachedSelector(input.hostPage, HAPPY_SYNC_SEAL_READY_SELECTOR, 'host sync seal')
  await waitForAttachedSelector(
    input.clientPage,
    HAPPY_SYNC_SEAL_READY_SELECTOR,
    'client sync seal'
  )
  await expectLiveControlReceiptReady(input.hostPage, 'host live control receipt')
  await expectLiveControlReceiptReady(input.clientPage, 'client live control receipt')
  await waitForStreamingMergeProof(input.hostPage)
  await waitForStreamingMergeProof(input.clientPage)
  await expectNoRuntimeConnectionAlerts(input.hostPage)
  await expectNoRuntimeConnectionAlerts(input.clientPage)
}

async function expectTwoBrowserConnectionStillHealthy(input: {
  readonly clientPage: Page
  readonly hostPage: Page
}): Promise<void> {
  await waitForAttachedSelector(
    input.hostPage,
    '[data-session-state-tone="synced"]',
    'host sync tone'
  )
  await waitForAttachedSelector(
    input.clientPage,
    '[data-session-state-tone="synced"]',
    'client sync tone'
  )
  await waitForAttachedSelector(
    input.hostPage,
    '#runtime_playback_controls [data-intent="positionMs"][data-sync-confident="yes"]',
    'host playback sync confidence'
  )
  await waitForAttachedSelector(
    input.clientPage,
    '#runtime_playback_controls [data-intent="positionMs"][data-sync-confident="yes"]',
    'client playback sync confidence'
  )
  await expectNoRuntimeConnectionAlerts(input.hostPage)
  await expectNoRuntimeConnectionAlerts(input.clientPage)
}

function expectLiveBrowserIsolation(input: {
  readonly clientBrowser: Browser | undefined
  readonly clientPage: Page
  readonly hostPage: Page
}): void {
  if (USE_BROADCAST_RTC_E2E) return

  expect(input.clientBrowser).toBeDefined()
  expect(input.clientBrowser).not.toBe(browser)
  expect(input.clientPage.context()).not.toBe(input.hostPage.context())
  const hostBrowserProcessId = getBrowserProcessId(browser)
  const clientBrowserProcessId = getBrowserProcessId(input.clientBrowser)
  if (
    typeof hostBrowserProcessId === 'number' &&
    typeof clientBrowserProcessId === 'number'
  ) {
    expect(clientBrowserProcessId).not.toBe(hostBrowserProcessId)
  }
}

function isTimeoutError(error: unknown): boolean {
  if (error instanceof Error) {
    return /timeout|timed out/i.test(error.message)
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return /timeout|timed out/i.test(String((error as { readonly message?: unknown }).message))
  }

  return false
}

function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { readonly message?: unknown }).message)
  }

  return String(error)
}

async function getBodyTextExcerpt(page: Page): Promise<string> {
  let bodyText = ''
  try {
    bodyText = await page.evaluate(() =>
      document.body && document.body.textContent ? document.body.textContent : ''
    )
  } catch (error) {
    bodyText = `page text unavailable: ${formatErrorMessage(error)}`
  }

  return bodyText
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 800)
}

async function clickPlayPauseAndWaitForState(
  page: Page,
  state: 'playing' | 'paused'
): Promise<void> {
  let lastTimeout: Error | undefined
  for (let attempt = 0; attempt < PLAYBACK_STATE_RETRY_COUNT; attempt += 1) {
    if ((await getRuntimePlaybackState(page)) === state) {
      return
    }

    await page.waitForSelector(`${PLAYBACK_PLAY_PAUSE_SELECTOR}:not([disabled])`)
    await page.click(PLAYBACK_PLAY_PAUSE_SELECTOR)
    try {
      await waitForPlaybackState(page, state, PLAYBACK_STATE_RETRY_TIMEOUT_MS)
      return
    } catch (error) {
      if (!isTimeoutError(error) || !(error instanceof Error)) throw error
      if ((await getRuntimePlaybackState(page)) === state) {
        return
      }
      lastTimeout = error
    }
  }

  throw lastTimeout || new Error(`Playback did not become ${state}.`)
}

async function clickAvailableRateControlAndWaitForSync(input: {
  readonly clientPage: Page
  readonly controlPage: Page
  readonly hostPage: Page
  readonly label: string
  readonly runLiveControlAction?: LiveControlActionRunner
}): Promise<void> {
  const rateUpSelector = '#runtime_playback_controls [data-intent="rateUp"]:not([disabled])'
  const rateDownSelector = '#runtime_playback_controls [data-intent="rateDown"]:not([disabled])'
  const rateUpHandle = await input.controlPage.$(rateUpSelector)
  const controlSelector = rateUpHandle ? rateUpSelector : rateDownSelector
  if (rateUpHandle) {
    await rateUpHandle.dispose()
  }

  await input.controlPage.waitForSelector(controlSelector)
  const previousRateLabel = await getPlaybackRateLabel(input.controlPage)
  if (input.runLiveControlAction) {
    await input.runLiveControlAction(`${input.label} rate control`, () =>
      input.controlPage.click(controlSelector)
    )
  } else {
    await input.controlPage.click(controlSelector)
  }
  const expectedRateLabel = await waitForPlaybackRateLabelChange(
    input.controlPage,
    previousRateLabel
  )
  await waitForPlaybackRateLabel(input.hostPage, expectedRateLabel)
  await waitForPlaybackRateLabel(input.clientPage, expectedRateLabel)
  await expectPlaybackPositionsSynced({
    clientPage: input.clientPage,
    hostPage: input.hostPage,
    label: `${input.label} rate control`
  })
}

async function exerciseTwoBrowserPlaybackControls(input: {
  readonly clientPage: Page
  readonly controlPage: Page
  readonly hostPage: Page
  readonly label: string
  readonly runLiveControlAction?: LiveControlActionRunner
}): Promise<void> {
  if (input.runLiveControlAction) {
    await input.runLiveControlAction(`${input.label} pause control`, () =>
      clickPlayPauseAndWaitForState(input.controlPage, 'paused')
    )
  } else {
    await clickPlayPauseAndWaitForState(input.controlPage, 'paused')
  }
  await waitForPlaybackState(input.hostPage, 'paused')
  await waitForPlaybackState(input.clientPage, 'paused')
  await expectPlaybackPositionsSynced({
    clientPage: input.clientPage,
    hostPage: input.hostPage,
    label: `${input.label} pause control`
  })

  if (input.runLiveControlAction) {
    await input.runLiveControlAction(`${input.label} resume control`, () =>
      clickPlayPauseAndWaitForState(input.controlPage, 'playing')
    )
  } else {
    await clickPlayPauseAndWaitForState(input.controlPage, 'playing')
  }
  await waitForPlaybackState(input.hostPage, 'playing')
  await waitForPlaybackState(input.clientPage, 'playing')
  await expectPlaybackPositionsSynced({
    clientPage: input.clientPage,
    hostPage: input.hostPage,
    label: `${input.label} resume control`
  })

  await clickAvailableRateControlAndWaitForSync(input)

  const expectedSeekPositionMs =
    (await getPlaybackPositionMs(input.controlPage)) + SEEK_FORWARD_STEP_MS
  if (input.runLiveControlAction) {
    await input.runLiveControlAction(`${input.label} seek control`, () =>
      input.controlPage.click('#runtime_playback_controls [data-intent="seekForward"]')
    )
  } else {
    await input.controlPage.click('#runtime_playback_controls [data-intent="seekForward"]')
  }
  await waitForPlaybackPositionAtLeast(
    input.hostPage,
    expectedSeekPositionMs,
    `${input.label} host seek`
  )
  await waitForPlaybackPositionAtLeast(
    input.clientPage,
    expectedSeekPositionMs,
    `${input.label} client seek`
  )
  await expectPlaybackPositionsSynced({
    clientPage: input.clientPage,
    hostPage: input.hostPage,
    label: `${input.label} seek control`
  })
}

const toSafeE2ERelayRoomLabel = (label: string): string =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

function createE2ERelayRoomId(roomId: string, label: string): string {
  e2eRelayRoomCounter += 1
  return `${roomId}:${e2eRelayRoomCounter}:${toSafeE2ERelayRoomLabel(label)}`
}

function appendRuntimeQueryParam(path: string, name: string, value: string): string {
  const separator = path.indexOf('?') === -1 ? '?' : '&'
  return `${path}${separator}${encodeURIComponent(name)}=${encodeURIComponent(value)}`
}

async function visitRuntimePath(
  page: Page,
  path: string,
  options?: { readonly e2eRelayRoomId?: string }
): Promise<void> {
  runtimeVisitCounter += 1
  const pathWithRelayRoom =
    options && options.e2eRelayRoomId
      ? appendRuntimeQueryParam(path, '__e2eRelayRoom', options.e2eRelayRoomId)
      : path
  const separator = pathWithRelayRoom.indexOf('?') === -1 ? '?' : '&'
  try {
    await gotoWithBoundedNavigation(
      page,
      `${getAppBaseUrl()}/#${pathWithRelayRoom}${separator}__e2eVisit=${runtimeVisitCounter}`,
      RUNTIME_TEXT_TIMEOUT_MS
    )
  } catch (error) {
    if (!isTimeoutError(error)) throw error
  }
}

async function unloadRuntimePage(page: Page, label: string): Promise<void> {
  try {
    await gotoWithBoundedNavigation(page, 'about:blank', RUNTIME_TEXT_TIMEOUT_MS)
  } catch (error) {
    console.warn(`${label} unload failed:`, formatErrorMessage(error))
  }
}

describe('session', () => {
  const hostId = ms.useProfile()

  describe('host', () => {
    beforeEach(async () => {
      await ms.setProfile('default', page)
    })

    afterEach(async () => {
      await unloadRuntimePage(page, 'host page')
    })

    it('should start a session', async () => {
      await ms.visit(`/join/${hostId}`)
      await waitForRuntimeShell(page, 'host start')
      await page.waitForSelector('#runtime_happy_path')
      await page.waitForSelector('#runtime_buddy_scene')
      await page.waitForSelector('#runtime_room_signals')
      await page.waitForSelector('#runtime_connection_lab_proof')
      await page.waitForSelector('#runtime_merge_gate')
      await page.waitForSelector('#runtime_room_mood')
      await page.waitForSelector('#runtime_cozy_command_bar')
      await page.waitForSelector('#runtime_connection_runway[data-guest-seat-state="waiting"]')
      await page.waitForSelector('#runtime_browser_sync_receipt[data-receipt-state="warming"]')
      await page.waitForSelector('#runtime_readiness_meter')
      await page.waitForSelector('#runtime_pair_guide')
      await page.waitForSelector('[data-streaming-proof="byte-loss"][data-byte-loss-rate="0"]')
      await page.waitForSelector(
        `#runtime_connection_lab_proof[data-site-count="${STREAMING_SITE_CONNECTION_FIXTURE_COUNT}"]` +
          '[data-trial-count="3"]'
      )
      await page.waitForSelector(
        '#runtime_merge_gate[data-zero-loss-required="true"]' +
          `[data-provider-count="${STREAMING_SITE_NAMED_PROVIDER_COUNT}"]` +
          '[data-queue-byte-cap="262144"][data-trace-cap="64"]'
      )
      await page.waitForSelector(CONNECTION_CONFIDENCE_SELECTOR)
      await page.waitForSelector('[data-merge-gate-metric="byte-loss"][data-merge-gate-value="0%"]')
      await page.waitForSelector('#runtime_launchpad')
      await page.waitForSelector('#runtime_concierge_strip')
      await page.waitForSelector('#runtime_buddy_passport')
      await page.waitForSelector('#runtime_watch_deck')
      await page.waitForSelector('#runtime_site_handoff')
      await page.waitForSelector('[data-session-state-tone="waiting"]')
      await waitForRuntimeText(page, 'Cozy watch room')
      await waitForRuntimeText(page, 'Cat checks the source')
      await waitForRuntimeText(page, 'Rabbit gets one hop')
      await waitForRuntimeText(page, 'Tiny sync lane')
      await waitForRuntimeText(page, 'Hosting the watch party')
      await waitForRuntimeText(page, '0 control bytes lost')
      await waitForRuntimeText(page, `${STREAMING_SITE_CONNECTION_FIXTURE_COUNT} local fixtures`)
      await waitForRuntimeText(page, 'Recovered retries counted')
      await waitForRuntimeText(page, 'Cat-side cue')
      await waitForRuntimeText(page, 'Best next tap')
      await waitForRuntimeText(page, 'Buddy connection runway')
      await waitForRuntimeText(page, 'Invite secret sealed')
      await waitForRuntimeText(page, 'Rabbit seat waiting')
      await waitForRuntimeText(page, 'Heartbeat warming')
      await waitForRuntimeText(page, '0/4 ready')
      await waitForRuntimeText(page, 'Source')
      await waitForRuntimeText(page, 'Invite')
      await waitForRuntimeText(page, 'Buddy')
      await waitForRuntimeText(page, 'Paste source')
      await waitForRuntimeText(page, 'Invite link')
      await waitForRuntimeText(page, 'Pair guide')
      await waitForRuntimeText(page, 'Cat cue')
      await waitForRuntimeText(page, 'Rabbit cue')
      await waitForRuntimeText(page, 'Together cue')
      await waitForRuntimeText(page, 'Press play when both seats feel ready')
      await waitForRuntimeText(page, 'Room feels ready when')
      await waitForRuntimeText(page, 'Connection lab proof')
      await waitForRuntimeText(page, 'Ultra-low latency lane wins')
      await waitForRuntimeText(page, 'Retry lane stays green')
      await waitForRuntimeText(page, 'Site matrix covered')
      for (const providerCoverageLabel of STREAMING_SITE_PROVIDER_COVERAGE_LABELS) {
        await waitForRuntimeText(page, providerCoverageLabel)
      }
      await waitForRuntimeText(page, 'every named provider keeps at least two fixtures')
      await waitForRuntimeText(page, 'Bursts stay calm')
      await waitForRuntimeText(page, 'Rapid seek, pause, resume, and rate bursts')
      await waitForRuntimeText(page, '7 lanes run for 3 deterministic trials')
      await waitForRuntimeText(page, 'Streaming merge gate')
      await waitForRuntimeText(page, 'Zero-loss required')
      await waitForRuntimeText(page, 'Byte loss gate')
      await waitForRuntimeText(page, 'deliver every control byte before latency ranking')
      await waitForRuntimeText(page, 'Order gate')
      await waitForRuntimeText(page, 'skipped or reordered controls')
      await waitForRuntimeText(page, 'Tail latency gate')
      await waitForRuntimeText(page, '<=10ms P95')
      await waitForRuntimeText(page, 'Balance gate')
      await waitForRuntimeText(page, '<=4ms skew')
      await waitForRuntimeText(page, 'Payload gate')
      await waitForRuntimeText(page, '<=2048B')
      await waitForRuntimeText(page, 'Queue byte gate')
      await waitForRuntimeText(page, '<=262144B')
      await waitForRuntimeText(page, 'fast paths cannot hide byte-pressure buffering')
      await waitForRuntimeText(page, 'Retry byte gate')
      await waitForRuntimeText(page, 'Coverage gate')
      await waitForRuntimeText(page, `${STREAMING_SITE_CONNECTION_FIXTURE_COUNT} sites`)
      await waitForRuntimeText(page, 'Provider gate')
      await waitForRuntimeText(page, '4 providers')
      await waitForRuntimeText(page, 'Buddy e2e gate')
      await waitForRuntimeText(page, `${STREAMING_SITE_BROWSER_PAIR_E2E_PATH_COUNT} browser paths`)
      await waitForRuntimeText(
        page,
        `Transport reliability covers ${STREAMING_SITE_BROWSER_PAIR_E2E_PATH_COUNT} paths`
      )
      await waitForRuntimeText(
        page,
        'dual-browser e2e queues every browser path'
      )
      await waitForRuntimeText(page, 'Connection confidence')
      await waitForRuntimeText(page, 'Secret handshake')
      await waitForRuntimeText(page, 'Two isolated browsers')
      await waitForRuntimeText(page, 'Zero-loss controls')
      await waitForRuntimeText(page, 'Under-10ms tail')
      await waitForRuntimeText(page, 'Local website load')
      await waitForRuntimeText(page, 'Two-browser gate')
      await waitForRuntimeText(page, 'isolated live mode')
      await waitForRuntimeText(
        page,
        'Live e2e mode runs cat-side and rabbit-side in separate browser processes through the real connection flow'
      )
      await waitForRuntimeText(page, 'Browser sync receipt')
      await waitForRuntimeText(page, 'Happy sync warming')
      await waitForRuntimeText(page, 'Live control receipt')
      await waitForRuntimeText(
        page,
        'Waiting for this browser seat to send and receive real typed control frames'
      )
      await waitForRuntimeText(
        page,
        `all ${STREAMING_SITE_BROWSER_PAIR_E2E_PATH_COUNT} website paths`
      )
      await waitForRuntimeText(page, 'Waiting for two seats')
      await waitForRuntimeText(page, 'Two browsers, one cozy lane')
      await waitForRuntimeText(page, '0B control loss')
      await waitForRuntimeText(page, 'YouTube plus any-site matrix')
      await waitForRuntimeText(
        page,
        `${STREAMING_SITE_BROWSER_PAIR_E2E_PATH_COUNT} two-browser transport paths`
      )
      await waitForRuntimeText(page, 'Media bytes stay local')
      await waitForRuntimeText(page, 'Trace gate')
      await waitForRuntimeText(page, '64 recent frames')
      await waitForRuntimeText(page, 'bounded sent, received, state, and error observations')
      await waitForRuntimeText(page, 'Tonight launchpad')
      await waitForRuntimeText(page, 'Next best move')
      await waitForRuntimeText(page, 'Buddy passport')
      await waitForRuntimeText(page, 'Rabbit seat saved')
      await waitForRuntimeText(page, 'Same source, local load')
      await waitForRuntimeText(page, 'Next tap stays visible')
      await waitForRuntimeText(page, 'Sync check')
      await waitForRuntimeText(page, 'Pick the first source')
      await waitForRuntimeText(page, 'Press play when ready')
      await waitForRuntimeText(page, 'Controls obvious')
      await waitForRuntimeText(page, 'Website lane')
      await waitForRuntimeText(page, 'URL Safety Results')
      await waitForRuntimeText(page, 'streaming connection lab')
      await waitForRuntimeText(page, 'zero-loss, under-10ms mock round trip')
      await waitForRuntimeText(page, 'visible recovered retries')
      await waitForRuntimeText(page, 'no skipped controls')
      await waitForRuntimeText(page, 'syncs only the tiny control stream')
      await waitForRuntimeText(page, 'typed commands')
      await waitForRuntimeText(page, 'Low-latency control lane')
      await waitForRuntimeText(page, 'Heartbeat clock check warms up after rabbit joins')
      await waitForRuntimeText(page, 'Zero video-byte sharing')
      await waitForRuntimeText(page, 'Website opens locally')
      await waitForRuntimeText(page, 'Popup fallback ready')
      await waitForRuntimeText(page, 'Only controls sync')
      await waitForRuntimeText(page, 'Jitter-guarded frames')
      await waitForRuntimeText(page, '262144B queue cap')
      await waitForRuntimeText(page, 'Reliable retry guard')
      await waitForRuntimeText(page, 'Observable trace cap')
      await waitForRuntimeText(page, 'Merge-ready e2e')
      await waitForRuntimeText(page, 'Happy sync glow')
      await waitForRuntimeText(page, 'Happy handoff checklist')
      await waitForRuntimeText(page, '2ms best mock RT')
      await waitForRuntimeText(page, '10ms lab round trip')
      await waitForRuntimeText(page, 'No skipped controls')
      await waitForRuntimeText(page, 'Pick the next cozy stream')
      await waitForRuntimeText(page, 'Copy the full invite link first')
      await waitForRuntimeText(page, 'Sync controls')
      await waitForRuntimeText(page, 'Queue a source first')
      await waitForRuntimeText(page, 'Recovered drops stay ordered')
      await waitForRuntimeText(page, 'recovered retries for transient control drops')
      await ms.screenshot('session_host')
    })

    it('should preview supported streaming-site source suggestions', async () => {
      await ms.visit(`/join/${hostId}`)
      await waitForRuntimeShell(page, 'source suggestions')

      const suggestions = [
        {
          id: 'youtube',
          label: 'YouTube',
          guidance: 'YouTube is covered by the low-latency streaming-site mock tests'
        },
        {
          id: 'animepahe',
          label: 'AnimePahe',
          guidance: 'AnimePahe is covered by the low-latency streaming-site mock tests'
        },
        {
          id: 'cineby',
          label: 'Cineby',
          guidance: 'Cineby is covered by the low-latency streaming-site mock tests'
        },
        {
          id: 'miruro',
          label: 'Miruro',
          guidance: 'Miruro is covered by the low-latency streaming-site mock tests'
        },
        {
          id: 'website',
          label: 'Any website',
          guidance:
            'Generic website lanes are covered by the mock matrix too; use the exact page both seats can test together.'
        }
      ]

      for (const suggestion of suggestions) {
        await page.click(`[data-source-suggestion="${suggestion.id}"]`)
        await waitForRuntimeText(page, `${suggestion.label} lane`)
        await waitForRuntimeText(page, suggestion.guidance)
      }
    })

    it('should preview named streaming-site watch URLs without remote navigation', async () => {
      await ms.visit(`/join/${hostId}`)
      await waitForRuntimeShell(page, 'named streaming-site preview')
      await page.waitForSelector('#runtime-add-media-url')

      const sources = [
        { url: 'youtube.com', label: 'YouTube', provider: 'youtube' },
        {
          url: 'youtube.com/watch?v=honeystream-e2e',
          label: 'YouTube',
          provider: 'youtube'
        },
        {
          url: 'youtu.be/honeystream-e2e',
          label: 'YouTube',
          provider: 'youtube'
        },
        {
          url: 'youtube.com:443/watch?v=honeystream-e2e',
          label: 'YouTube',
          provider: 'youtube'
        },
        { url: 'animepahe.ru', label: 'AnimePahe', provider: 'animepahe' },
        {
          url: 'animepahe.ru/play/honeystream-e2e',
          label: 'AnimePahe',
          provider: 'animepahe'
        },
        { url: 'cineby.app', label: 'Cineby', provider: 'cineby' },
        { url: 'cineby.app/movie/honeystream-e2e', label: 'Cineby', provider: 'cineby' },
        { url: 'miruro.to', label: 'Miruro', provider: 'miruro' },
        { url: 'miruro.to/watch/honeystream-e2e', label: 'Miruro', provider: 'miruro' }
      ]

      for (const source of sources) {
        await page.fill('#runtime-add-media-url', source.url)
        await page.waitForSelector(
          `[data-add-media-source-preview="website"][data-add-media-provider="${source.provider}"]`
        )
        await waitForRuntimeText(page, `${source.label} lane`)
        await waitForRuntimeText(page, `${source.label} page detected`)
        await waitForRuntimeText(
          page,
          `${source.label} is covered by the low-latency streaming-site mock tests`
        )
        await waitForRuntimeText(page, 'Honeystream will add https:// automatically')
      }
      await page.fill('#runtime-add-media-url', '')
    })

    it('should preview every browser-pair source URL without remote navigation', async () => {
      await ms.visit(`/join/${hostId}`)
      await waitForRuntimeShell(page, 'browser-pair source matrix preview')
      await page.waitForSelector('#runtime-add-media-url')
      await page.waitForSelector(
        `#runtime_site_matrix_receipt[data-source-path-count="${STREAMING_SITE_BROWSER_PAIR_E2E_PATH_COUNT}"]` +
          `[data-control-burst-lanes="${STREAMING_SITE_BROWSER_PAIR_E2E_LANE_COUNT}"]`
      )

      for (const source of STREAMING_SITE_BROWSER_PAIR_E2E_SOURCES) {
        await page.fill('#runtime-add-media-url', source.url)
        await page.waitForSelector(
          `[data-add-media-source-preview="website"][data-add-media-provider="${getBrowserPairPreviewProvider(
            source
          )}"]`
        )
        const previewText = await page.$eval(
          '[data-add-media-source-preview="website"]',
          element => element.textContent || ''
        )
        expect(previewText).toContain(getBrowserPairPreviewLabel(source))
        expect(previewText).toContain('Each browser opens')
        expect(previewText).toContain('controls stay synced')
        expect(previewText).toContain('Honeystream will add https:// automatically')
      }

      await page.fill('#runtime-add-media-url', '')
    })

    it('should queue shorthand streaming URLs with automatic https', async () => {
      await ms.visit(`/join/${hostId}`)
      await waitForRuntimeShell(page, 'shorthand streaming URLs')

      const sources = [
        {
          url: 'youtube.com/watch?v=honeystream-demo',
          title: 'YouTube watch page',
          adapterKind: 'embed-extension'
        },
        {
          url: 'animepahe.ru/play/honeystream-demo',
          title: 'AnimePahe watch page',
          adapterKind: 'popup'
        },
        {
          url: 'cineby.app/movie/honeystream-demo',
          title: 'Cineby watch page',
          adapterKind: 'popup'
        },
        {
          url: 'miruro.to/watch/honeystream-demo',
          title: 'Miruro watch page',
          adapterKind: 'popup'
        }
      ]

      for (let index = 0; index < sources.length; index += 1) {
        const source = sources[index]
        await page.fill('#runtime-add-media-url', source.url)
        await waitForRuntimeText(page, 'Honeystream will add https:// automatically')
        await page.press('#runtime-add-media-url', 'Enter')

        await waitForRuntimeText(page, 'Media added with https:// filled in')
        await waitForRuntimeText(page, 'Website loaded')
        await waitForRuntimeText(page, source.title)
        if (index === 0) {
          await page.waitForSelector(`[data-playback-adapter-kind="${source.adapterKind}"]`)
        }
      }
    })

    it('should queue the initial room URL from the landing launcher', async () => {
      await ms.visit(`/join/${hostId}?url=${encodeURIComponent('youtube.com/watch?v=home-launch')}`)
      await waitForRuntimeShell(page, 'landing launcher URL')

      await waitForRuntimeText(page, 'Website loaded')
      await waitForRuntimeText(page, 'watch')
      await waitForRuntimeText(page, 'Source is ready')
    })

    it('should not join invalid session', async () => {
      const guestContext = await browser.newContext()
      const guestPage = await guestContext.newPage()

      try {
        await ms.setProfile('default', guestPage)
        await visitRuntimePath(guestPage, '/join/deadbeafdeadbeafdeadbeafdeadbeaf?secret=bad')
        await waitForRuntimeShell(guestPage, 'invalid invite guest')
        await waitForRuntimeText(guestPage, 'Invite secret is invalid')
      } finally {
        await closeBrowserResource('invalid invite page', guestPage)
        await closeBrowserResource('invalid invite context', guestContext)
      }
    })
  })

  describe('p2p: host + client', () => {
    let clientBrowser: Browser | undefined
    let clientContext: BrowserContext | undefined
    let clientPage: Page
    let shouldCloseClientContext = false

    beforeAll(async () => {
      if (!USE_BROADCAST_RTC_E2E) {
        clientBrowser = await chromium.launch(playwrightConfig.launchBrowserApp || {})
      }
    })

    beforeEach(async () => {
      shouldCloseClientContext = !USE_BROADCAST_RTC_E2E
      if (shouldCloseClientContext) {
        if (!clientBrowser) {
          clientBrowser = await chromium.launch(playwrightConfig.launchBrowserApp || {})
        }
        clientContext = await clientBrowser.newContext(playwrightConfig.context || {})
      } else {
        clientContext = context
      }
      clientPage = await clientContext.newPage()
      await ms.setProfile('default', page)
    })

    afterEach(async () => {
      try {
        await closeBrowserResource('client page', clientPage)
      } finally {
        try {
          if (clientContext && shouldCloseClientContext) {
            await closeBrowserResource('client context', clientContext)
          }
        } finally {
          await unloadRuntimePage(page, 'host page')
        }
      }
    })

    afterAll(async () => {
      await closeBrowserForE2E(clientBrowser)
      clientBrowser = undefined
    })

    it(
      'should require the private invite secret for clients',
      async () => {
        const e2eRelayRoomId = createE2ERelayRoomId(hostId, 'missing-secret')
        await visitRuntimePath(page, `/join/${hostId}`, { e2eRelayRoomId })
        const hostPage = page
        await waitForRuntimeShell(hostPage, 'missing-secret host')

        await ms.setProfile('clientA', clientPage)
        await visitRuntimePath(clientPage, `/join/${hostId}`, { e2eRelayRoomId })
        await waitForRuntimeShell(clientPage, 'missing-secret client')
        await waitForRuntimeText(clientPage, 'Invite secret is required')

        await ms.screenshot('session_host+client')
      },
      SESSION_E2E_TIMEOUT_MS
    )

    it('should mirror guest and host queued media and playback controls', async () => {
      const e2eRelayRoomId = createE2ERelayRoomId(hostId, 'mirror')
      await visitRuntimePath(page, `/join/${hostId}`, { e2eRelayRoomId })
      const hostPage = page
      await waitForRuntimeShell(hostPage, 'mirror host')
      const inviteSecret = await getRuntimeInviteSecret(hostPage)

      await ms.setProfile('clientA', clientPage)
      await visitRuntimePath(
        clientPage,
        `/join/${hostId}?secret=${encodeURIComponent(inviteSecret)}`,
        { e2eRelayRoomId }
      )
      await waitForRuntimeShell(clientPage, 'mirror client')
      await waitForRuntimeText(hostPage, 'Synced')
      await waitForRuntimeText(clientPage, 'Synced')
      expectLiveBrowserIsolation({ clientBrowser, clientPage, hostPage })
      await expectHealthyTwoBrowserConnection({
        clientPage,
        hostPage
      })
      const runLiveControlAction = createLiveControlActionRunner({ clientPage, hostPage })

      await runLiveControlAction('guest queued YouTube', () =>
        addRuntimeMediaUrl(clientPage, 'youtube.com/watch?v=guest-e2e')
      )

      await waitForRuntimeText(clientPage, 'Media added with https:// filled in')
      await waitForRuntimeText(hostPage, 'Website loaded')
      await waitForRuntimeText(clientPage, 'Website loaded')
      await waitForRuntimeText(hostPage, 'YouTube watch page')
      await waitForRuntimeText(clientPage, 'YouTube watch page')
      await waitForCurrentQueueTitle(hostPage, 'YouTube watch page')
      await waitForCurrentQueueTitle(clientPage, 'YouTube watch page')
      await hostPage.waitForSelector(
        '#runtime_playback_controls [data-intent="playPause"]:not([disabled])'
      )
      await clientPage.waitForSelector(
        '#runtime_playback_controls [data-intent="playPause"]:not([disabled])'
      )
      await waitForPlaybackState(hostPage, 'playing')
      await waitForPlaybackState(clientPage, 'playing')
      await expectPlaybackPositionsSynced({
        clientPage,
        hostPage,
        label: 'guest queued YouTube playback'
      })

      await runLiveControlAction('guest pause', () =>
        clickPlayPauseAndWaitForState(clientPage, 'paused')
      )
      await waitForPlaybackState(hostPage, 'paused')
      await waitForPlaybackState(clientPage, 'paused')
      await expectPlaybackPositionsSynced({
        clientPage,
        hostPage,
        label: 'guest pause'
      })

      await runLiveControlAction('guest rate', () =>
        clientPage.click('#runtime_playback_controls [data-intent="rateUp"]')
      )
      await waitForRuntimeText(hostPage, '1.25x')
      await waitForRuntimeText(clientPage, '1.25x')

      const expectedGuestSeekPositionMs =
        (await getPlaybackPositionMs(clientPage)) + SEEK_FORWARD_STEP_MS
      await runLiveControlAction('guest seek', () =>
        clientPage.click('#runtime_playback_controls [data-intent="seekForward"]')
      )
      await waitForPlaybackPositionAtLeast(hostPage, expectedGuestSeekPositionMs, 'guest seek host')
      await waitForPlaybackPositionAtLeast(
        clientPage,
        expectedGuestSeekPositionMs,
        'guest seek client'
      )
      await expectPlaybackPositionsSynced({
        clientPage,
        hostPage,
        label: 'guest seek'
      })

      await runLiveControlAction('host queued YouTube', () =>
        addRuntimeMediaUrl(hostPage, 'youtube.com/watch?v=host-e2e')
      )

      await waitForRuntimeText(hostPage, 'Media added with https:// filled in')
      await hostPage.waitForSelector('[data-queue-item-id]')
      const previousHostMediaId = await getCurrentQueueMediaId(hostPage)
      await hostPage.waitForSelector(
        '#runtime_playback_controls [data-intent="next"]:not([disabled])'
      )
      await runLiveControlAction('host advanced YouTube', () =>
        hostPage.click('#runtime_playback_controls [data-intent="next"]:not([disabled])')
      )
      const nextHostMediaId = await waitForCurrentQueueMediaIdChange(
        hostPage,
        previousHostMediaId,
        'host next'
      )
      await waitForCurrentQueueMediaIdChange(clientPage, previousHostMediaId, 'client next')
      expect(nextHostMediaId).not.toBe(previousHostMediaId)
      await waitForQueueEmpty(hostPage, 'host next')
      await waitForQueueEmpty(clientPage, 'client next')
      await waitForCurrentQueueTitle(hostPage, 'YouTube watch page')
      await waitForCurrentQueueTitle(clientPage, 'YouTube watch page')
      await waitForRuntimeText(clientPage, 'Website loaded')
      await waitForRuntimeText(clientPage, 'YouTube watch page')
      await waitForPlaybackState(hostPage, 'playing')
      await waitForPlaybackState(clientPage, 'playing')
      await expectPlaybackPositionsSynced({
        clientPage,
        hostPage,
        label: 'host advanced YouTube playback'
      })

      await runLiveControlAction('host pause', () =>
        clickPlayPauseAndWaitForState(hostPage, 'paused')
      )
      await waitForPlaybackState(hostPage, 'paused')
      await waitForPlaybackState(clientPage, 'paused')
      await expectPlaybackPositionsSynced({
        clientPage,
        hostPage,
        label: 'host pause'
      })

      await runLiveControlAction('host rate', () =>
        hostPage.click('#runtime_playback_controls [data-intent="rateUp"]')
      )
      await waitForRuntimeText(hostPage, '1.25x')
      await waitForRuntimeText(clientPage, '1.25x')

      const expectedHostSeekPositionMs =
        (await getPlaybackPositionMs(hostPage)) + SEEK_FORWARD_STEP_MS
      await runLiveControlAction('host seek', () =>
        hostPage.click('#runtime_playback_controls [data-intent="seekForward"]')
      )
      await waitForPlaybackPositionAtLeast(hostPage, expectedHostSeekPositionMs, 'host seek host')
      await waitForPlaybackPositionAtLeast(
        clientPage,
        expectedHostSeekPositionMs,
        'host seek client'
      )
      await expectPlaybackPositionsSynced({
        clientPage,
        hostPage,
        label: 'host seek'
      })
    })

    it(
      'should keep one two-browser connection happy from YouTube through every site handoff lane',
      async () => {
        const e2eRelayRoomId = createE2ERelayRoomId(hostId, 'youtube-every-site-handoff')
        await visitRuntimePath(page, `/join/${hostId}`, { e2eRelayRoomId })
        const hostPage = page
        await waitForRuntimeShell(hostPage, 'mixed-site handoff host')
        const inviteSecret = await getRuntimeInviteSecret(hostPage)

        await ms.setProfile('clientA', clientPage)
        await visitRuntimePath(
          clientPage,
          `/join/${hostId}?secret=${encodeURIComponent(inviteSecret)}`,
          { e2eRelayRoomId }
        )
        await waitForRuntimeShell(clientPage, 'mixed-site handoff client')
        await waitForRuntimeText(hostPage, 'Synced')
        await waitForRuntimeText(clientPage, 'Synced')
        expectLiveBrowserIsolation({ clientBrowser, clientPage, hostPage })
        await expectHealthyTwoBrowserConnection({
          clientPage,
          hostPage
        })
        const runLiveControlAction = createLiveControlActionRunner({ clientPage, hostPage })

        await runLiveControlAction('mixed-site YouTube queue', () =>
          addRuntimeMediaUrl(clientPage, MIXED_SITE_HANDOFF_YOUTUBE_SOURCE.url)
        )
        await waitForRuntimeText(hostPage, MIXED_SITE_HANDOFF_YOUTUBE_SOURCE.expectedText)
        await waitForRuntimeText(clientPage, MIXED_SITE_HANDOFF_YOUTUBE_SOURCE.expectedText)
        await waitForCurrentQueueTitle(hostPage, MIXED_SITE_HANDOFF_YOUTUBE_SOURCE.title)
        await waitForCurrentQueueTitle(clientPage, MIXED_SITE_HANDOFF_YOUTUBE_SOURCE.title)
        await waitForPlaybackState(hostPage, 'playing')
        await waitForPlaybackState(clientPage, 'playing')
        await exerciseTwoBrowserPlaybackControls({
          clientPage,
          controlPage: clientPage,
          hostPage,
          label: 'mixed-site YouTube start',
          runLiveControlAction
        })

        for (let index = 1; index < MIXED_SITE_HANDOFF_SOURCES.length; index += 1) {
          const source = MIXED_SITE_HANDOFF_SOURCES[index]
          const addingPage = index % 2 === 0 ? clientPage : hostPage
          const previousHostMediaId = await getCurrentQueueMediaId(hostPage)

          await runLiveControlAction(`mixed-site ${source.lane} queued`, () =>
            addRuntimeMediaUrl(addingPage, source.url)
          )
          await waitForQueuedItemTitle(hostPage, source.title)
          await waitForQueuedItemTitle(clientPage, source.title)
          await hostPage.waitForSelector('[data-queue-action="next"]:not([disabled])')
          await runLiveControlAction(`mixed-site ${source.lane} next`, () =>
            hostPage.click('[data-queue-action="next"]:not([disabled])')
          )
          await waitForCurrentQueueMediaIdChange(
            hostPage,
            previousHostMediaId,
            `mixed-site ${source.lane} host next`
          )
          await waitForCurrentQueueMediaIdChange(
            clientPage,
            previousHostMediaId,
            `mixed-site ${source.lane} client next`
          )
          await waitForQueueEmpty(hostPage, `mixed-site ${source.lane} host queue`)
          await waitForQueueEmpty(clientPage, `mixed-site ${source.lane} client queue`)
          await waitForRuntimeText(hostPage, source.expectedText)
          await waitForRuntimeText(clientPage, source.expectedText)
          await waitForCurrentQueueTitle(hostPage, source.title)
          await waitForCurrentQueueTitle(clientPage, source.title)
          await waitForPlaybackState(hostPage, 'playing')
          await waitForPlaybackState(clientPage, 'playing')
          await expectPlaybackPositionsSynced({
            clientPage,
            hostPage,
            label: `mixed-site ${source.lane} handoff`
          })
          await expectTwoBrowserConnectionStillHealthy({ clientPage, hostPage })
        }

        await exerciseTwoBrowserPlaybackControls({
          clientPage,
          controlPage: hostPage,
          hostPage,
          label: 'mixed-site final handoff',
          runLiveControlAction
        })
      },
      STREAMING_SITE_SESSION_E2E_TIMEOUT_MS
    )

    STREAMING_SITE_BROWSER_PAIR_SESSION_SOURCE_GROUPS.forEach(group => {
      it(
        `should sync host and guest browser pages across every ${group.label} streaming-site path`,
        async () => {
          const e2eRelayRoomId = createE2ERelayRoomId(hostId, group.label)
          await visitRuntimePath(page, `/join/${hostId}`, { e2eRelayRoomId })
          const hostPage = page
          await waitForRuntimeShell(hostPage, `${group.label} streaming matrix host`)
          const inviteSecret = await getRuntimeInviteSecret(hostPage)

          await ms.setProfile('clientA', clientPage)
          await visitRuntimePath(
            clientPage,
            `/join/${hostId}?secret=${encodeURIComponent(inviteSecret)}`,
            { e2eRelayRoomId }
          )
          await waitForRuntimeShell(clientPage, `${group.label} streaming matrix client`)
          await waitForRuntimeText(hostPage, 'Synced')
          await waitForRuntimeText(clientPage, 'Synced')
          expectLiveBrowserIsolation({ clientBrowser, clientPage, hostPage })
          await expectHealthyTwoBrowserConnection({
            clientPage,
            hostPage
          })
          const runLiveControlAction = createLiveControlActionRunner({ clientPage, hostPage })

          for (let index = 0; index < group.sources.length; index += 1) {
            const source = group.sources[index]
            const addingPage = index % 2 === 0 ? clientPage : hostPage

            await runLiveControlAction(`${group.label} ${source.title} queued`, () =>
              addRuntimeMediaUrl(addingPage, source.url)
            )
            await waitForRuntimeText(hostPage, source.expectedText)
            await waitForRuntimeText(clientPage, source.expectedText)

            if (index > 0) {
              const previousHostMediaId = await getCurrentQueueMediaId(hostPage)
              await waitForQueuedItemTitle(hostPage, source.title)
              await waitForQueuedItemTitle(clientPage, source.title)
              await hostPage.waitForSelector('[data-queue-action="next"]:not([disabled])')
              await runLiveControlAction(`${group.label} ${source.title} next`, () =>
                hostPage.click('[data-queue-action="next"]:not([disabled])')
              )
              await waitForCurrentQueueMediaIdChange(
                hostPage,
                previousHostMediaId,
                `${group.label} host next ${index}`
              )
              await waitForCurrentQueueMediaIdChange(
                clientPage,
                previousHostMediaId,
                `${group.label} client next ${index}`
              )
              await waitForQueueEmpty(hostPage, `${group.label} host next ${index}`)
              await waitForQueueEmpty(clientPage, `${group.label} client next ${index}`)
            }

            await waitForCurrentQueueTitle(hostPage, source.title)
            await waitForCurrentQueueTitle(clientPage, source.title)
            await waitForPlaybackState(hostPage, 'playing')
            await waitForPlaybackState(clientPage, 'playing')
            await expectPlaybackPositionsSynced({
              clientPage,
              hostPage,
              label: `${source.title} playing`
            })
            if (source.exerciseControls) {
              await exerciseTwoBrowserPlaybackControls({
                clientPage,
                controlPage: addingPage,
                hostPage,
                label: `${source.lane} ${source.title}`,
                runLiveControlAction
              })
            }
            await expectTwoBrowserConnectionStillHealthy({ clientPage, hostPage })
          }
        },
        STREAMING_SITE_SESSION_E2E_TIMEOUT_MS
      )
    })
  })
})

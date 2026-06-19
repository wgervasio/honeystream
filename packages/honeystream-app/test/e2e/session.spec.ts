import { Browser, Page, BrowserContext, chromium } from 'playwright-core'
import {
  STREAMING_SITE_BROWSER_PAIR_E2E_LANE_COUNT,
  STREAMING_SITE_BROWSER_PAIR_E2E_PATH_COUNT,
  STREAMING_SITE_BROWSER_PAIR_E2E_SOURCES
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
const STREAMING_SITE_SESSION_E2E_TIMEOUT_MS = 360e3
const APP_READY_OPTIONS = { waitUntil: 'domcontentloaded' as const }
const PLAYBACK_POSITION_SELECTOR = '#runtime_playback_controls [data-intent="positionMs"]'
const PLAYBACK_PLAY_PAUSE_SELECTOR = '#runtime_playback_controls [data-intent="playPause"]'
const SEEK_FORWARD_STEP_MS = 10000
const PLAYBACK_SYNC_TOLERANCE_MS = 750
const PLAYBACK_SYNC_ASSERTION_TIMEOUT_MS = 15000
const PLAYBACK_STATE_RETRY_COUNT = 3
const PLAYBACK_STATE_RETRY_TIMEOUT_MS = 15000
const QUEUE_STATE_TIMEOUT_MS = 60000
const RUNTIME_TEXT_TIMEOUT_MS = 30000
const USE_BROADCAST_RTC_E2E = process.env.HONEYSTREAM_E2E_BROADCAST_RTC !== 'false'
const STREAMING_SITE_CONNECTION_FIXTURE_COUNT = STREAMING_SITE_CONNECTION_FIXTURES.length
const STREAMING_SITE_PROVIDER_MATCHERS = Object.freeze([
  { label: 'YouTube', domains: ['youtube.com', 'youtube-nocookie.com', 'youtu.be'] },
  { label: 'AnimePahe', domains: ['animepahe.com', 'animepahe.ru', 'animepahe.si'] },
  { label: 'Cineby', domains: ['cineby.app', 'cineby.ru', 'cineby.to'] },
  { label: 'Miruro', domains: ['miruro.to', 'miruro.tv'] }
])
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
const CONNECTION_CONFIDENCE_SELECTOR =
  '#runtime_connection_confidence[data-byte-loss-rate="0"]' +
  '[data-tail-latency-ms-budget="10"][data-best-round-trip-ms="2"]' +
  `[data-provider-count="${STREAMING_SITE_NAMED_PROVIDER_COUNT}"]` +
  `[data-site-count="${STREAMING_SITE_CONNECTION_FIXTURE_COUNT}"]` +
  `[data-site-lane-count="${STREAMING_SITE_BROWSER_PAIR_E2E_LANE_COUNT}"]` +
  `[data-site-path-count="${STREAMING_SITE_BROWSER_PAIR_E2E_PATH_COUNT}"]` +
  '[data-test-modes="broadcast+isolated-live"]'
const BROWSER_SYNC_RECEIPT_READY_SELECTOR =
  '#runtime_browser_sync_receipt[data-receipt-state="ready"][data-byte-loss-rate="0"]' +
  '[data-tail-latency-ms-budget="10"]' +
  `[data-site-lane-count="${STREAMING_SITE_BROWSER_PAIR_E2E_LANE_COUNT}"]` +
  `[data-site-path-count="${STREAMING_SITE_BROWSER_PAIR_E2E_PATH_COUNT}"]` +
  '[data-test-modes="broadcast+isolated-live"]'
const HAPPY_SYNC_SEAL_READY_SELECTOR =
  '#runtime_happy_sync_seal[data-seal-state="ready"][data-byte-loss-rate="0"]' +
  '[data-tail-latency-ms-budget="10"]' +
  `[data-site-lane-count="${STREAMING_SITE_BROWSER_PAIR_E2E_LANE_COUNT}"]` +
  `[data-site-path-count="${STREAMING_SITE_BROWSER_PAIR_E2E_PATH_COUNT}"]` +
  '[data-test-modes="broadcast+isolated-live"]'
const BROWSER_PAIR_MATRIX_SELECTOR =
  '[data-merge-gate-metric="browser-pair-matrix"]' +
  `[data-merge-gate-value="${STREAMING_SITE_BROWSER_PAIR_E2E_PATH_COUNT} browser paths"]`
let runtimeVisitCounter = 0

jest.setTimeout(SESSION_E2E_TIMEOUT_MS)

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
    await page.waitForFunction(
      expectedText =>
        Boolean(
          document.body &&
            document.body.textContent &&
            document.body.textContent.includes(expectedText)
        ),
      text,
      { timeout: RUNTIME_TEXT_TIMEOUT_MS }
    )
  } catch (error) {
    if (!isTimeoutError(error)) throw error
    const bodyTextExcerpt = await getBodyTextExcerpt(page)
    throw new Error(
      `Timed out waiting for runtime text: ${text}\nVisible text excerpt: ${bodyTextExcerpt}`
    )
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

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
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
  expectedPositionMs: number
): Promise<void> {
  await page.waitForFunction(expectedPosition => {
    const positionElement = document.querySelector(
      '#runtime_playback_controls [data-intent="positionMs"]'
    )
    if (!positionElement) {
      return false
    }

    const positionMs = Number(positionElement.getAttribute('data-position-ms') || 'NaN')
    return Number.isFinite(positionMs) && positionMs >= expectedPosition
  }, expectedPositionMs)
}

async function waitForPlaybackState(
  page: Page,
  state: 'playing' | 'paused',
  timeout?: number
): Promise<void> {
  await page.waitForFunction(
    expectedState => {
      const controls = document.querySelector('#runtime_playback_controls')
      return Boolean(controls && controls.getAttribute('data-playback-state') === expectedState)
    },
    state,
    typeof timeout === 'number' ? { timeout } : undefined
  )
}

async function waitForCurrentQueueTitle(page: Page, title: string): Promise<void> {
  await page.waitForFunction(
    expectedTitle => {
      const currentTitle = document.querySelector('[data-queue-state="current"] strong')
      return Boolean(
        currentTitle &&
          currentTitle.textContent &&
          currentTitle.textContent.indexOf(expectedTitle) !== -1
      )
    },
    title,
    { timeout: QUEUE_STATE_TIMEOUT_MS }
  )
}

async function waitForQueuedItemTitle(page: Page, title: string): Promise<void> {
  await page.waitForFunction(
    expectedTitle =>
      Array.prototype.some.call(
        document.querySelectorAll('[data-queue-item-id] span:first-child'),
        (element: Element) =>
          Boolean(element.textContent && element.textContent.indexOf(expectedTitle) !== -1)
      ),
    title,
    { timeout: QUEUE_STATE_TIMEOUT_MS }
  )
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
    `${STREAMING_SITE_BROWSER_PAIR_E2E_PATH_COUNT} named and generic website paths`
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
  await waitForRuntimeText(page, 'Vimeo, Twitch, and Netflix-style pages stay generic')
  await waitForRuntimeText(
    page,
    'YouTube, AnimePahe, Cineby, Miruro, and generic pages load locally'
  )
  await waitForRuntimeText(page, 'Browser sync receipt')
  await waitForRuntimeText(page, 'Happy sync sealed')
  await waitForRuntimeText(page, 'Two browsers synced')
  await waitForRuntimeText(page, 'Two browsers, one cozy lane')
  await waitForRuntimeText(page, '0B control loss')
  await waitForRuntimeText(page, 'YouTube plus any-site matrix')
  await waitForRuntimeText(page, `${STREAMING_SITE_BROWSER_PAIR_E2E_PATH_COUNT} two-browser paths`)
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

async function expectConnectionRunwayReady(page: Page): Promise<void> {
  await page.waitForSelector(
    '#runtime_connection_runway[data-transport-status="connected"]' +
      '[data-guest-seat-state="present"][data-invite-secret-state="present"]' +
      '[data-byte-loss-rate="0"][data-tail-latency-ms-budget="10"]' +
      '[data-best-round-trip-ms="2"]'
  )
  await waitForRuntimeText(page, 'Buddy connection runway')
  await waitForRuntimeText(page, 'Invite secret sealed')
  await waitForRuntimeText(page, 'Control lane connected')
  await waitForRuntimeText(page, 'Both seats synced')
  await waitForRuntimeText(page, 'zero control bytes lost')
}

async function expectHealthyTwoBrowserConnection(input: {
  readonly clientPage: Page
  readonly hostPage: Page
}): Promise<void> {
  await input.hostPage.waitForSelector('[data-session-state-tone="synced"]')
  await input.clientPage.waitForSelector('[data-session-state-tone="synced"]')
  await expectConnectionRunwayReady(input.hostPage)
  await expectConnectionRunwayReady(input.clientPage)
  await input.clientPage.waitForSelector(
    '#runtime_connection_runway[data-clock-sync-state="synced"]'
  )
  await input.hostPage.waitForSelector(
    '#runtime_playback_controls [data-intent="positionMs"][data-sync-confident="yes"]'
  )
  await input.clientPage.waitForSelector(
    '#runtime_playback_controls [data-intent="positionMs"][data-sync-confident="yes"]'
  )
  await input.hostPage.waitForSelector(BROWSER_SYNC_RECEIPT_READY_SELECTOR)
  await input.clientPage.waitForSelector(BROWSER_SYNC_RECEIPT_READY_SELECTOR)
  await input.hostPage.waitForSelector(HAPPY_SYNC_SEAL_READY_SELECTOR)
  await input.clientPage.waitForSelector(HAPPY_SYNC_SEAL_READY_SELECTOR)
  await waitForStreamingMergeProof(input.hostPage)
  await waitForStreamingMergeProof(input.clientPage)
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
}

function isTimeoutError(error: unknown): boolean {
  if (error instanceof Error) {
    return /timeout/i.test(error.message)
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return /timeout/i.test(String((error as { readonly message?: unknown }).message))
  }

  return false
}

async function getBodyTextExcerpt(page: Page): Promise<string> {
  const bodyText = await page.evaluate(() =>
    document.body && document.body.textContent ? document.body.textContent : ''
  )

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

async function exerciseTwoBrowserPlaybackControls(input: {
  readonly clientPage: Page
  readonly controlPage: Page
  readonly hostPage: Page
}): Promise<void> {
  await clickPlayPauseAndWaitForState(input.controlPage, 'paused')
  await waitForPlaybackState(input.hostPage, 'paused')
  await waitForPlaybackState(input.clientPage, 'paused')
  await expectPlaybackPositionsSynced({
    clientPage: input.clientPage,
    hostPage: input.hostPage,
    label: 'two-browser pause control'
  })

  await clickPlayPauseAndWaitForState(input.controlPage, 'playing')
  await waitForPlaybackState(input.hostPage, 'playing')
  await waitForPlaybackState(input.clientPage, 'playing')
  await expectPlaybackPositionsSynced({
    clientPage: input.clientPage,
    hostPage: input.hostPage,
    label: 'two-browser resume control'
  })

  const expectedSeekPositionMs =
    (await getPlaybackPositionMs(input.controlPage)) + SEEK_FORWARD_STEP_MS
  await input.controlPage.click('#runtime_playback_controls [data-intent="seekForward"]')
  await waitForPlaybackPositionAtLeast(input.hostPage, expectedSeekPositionMs)
  await waitForPlaybackPositionAtLeast(input.clientPage, expectedSeekPositionMs)
  await expectPlaybackPositionsSynced({
    clientPage: input.clientPage,
    hostPage: input.hostPage,
    label: 'two-browser seek control'
  })
}

async function visitRuntimePath(page: Page, path: string): Promise<void> {
  runtimeVisitCounter += 1
  const separator = path.indexOf('?') === -1 ? '?' : '&'
  await page.goto(
    `${getAppBaseUrl()}/#${path}${separator}__e2eVisit=${runtimeVisitCounter}`,
    APP_READY_OPTIONS
  )
}

describe('session', () => {
  const hostId = ms.useProfile()

  describe('host', () => {
    it('should start a session', async () => {
      await ms.visit(`/join/${hostId}`)
      await page.waitForSelector(RUNTIME_SHELL_SELECTOR)
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
      await waitForRuntimeText(page, 'Hosting room')
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
        `${STREAMING_SITE_BROWSER_PAIR_E2E_PATH_COUNT} paths across ` +
          `${STREAMING_SITE_BROWSER_PAIR_E2E_LANE_COUNT} site lanes before merge`
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
      await waitForRuntimeText(page, 'Waiting for two seats')
      await waitForRuntimeText(page, 'Two browsers, one cozy lane')
      await waitForRuntimeText(page, '0B control loss')
      await waitForRuntimeText(page, 'YouTube plus any-site matrix')
      await waitForRuntimeText(
        page,
        `${STREAMING_SITE_BROWSER_PAIR_E2E_PATH_COUNT} two-browser paths`
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
      await page.waitForSelector(RUNTIME_SHELL_SELECTOR)

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
      await page.waitForSelector(RUNTIME_SHELL_SELECTOR)
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

    it('should queue shorthand streaming URLs with automatic https', async () => {
      await ms.visit(`/join/${hostId}`)
      await page.waitForSelector(RUNTIME_SHELL_SELECTOR)

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
      await page.waitForSelector(RUNTIME_SHELL_SELECTOR)

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
        await guestPage.waitForSelector(RUNTIME_SHELL_SELECTOR)
        await waitForRuntimeText(guestPage, 'Network error')
      } finally {
        await guestPage.close()
        await guestContext.close()
      }
    })
  })

  describe('p2p: host + client', () => {
    let clientBrowser: Browser | undefined
    let clientContext: BrowserContext | undefined
    let clientPage: Page
    let shouldCloseClientContext = false

    beforeEach(async () => {
      clientBrowser = undefined
      shouldCloseClientContext = !USE_BROADCAST_RTC_E2E
      if (shouldCloseClientContext) {
        clientBrowser = await chromium.launch(playwrightConfig.launchBrowserApp || {})
        clientContext = await clientBrowser.newContext(playwrightConfig.context || {})
      } else {
        clientContext = context
      }
      clientPage = await clientContext.newPage()
    })

    afterEach(async () => {
      try {
        await clientPage.close()
      } finally {
        try {
          if (clientContext && shouldCloseClientContext) {
            await clientContext.close()
          }
        } finally {
          if (clientBrowser) {
            await clientBrowser.close()
          }
        }
      }
    })

    it(
      'should require the private invite secret for clients',
      async () => {
        await ms.visit(`/join/${hostId}`)
        const hostPage = page
        await hostPage.waitForSelector(RUNTIME_SHELL_SELECTOR)

        await ms.setProfile('clientA', clientPage)
        await visitRuntimePath(clientPage, `/join/${hostId}`)
        await clientPage.waitForSelector(RUNTIME_SHELL_SELECTOR)
        await waitForRuntimeText(clientPage, 'Invite secret is required')

        await ms.screenshot('session_host+client')
      },
      SESSION_E2E_TIMEOUT_MS
    )

    it('should mirror guest and host queued media and playback controls', async () => {
      await ms.visit(`/join/${hostId}`)
      const hostPage = page
      await hostPage.waitForSelector(RUNTIME_SHELL_SELECTOR)
      const inviteSecret = await getRuntimeInviteSecret(hostPage)

      await ms.setProfile('clientA', clientPage)
      await visitRuntimePath(
        clientPage,
        `/join/${hostId}?secret=${encodeURIComponent(inviteSecret)}`
      )
      await clientPage.waitForSelector(RUNTIME_SHELL_SELECTOR)
      await waitForRuntimeText(hostPage, 'Synced')
      await waitForRuntimeText(clientPage, 'Synced')
      expectLiveBrowserIsolation({ clientBrowser, clientPage, hostPage })
      await expectHealthyTwoBrowserConnection({ clientPage, hostPage })

      await clientPage.fill('#runtime-add-media-url', 'youtube.com/watch?v=guest-e2e')
      await waitForRuntimeText(clientPage, 'Honeystream will add https:// automatically')
      await clientPage.press('#runtime-add-media-url', 'Enter')

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

      await clickPlayPauseAndWaitForState(clientPage, 'paused')
      await waitForPlaybackState(hostPage, 'paused')
      await waitForPlaybackState(clientPage, 'paused')
      await expectPlaybackPositionsSynced({
        clientPage,
        hostPage,
        label: 'guest pause'
      })

      await clientPage.click('#runtime_playback_controls [data-intent="rateUp"]')
      await waitForRuntimeText(hostPage, '1.25x')
      await waitForRuntimeText(clientPage, '1.25x')

      const expectedGuestSeekPositionMs =
        (await getPlaybackPositionMs(clientPage)) + SEEK_FORWARD_STEP_MS
      await clientPage.click('#runtime_playback_controls [data-intent="seekForward"]')
      await waitForPlaybackPositionAtLeast(hostPage, expectedGuestSeekPositionMs)
      await waitForPlaybackPositionAtLeast(clientPage, expectedGuestSeekPositionMs)
      await expectPlaybackPositionsSynced({
        clientPage,
        hostPage,
        label: 'guest seek'
      })

      await hostPage.fill('#runtime-add-media-url', 'youtube.com/watch?v=host-e2e')
      await waitForRuntimeText(hostPage, 'Honeystream will add https:// automatically')
      await hostPage.press('#runtime-add-media-url', 'Enter')

      await waitForRuntimeText(hostPage, 'Media added with https:// filled in')
      await hostPage.waitForSelector('[data-queue-item-id]')
      await hostPage.click('#runtime_playback_controls [data-intent="next"]')
      await hostPage.waitForSelector('[data-queue-empty="true"]')
      await clientPage.waitForSelector('[data-queue-empty="true"]')
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

      await clickPlayPauseAndWaitForState(hostPage, 'paused')
      await waitForPlaybackState(hostPage, 'paused')
      await waitForPlaybackState(clientPage, 'paused')
      await expectPlaybackPositionsSynced({
        clientPage,
        hostPage,
        label: 'host pause'
      })

      await hostPage.click('#runtime_playback_controls [data-intent="rateUp"]')
      await waitForRuntimeText(hostPage, '1.25x')
      await waitForRuntimeText(clientPage, '1.25x')

      const expectedHostSeekPositionMs =
        (await getPlaybackPositionMs(hostPage)) + SEEK_FORWARD_STEP_MS
      await hostPage.click('#runtime_playback_controls [data-intent="seekForward"]')
      await waitForPlaybackPositionAtLeast(hostPage, expectedHostSeekPositionMs)
      await waitForPlaybackPositionAtLeast(clientPage, expectedHostSeekPositionMs)
      await expectPlaybackPositionsSynced({
        clientPage,
        hostPage,
        label: 'host seek'
      })
    })

    it(
      'should sync host and guest browser pages across supported streaming-site lanes',
      async () => {
        await ms.visit(`/join/${hostId}`)
        const hostPage = page
        await hostPage.waitForSelector(RUNTIME_SHELL_SELECTOR)
        const inviteSecret = await getRuntimeInviteSecret(hostPage)

        await ms.setProfile('clientA', clientPage)
        await visitRuntimePath(
          clientPage,
          `/join/${hostId}?secret=${encodeURIComponent(inviteSecret)}`
        )
        await clientPage.waitForSelector(RUNTIME_SHELL_SELECTOR)
        await waitForRuntimeText(hostPage, 'Synced')
        await waitForRuntimeText(clientPage, 'Synced')
        expectLiveBrowserIsolation({ clientBrowser, clientPage, hostPage })
        await expectHealthyTwoBrowserConnection({ clientPage, hostPage })

        for (let index = 0; index < STREAMING_SITE_BROWSER_PAIR_E2E_SOURCES.length; index += 1) {
          const source = STREAMING_SITE_BROWSER_PAIR_E2E_SOURCES[index]
          const addingPage = index % 2 === 0 ? clientPage : hostPage

          await addingPage.fill('#runtime-add-media-url', source.url)
          await waitForRuntimeText(addingPage, 'Honeystream will add https:// automatically')
          await addingPage.press('#runtime-add-media-url', 'Enter')
          await waitForRuntimeText(addingPage, 'Media added with https:// filled in')
          await waitForRuntimeText(hostPage, source.expectedText)
          await waitForRuntimeText(clientPage, source.expectedText)

          if (index > 0) {
            await waitForQueuedItemTitle(hostPage, source.title)
            await waitForQueuedItemTitle(clientPage, source.title)
            await hostPage.waitForSelector(
              '#runtime_playback_controls [data-intent="next"]:not([disabled])'
            )
            await hostPage.click('#runtime_playback_controls [data-intent="next"]')
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
              controlPage: index % 2 === 0 ? hostPage : clientPage,
              hostPage
            })
          }
          await expectHealthyTwoBrowserConnection({ clientPage, hostPage })
        }
      },
      STREAMING_SITE_SESSION_E2E_TIMEOUT_MS
    )
  })
})

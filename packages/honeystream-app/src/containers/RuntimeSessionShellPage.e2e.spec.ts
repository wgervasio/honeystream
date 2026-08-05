import * as playwright from 'playwright-core'
import playwrightConfig from '../../jest-playwright.config'
import {
  STREAMING_SITE_BROWSER_PAIR_E2E_LANE_COUNT,
  STREAMING_SITE_BROWSER_PAIR_E2E_PATH_COUNT,
  StreamingSiteBrowserPairE2ESource,
  STREAMING_SITE_BROWSER_PAIR_E2E_SOURCES
} from '../transport/streaming-site-browser-pair-e2e-matrix'

const { getAppBaseUrl } = require('../../test/environment/server-config') as {
  getAppBaseUrl(): string
}

interface HoneystreamE2EHelpers {
  setProfile(profileName?: string, targetPage?: playwright.Page): Promise<string>
}

interface PlaywrightE2EConfig {
  readonly launchBrowserApp?: Parameters<typeof playwright.chromium.launch>[0]
}

interface BrowserSeat {
  readonly page: playwright.Page
  dispose(): Promise<void>
}

interface RuntimeLiveReceipt {
  readonly actionP95BudgetMs: number
  readonly averageLatencyMs: number
  readonly frameBudgetBytes: number
  readonly latencyBudgetMs: number
  readonly latencySampleCount: number
  readonly maxFrameBytes: number
  readonly p95LatencyMs: number
  readonly receiptState: string
  readonly receivedBytes: number
  readonly receivedMessages: number
  readonly sentBytes: number
  readonly sentMessages: number
}

declare const context: playwright.BrowserContext
declare const ms: HoneystreamE2EHelpers
declare const page: playwright.Page

const ADD_MEDIA_INPUT_SELECTOR = '#runtime-add-media-url'
const APP_READY_TIMEOUT_MS = 30000
const CONTROL_READY_TIMEOUT_MS = 20000
const DEFAULT_POLL_INTERVAL_MS = 50
const HAPPY_SYNC_SEAL_SELECTOR = '#runtime_happy_sync_seal'
const INVITE_LINK_SELECTOR = '[data-invite-field="invite-link"] code'
const LIVE_CONTROL_RECEIPT_SELECTOR = '#runtime_live_control_receipt'
const PLAYBACK_CONTROLS_SELECTOR = '#runtime_playback_controls'
const RUNTIME_SHELL_SELECTOR = '[data-runtime-session-shell="true"]'

const launchConfig = playwrightConfig as PlaywrightE2EConfig
const controlSourceIndexes = STREAMING_SITE_BROWSER_PAIR_E2E_SOURCES.reduce<number[]>(
  (indexes, source, index) => (source.exerciseControls ? [...indexes, index] : indexes),
  []
)
let runtimeVisitCounter = 0

jest.setTimeout(180000)

const isIsolatedLiveMode = (): boolean => process.env.HONEYSTREAM_E2E_BROADCAST_RTC === 'false'

const delay = (delayMs: number): Promise<void> =>
  new Promise(resolve => {
    setTimeout(resolve, delayMs)
  })

const waitUntil = async (
  label: string,
  predicate: () => Promise<boolean>,
  timeoutMs: number = CONTROL_READY_TIMEOUT_MS
): Promise<void> => {
  const startedAtMs = Date.now()
  while (Date.now() - startedAtMs <= timeoutMs) {
    if (await predicate()) return
    await delay(DEFAULT_POLL_INTERVAL_MS)
  }

  throw new Error(`Timed out waiting for ${label}.`)
}

const createGuestSeat = async (): Promise<BrowserSeat> => {
  if (isIsolatedLiveMode()) {
    const guestBrowser = await playwright.chromium.launch(launchConfig.launchBrowserApp || {})
    const guestContext = await guestBrowser.newContext()
    const guestPage = await guestContext.newPage()

    return {
      page: guestPage,
      async dispose(): Promise<void> {
        await guestPage.close()
        await guestContext.close()
        await guestBrowser.close()
      }
    }
  }

  const guestPage = await context.newPage()

  return {
    page: guestPage,
    async dispose(): Promise<void> {
      await guestPage.close()
    }
  }
}

const appendRuntimeQueryParam = (path: string, name: string, value: string): string => {
  const separator = path.indexOf('?') === -1 ? '?' : '&'
  return `${path}${separator}${encodeURIComponent(name)}=${encodeURIComponent(value)}`
}

const toHashRouteUrl = (appOrigin: string, routePath: string): string =>
  `${appOrigin}/#${routePath}`

const visitRuntimePath = async (
  targetPage: playwright.Page,
  routePath: string,
  relayRoomId: string
): Promise<void> => {
  runtimeVisitCounter += 1
  const pathWithRelayRoom = appendRuntimeQueryParam(routePath, '__e2eRelayRoom', relayRoomId)
  const pathWithVisit = appendRuntimeQueryParam(
    pathWithRelayRoom,
    '__e2eVisit',
    String(runtimeVisitCounter)
  )

  await targetPage.goto(toHashRouteUrl(getAppBaseUrl(), pathWithVisit), {
    waitUntil: 'domcontentloaded',
    timeout: APP_READY_TIMEOUT_MS
  })
}

const getRuntimeInviteSecret = async (targetPage: playwright.Page): Promise<string> => {
  await targetPage.waitForSelector(INVITE_LINK_SELECTOR, { timeout: APP_READY_TIMEOUT_MS })
  const inviteLink = await targetPage.$eval(
    INVITE_LINK_SELECTOR,
    element => element.textContent || ''
  )
  const inviteSecret = new URL(inviteLink).searchParams.get('secret')
  if (!inviteSecret) {
    throw new Error('Expected runtime invite link to include a secret.')
  }

  return inviteSecret
}

const waitForRuntimeShell = async (targetPage: playwright.Page): Promise<void> => {
  try {
    await targetPage.waitForSelector(RUNTIME_SHELL_SELECTOR, { timeout: APP_READY_TIMEOUT_MS })
  } catch (error) {
    const pageText = await targetPage.evaluate(() =>
      document.body && document.body.textContent ? document.body.textContent.slice(0, 600) : ''
    )
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(
      `Timed out waiting for runtime shell at ${targetPage.url()}. ` +
        `Rendered text: "${pageText}". ${message}`
    )
  }
}

const setAddMediaInputValue = async (targetPage: playwright.Page, value: string): Promise<void> => {
  await targetPage.evaluate(
    ({ selector, nextValue }) => {
      const input = document.querySelector(selector)
      if (!(input instanceof HTMLInputElement)) {
        throw new Error(`Expected ${selector} to resolve to the media URL input.`)
      }

      const valueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )
      if (!valueSetter || !valueSetter.set) {
        throw new Error('HTML input value setter is unavailable.')
      }

      valueSetter.set.call(input, nextValue)
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
    },
    { selector: ADD_MEDIA_INPUT_SELECTOR, nextValue: value }
  )
}

const readAddMediaInputValue = (targetPage: playwright.Page): Promise<string> =>
  targetPage.evaluate(selector => {
    const input = document.querySelector(selector)
    if (!(input instanceof HTMLInputElement)) {
      throw new Error(`Expected ${selector} to resolve to the media URL input.`)
    }
    return input.value
  }, ADD_MEDIA_INPUT_SELECTOR)

const submitAddMediaUrl = async (
  targetPage: playwright.Page,
  source: StreamingSiteBrowserPairE2ESource
): Promise<void> => {
  await targetPage.waitForSelector(ADD_MEDIA_INPUT_SELECTOR, { timeout: APP_READY_TIMEOUT_MS })
  const expectedProvider = toExpectedPreviewProvider(source)
  const sourceUrl = source.url
  await setAddMediaInputValue(targetPage, sourceUrl)
  await waitUntil(
    `media URL input to contain ${sourceUrl}`,
    async () => (await readAddMediaInputValue(targetPage)) === sourceUrl
  )
  await waitUntil(`media source preview for ${sourceUrl}`, () =>
    targetPage.evaluate(
      ({ provider }) => {
        const preview = document.querySelector('[data-add-media-source-preview="website"]')
        return preview ? preview.getAttribute('data-add-media-provider') === provider : false
      },
      { provider: expectedProvider }
    )
  )
  await targetPage.evaluate(selector => {
    const input = document.querySelector(selector)
    if (!(input instanceof HTMLInputElement) || !input.form) {
      throw new Error(`Expected ${selector} to be inside the add-media form.`)
    }

    const submitButton = input.form.querySelector('button[type="submit"]')
    if (!(submitButton instanceof HTMLButtonElement)) {
      throw new Error('Expected add-media form to include a submit button.')
    }
    submitButton.click()
  }, ADD_MEDIA_INPUT_SELECTOR)
}

const readQueueTotal = (targetPage: playwright.Page): Promise<number> =>
  targetPage.evaluate(() => {
    const currentCount = document.querySelector('[data-queue-state="current"]') ? 1 : 0
    return currentCount + document.querySelectorAll('[data-queue-item-id]').length
  })

const readQueueTitles = (targetPage: playwright.Page): Promise<readonly string[]> =>
  targetPage.evaluate(() => {
    const titles: string[] = []
    const currentTitle = document.querySelector('[data-queue-state="current"] strong')
    if (currentTitle && currentTitle.textContent) {
      titles.push(currentTitle.textContent.trim())
    }
    document.querySelectorAll('[data-queue-item-id] > span:first-child').forEach(element => {
      if (element.textContent) {
        titles.push(element.textContent.trim())
      }
    })
    return titles
  })

const readQueueSources = (targetPage: playwright.Page): Promise<readonly string[]> =>
  targetPage.evaluate(() => {
    const sources: string[] = []
    const current = document.querySelector('[data-queue-state="current"]')
    if (current) {
      const source = current.getAttribute('data-queue-current-source') || ''
      sources.push(source)
    }
    document.querySelectorAll('[data-queue-item-id]').forEach(element => {
      sources.push(element.getAttribute('data-queue-item-source') || '')
    })
    return sources
  })

const toExpectedQueuedSource = (sourceUrl: string): string => {
  const normalizedSource = /^https?:\/\//i.test(sourceUrl) ? sourceUrl : `https://${sourceUrl}`
  return new URL(normalizedSource).toString()
}

const toExpectedPreviewProvider = (source: StreamingSiteBrowserPairE2ESource): string =>
  source.lane === 'generic' ? 'unknown' : source.lane

const waitForQueueTotal = async (
  targetPage: playwright.Page,
  expectedTotal: number,
  label: string
): Promise<void> => {
  await waitUntil(
    `${label} queue total ${expectedTotal}`,
    async () => (await readQueueTotal(targetPage)) === expectedTotal
  )
}

const waitForQueueTitles = async (
  targetPage: playwright.Page,
  expectedTitles: readonly string[],
  label: string
): Promise<void> => {
  await waitUntil(`${label} queue titles`, async () => {
    const actualTitles = await readQueueTitles(targetPage)
    return JSON.stringify(actualTitles) === JSON.stringify(expectedTitles)
  })
}

const waitForQueueSources = async (
  targetPage: playwright.Page,
  expectedSources: readonly string[],
  label: string
): Promise<void> => {
  await waitUntil(`${label} queue sources`, async () => {
    const actualSources = await readQueueSources(targetPage)
    return JSON.stringify(actualSources) === JSON.stringify(expectedSources)
  })
}

const readAttributes = (
  targetPage: playwright.Page,
  selector: string,
  attributeNames: readonly string[]
): Promise<{ readonly [name: string]: string }> =>
  targetPage.evaluate(
    ({ selector: targetSelector, attributeNames: targetAttributeNames }) => {
      const element = document.querySelector(targetSelector)
      if (!element) {
        throw new Error(`Expected element ${targetSelector} to exist.`)
      }

      const attributes: { [name: string]: string } = {}
      targetAttributeNames.forEach(name => {
        attributes[name] = element.getAttribute(name) || ''
      })
      return attributes
    },
    { selector, attributeNames }
  )

const toFiniteNumber = (value: string, label: string): number => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    throw new Error(`Expected ${label} to be a finite number, received "${value}".`)
  }
  return parsed
}

const readLiveReceipt = async (targetPage: playwright.Page): Promise<RuntimeLiveReceipt> => {
  const attributes = await readAttributes(targetPage, LIVE_CONTROL_RECEIPT_SELECTOR, [
    'data-live-action-p95-budget-ms',
    'data-live-average-latency-ms',
    'data-live-frame-budget-bytes',
    'data-live-latency-budget-ms',
    'data-live-latency-sample-count',
    'data-live-max-frame-bytes',
    'data-live-p95-latency-ms',
    'data-live-receipt-state',
    'data-live-received-control-bytes',
    'data-live-received-control-messages',
    'data-live-sent-control-bytes',
    'data-live-sent-control-messages'
  ])

  return {
    actionP95BudgetMs: toFiniteNumber(
      attributes['data-live-action-p95-budget-ms'],
      'live action P95 budget'
    ),
    averageLatencyMs: toFiniteNumber(
      attributes['data-live-average-latency-ms'],
      'live average latency'
    ),
    frameBudgetBytes: toFiniteNumber(
      attributes['data-live-frame-budget-bytes'],
      'live frame budget'
    ),
    latencyBudgetMs: toFiniteNumber(
      attributes['data-live-latency-budget-ms'],
      'live latency budget'
    ),
    latencySampleCount: toFiniteNumber(
      attributes['data-live-latency-sample-count'],
      'live latency sample count'
    ),
    maxFrameBytes: toFiniteNumber(attributes['data-live-max-frame-bytes'], 'live max frame bytes'),
    p95LatencyMs: toFiniteNumber(attributes['data-live-p95-latency-ms'], 'live p95 latency'),
    receiptState: attributes['data-live-receipt-state'],
    receivedBytes: toFiniteNumber(
      attributes['data-live-received-control-bytes'],
      'received control bytes'
    ),
    receivedMessages: toFiniteNumber(
      attributes['data-live-received-control-messages'],
      'received control messages'
    ),
    sentBytes: toFiniteNumber(attributes['data-live-sent-control-bytes'], 'sent control bytes'),
    sentMessages: toFiniteNumber(
      attributes['data-live-sent-control-messages'],
      'sent control messages'
    )
  }
}

const waitForConnectedSeats = async (
  hostPage: playwright.Page,
  guestPage: playwright.Page
): Promise<void> => {
  await Promise.all([
    hostPage.waitForSelector(
      '#runtime_connection_runway[data-transport-status="connected"][data-guest-seat-state="present"]',
      { timeout: APP_READY_TIMEOUT_MS }
    ),
    guestPage.waitForSelector(
      '#runtime_connection_runway[data-transport-status="connected"][data-guest-seat-state="present"][data-clock-sync-state="synced"]',
      { timeout: APP_READY_TIMEOUT_MS }
    )
  ])
}

const waitForHappySealReady = async (targetPage: playwright.Page): Promise<void> => {
  await targetPage.waitForSelector(
    `${HAPPY_SYNC_SEAL_SELECTOR}[data-seal-state="ready"][data-live-control-receipt-state="ready"]`,
    { timeout: APP_READY_TIMEOUT_MS }
  )
}

const waitForPlaybackState = async (
  targetPage: playwright.Page,
  state: 'paused' | 'playing'
): Promise<void> => {
  await targetPage.waitForSelector(
    `${PLAYBACK_CONTROLS_SELECTOR}[data-playback-state="${state}"]`,
    {
      timeout: CONTROL_READY_TIMEOUT_MS
    }
  )
}

const clickPlaybackIntent = async (
  targetPage: playwright.Page,
  intent: 'next' | 'playPause' | 'rateDown' | 'rateUp' | 'seekForward'
): Promise<void> => {
  const selector = `${PLAYBACK_CONTROLS_SELECTOR} [data-intent="${intent}"][data-playback-intent-state="enabled"]`
  await targetPage.waitForSelector(selector, { timeout: CONTROL_READY_TIMEOUT_MS })
  await targetPage.click(selector)
}

const readPlaybackPositionMs = (targetPage: playwright.Page): Promise<number> =>
  targetPage.evaluate(() => {
    const output = document.querySelector('#runtime_playback_controls [data-intent="positionMs"]')
    return Number(output ? output.getAttribute('data-position-ms') || '0' : '0')
  })

const readPlaybackRateLabel = (targetPage: playwright.Page): Promise<string> =>
  targetPage.evaluate(() => {
    const rate = document.querySelector('#runtime_playback_controls [data-intent="rateValue"]')
    return rate && rate.textContent ? rate.textContent : ''
  })

const clickNextAndWaitForQueueTotal = async (
  hostPage: playwright.Page,
  guestPage: playwright.Page,
  expectedTotal: number
): Promise<void> => {
  await clickPlaybackIntent(hostPage, 'next')
  await Promise.all([
    waitForQueueTotal(hostPage, expectedTotal, 'host after next'),
    waitForQueueTotal(guestPage, expectedTotal, 'guest after next')
  ])
}

const runControlBurst = async (
  hostPage: playwright.Page,
  guestPage: playwright.Page,
  expectedTotalAfterNext: number
): Promise<void> => {
  await clickPlaybackIntent(hostPage, 'playPause')
  await Promise.all([
    waitForPlaybackState(hostPage, 'paused'),
    waitForPlaybackState(guestPage, 'paused')
  ])

  await clickPlaybackIntent(guestPage, 'playPause')
  await Promise.all([
    waitForPlaybackState(hostPage, 'playing'),
    waitForPlaybackState(guestPage, 'playing')
  ])

  const positionBeforeSeek = await readPlaybackPositionMs(hostPage)
  await clickPlaybackIntent(hostPage, 'seekForward')
  await waitUntil(
    'host and guest seek position to advance',
    async () =>
      (await readPlaybackPositionMs(hostPage)) > positionBeforeSeek &&
      (await readPlaybackPositionMs(guestPage)) > positionBeforeSeek
  )

  const rateBeforeIncrease = await readPlaybackRateLabel(hostPage)
  await clickPlaybackIntent(guestPage, 'rateUp')
  await waitUntil(
    'host and guest rate increase',
    async () =>
      (await readPlaybackRateLabel(hostPage)) !== rateBeforeIncrease &&
      (await readPlaybackRateLabel(guestPage)) !== rateBeforeIncrease
  )

  const rateBeforeDecrease = await readPlaybackRateLabel(hostPage)
  await clickPlaybackIntent(hostPage, 'rateDown')
  await waitUntil(
    'host and guest rate decrease',
    async () =>
      (await readPlaybackRateLabel(hostPage)) !== rateBeforeDecrease &&
      (await readPlaybackRateLabel(guestPage)) !== rateBeforeDecrease
  )

  await clickNextAndWaitForQueueTotal(hostPage, guestPage, expectedTotalAfterNext)
}

const readSystemErrorEvents = (targetPage: playwright.Page): Promise<readonly string[]> =>
  targetPage.evaluate(() =>
    Array.from(document.querySelectorAll('[data-system-event-type="error"]')).map(
      element => element.textContent || ''
    )
  )

const expectNoRuntimeErrors = async (
  hostPage: playwright.Page,
  guestPage: playwright.Page
): Promise<void> => {
  expect(await readSystemErrorEvents(hostPage)).toEqual([])
  expect(await readSystemErrorEvents(guestPage)).toEqual([])
}

const doLiveReceiptsReconcile = (
  hostReceipt: RuntimeLiveReceipt,
  guestReceipt: RuntimeLiveReceipt
): boolean =>
  hostReceipt.receiptState === 'ready' &&
  guestReceipt.receiptState === 'ready' &&
  hostReceipt.sentMessages > 0 &&
  hostReceipt.receivedMessages > 0 &&
  guestReceipt.sentMessages > 0 &&
  guestReceipt.receivedMessages > 0 &&
  hostReceipt.sentMessages === guestReceipt.receivedMessages &&
  guestReceipt.sentMessages === hostReceipt.receivedMessages &&
  hostReceipt.sentBytes === guestReceipt.receivedBytes &&
  guestReceipt.sentBytes === hostReceipt.receivedBytes &&
  hostReceipt.latencySampleCount > 0 &&
  guestReceipt.latencySampleCount > 0 &&
  hostReceipt.latencySampleCount <= hostReceipt.receivedMessages &&
  guestReceipt.latencySampleCount <= guestReceipt.receivedMessages &&
  hostReceipt.averageLatencyMs <= hostReceipt.latencyBudgetMs &&
  guestReceipt.averageLatencyMs <= guestReceipt.latencyBudgetMs &&
  hostReceipt.maxFrameBytes > 0 &&
  guestReceipt.maxFrameBytes > 0 &&
  hostReceipt.maxFrameBytes <= hostReceipt.frameBudgetBytes &&
  guestReceipt.maxFrameBytes <= guestReceipt.frameBudgetBytes &&
  hostReceipt.p95LatencyMs <= hostReceipt.latencyBudgetMs &&
  guestReceipt.p95LatencyMs <= guestReceipt.latencyBudgetMs &&
  hostReceipt.p95LatencyMs <= hostReceipt.actionP95BudgetMs &&
  guestReceipt.p95LatencyMs <= guestReceipt.actionP95BudgetMs

const waitForLiveReceiptsToReconcile = async (
  hostPage: playwright.Page,
  guestPage: playwright.Page,
  label: string
): Promise<void> => {
  await waitUntil(`${label} live receipt reconciliation`, async () =>
    doLiveReceiptsReconcile(await readLiveReceipt(hostPage), await readLiveReceipt(guestPage))
  )
}

const expectLiveReceiptsToReconcile = async (
  hostPage: playwright.Page,
  guestPage: playwright.Page
): Promise<void> => {
  const hostReceipt = await readLiveReceipt(hostPage)
  const guestReceipt = await readLiveReceipt(guestPage)

  expect(hostReceipt.receiptState).toBe('ready')
  expect(guestReceipt.receiptState).toBe('ready')
  expect(hostReceipt.sentMessages).toBeGreaterThan(0)
  expect(hostReceipt.receivedMessages).toBeGreaterThan(0)
  expect(guestReceipt.sentMessages).toBeGreaterThan(0)
  expect(guestReceipt.receivedMessages).toBeGreaterThan(0)
  expect(hostReceipt.sentMessages).toBe(guestReceipt.receivedMessages)
  expect(guestReceipt.sentMessages).toBe(hostReceipt.receivedMessages)
  expect(hostReceipt.sentBytes).toBe(guestReceipt.receivedBytes)
  expect(guestReceipt.sentBytes).toBe(hostReceipt.receivedBytes)
  expect(hostReceipt.latencySampleCount).toBeGreaterThan(0)
  expect(guestReceipt.latencySampleCount).toBeGreaterThan(0)
  expect(hostReceipt.latencySampleCount).toBeLessThanOrEqual(hostReceipt.receivedMessages)
  expect(guestReceipt.latencySampleCount).toBeLessThanOrEqual(guestReceipt.receivedMessages)
  expect(hostReceipt.averageLatencyMs).toBeLessThanOrEqual(hostReceipt.latencyBudgetMs)
  expect(guestReceipt.averageLatencyMs).toBeLessThanOrEqual(guestReceipt.latencyBudgetMs)
  expect(hostReceipt.maxFrameBytes).toBeGreaterThan(0)
  expect(guestReceipt.maxFrameBytes).toBeGreaterThan(0)
  expect(hostReceipt.maxFrameBytes).toBeLessThanOrEqual(hostReceipt.frameBudgetBytes)
  expect(guestReceipt.maxFrameBytes).toBeLessThanOrEqual(guestReceipt.frameBudgetBytes)
  expect(hostReceipt.p95LatencyMs).toBeLessThanOrEqual(hostReceipt.latencyBudgetMs)
  expect(guestReceipt.p95LatencyMs).toBeLessThanOrEqual(guestReceipt.latencyBudgetMs)
  expect(hostReceipt.p95LatencyMs).toBeLessThanOrEqual(hostReceipt.actionP95BudgetMs)
  expect(guestReceipt.p95LatencyMs).toBeLessThanOrEqual(guestReceipt.actionP95BudgetMs)
  expect(doLiveReceiptsReconcile(hostReceipt, guestReceipt)).toBe(true)
}

const expectHappySealZeroLoss = async (targetPage: playwright.Page): Promise<void> => {
  const sealAttributes = await readAttributes(targetPage, HAPPY_SYNC_SEAL_SELECTOR, [
    'data-byte-loss-rate',
    'data-dropped-control-messages',
    'data-lost-control-bytes',
    'data-missing-directional-deliveries',
    'data-reordered-control-messages',
    'data-seal-state',
    'data-sequence-gap-control-messages',
    'data-site-lane-count',
    'data-site-path-count'
  ])

  expect(sealAttributes['data-seal-state']).toBe('ready')
  expect(sealAttributes['data-byte-loss-rate']).toBe('0')
  expect(sealAttributes['data-lost-control-bytes']).toBe('0')
  expect(sealAttributes['data-dropped-control-messages']).toBe('0')
  expect(sealAttributes['data-reordered-control-messages']).toBe('0')
  expect(sealAttributes['data-sequence-gap-control-messages']).toBe('0')
  expect(sealAttributes['data-missing-directional-deliveries']).toBe('0')
  expect(sealAttributes['data-site-lane-count']).toBe(
    String(STREAMING_SITE_BROWSER_PAIR_E2E_LANE_COUNT)
  )
  expect(sealAttributes['data-site-path-count']).toBe(
    String(STREAMING_SITE_BROWSER_PAIR_E2E_PATH_COUNT)
  )
}

const waitForSystemErrorContaining = async (
  targetPage: playwright.Page,
  expectedMessage: string
): Promise<void> => {
  await waitUntil(`system error containing "${expectedMessage}"`, async () =>
    (await readSystemErrorEvents(targetPage)).some(
      message => message.indexOf(expectedMessage) !== -1
    )
  )
}

describe('RuntimeSessionShellPage browser-pair e2e sync', () => {
  it('connects two browser seats and syncs supported websites with zero lost control bytes', async () => {
    expect(STREAMING_SITE_BROWSER_PAIR_E2E_SOURCES).toHaveLength(
      STREAMING_SITE_BROWSER_PAIR_E2E_PATH_COUNT
    )
    const controlLaneCount = new Set(
      controlSourceIndexes.map(index => STREAMING_SITE_BROWSER_PAIR_E2E_SOURCES[index].lane)
    ).size
    expect(controlLaneCount).toBe(STREAMING_SITE_BROWSER_PAIR_E2E_LANE_COUNT)

    const hostPage = page
    const guestSeat = await createGuestSeat()
    const hostPageErrors: string[] = []
    const guestPageErrors: string[] = []
    const hostPageErrorListener = (error: Error): void => {
      hostPageErrors.push(error.message)
    }
    const guestPageErrorListener = (error: Error): void => {
      guestPageErrors.push(error.message)
    }

    hostPage.on('pageerror', hostPageErrorListener)
    guestSeat.page.on('pageerror', guestPageErrorListener)

    try {
      const hostPeerId = await ms.setProfile('default', hostPage)
      const guestPeerId = await ms.setProfile('clientA', guestSeat.page)
      expect(guestPeerId).not.toBe(hostPeerId)

      const relayRoomId = `runtime-browser-pair-${Date.now()}`

      await visitRuntimePath(hostPage, `/join/${hostPeerId}`, relayRoomId)
      await waitForRuntimeShell(hostPage)
      const inviteSecret = await getRuntimeInviteSecret(hostPage)
      await visitRuntimePath(
        guestSeat.page,
        `/join/${hostPeerId}?secret=${encodeURIComponent(inviteSecret)}`,
        relayRoomId
      )
      await waitForRuntimeShell(guestSeat.page)
      await waitForConnectedSeats(hostPage, guestSeat.page)
      await Promise.all([waitForHappySealReady(hostPage), waitForHappySealReady(guestSeat.page)])

      for (let index = 0; index < STREAMING_SITE_BROWSER_PAIR_E2E_SOURCES.length; index += 1) {
        await submitAddMediaUrl(hostPage, STREAMING_SITE_BROWSER_PAIR_E2E_SOURCES[index])
        const expectedTitles = STREAMING_SITE_BROWSER_PAIR_E2E_SOURCES.slice(0, index + 1).map(
          source => source.expectedText
        )
        const expectedSources = STREAMING_SITE_BROWSER_PAIR_E2E_SOURCES.slice(0, index + 1).map(
          source => toExpectedQueuedSource(source.url)
        )
        await Promise.all([
          waitForQueueTotal(hostPage, index + 1, `host source ${index + 1}`),
          waitForQueueTotal(guestSeat.page, index + 1, `guest source ${index + 1}`),
          waitForQueueTitles(hostPage, expectedTitles, `host source ${index + 1}`),
          waitForQueueTitles(guestSeat.page, expectedTitles, `guest source ${index + 1}`),
          waitForQueueSources(hostPage, expectedSources, `host source ${index + 1}`),
          waitForQueueSources(guestSeat.page, expectedSources, `guest source ${index + 1}`)
        ])
      }

      let currentSourceIndex = 0
      for (const controlSourceIndex of controlSourceIndexes) {
        while (currentSourceIndex < controlSourceIndex) {
          const expectedTotal =
            STREAMING_SITE_BROWSER_PAIR_E2E_SOURCES.length - currentSourceIndex - 1
          await clickNextAndWaitForQueueTotal(hostPage, guestSeat.page, expectedTotal)
          currentSourceIndex += 1
        }

        const expectedTotalAfterBurstNext =
          STREAMING_SITE_BROWSER_PAIR_E2E_SOURCES.length - currentSourceIndex - 1
        await runControlBurst(hostPage, guestSeat.page, expectedTotalAfterBurstNext)
        currentSourceIndex += 1
      }

      await waitForLiveReceiptsToReconcile(hostPage, guestSeat.page, 'final')
      await Promise.all([waitForHappySealReady(hostPage), waitForHappySealReady(guestSeat.page)])
      await Promise.all([
        expectHappySealZeroLoss(hostPage),
        expectHappySealZeroLoss(guestSeat.page)
      ])

      await expectLiveReceiptsToReconcile(hostPage, guestSeat.page)
      await expectNoRuntimeErrors(hostPage, guestSeat.page)
      expect(hostPageErrors).toEqual([])
      expect(guestPageErrors).toEqual([])
    } finally {
      await guestSeat.dispose()
    }
  })

  it('keeps invalid invite attempts out of the connected happy path', async () => {
    const hostPage = page
    const missingSecretSeat = await createGuestSeat()
    const wrongSecretSeat = await createGuestSeat()

    try {
      const hostPeerId = await ms.setProfile('default', hostPage)
      await ms.setProfile('clientA', missingSecretSeat.page)
      await ms.setProfile('clientA', wrongSecretSeat.page)
      const relayRoomId = `runtime-invite-rejection-${Date.now()}`

      await visitRuntimePath(hostPage, `/join/${hostPeerId}`, relayRoomId)
      await waitForRuntimeShell(hostPage)
      await getRuntimeInviteSecret(hostPage)

      await visitRuntimePath(missingSecretSeat.page, `/join/${hostPeerId}`, relayRoomId)
      await waitForRuntimeShell(missingSecretSeat.page)
      await waitForSystemErrorContaining(
        missingSecretSeat.page,
        'Invite secret is required to join a runtime session.'
      )
      const missingSecretRunway = await readAttributes(
        missingSecretSeat.page,
        '#runtime_connection_runway',
        ['data-guest-seat-state', 'data-transport-status']
      )
      expect(missingSecretRunway).toEqual({
        'data-guest-seat-state': 'waiting',
        'data-transport-status': 'idle'
      })

      await visitRuntimePath(
        wrongSecretSeat.page,
        `/join/${hostPeerId}?secret=wrong-secret-123`,
        relayRoomId
      )
      await waitForRuntimeShell(wrongSecretSeat.page)
      await waitForSystemErrorContaining(
        wrongSecretSeat.page,
        'Invite secret was rejected by host.'
      )
      const wrongSecretRunway = await readAttributes(
        wrongSecretSeat.page,
        '#runtime_connection_runway',
        ['data-guest-seat-state', 'data-invite-secret-state', 'data-transport-status']
      )
      expect(wrongSecretRunway).toEqual({
        'data-guest-seat-state': 'waiting',
        'data-invite-secret-state': 'present',
        'data-transport-status': 'connected'
      })
      await waitForSystemErrorContaining(hostPage, 'Invite secret was rejected by host.')
    } finally {
      await wrongSecretSeat.dispose()
      await missingSecretSeat.dispose()
    }
  })
})

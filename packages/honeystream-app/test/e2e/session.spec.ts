import { Page, BrowserContext } from 'playwright-core'

const { getAppBaseUrl } = require('../environment/server-config') as {
  getAppBaseUrl(): string
}

const RUNTIME_SHELL_SELECTOR = '[data-runtime-session-shell="true"]'
const SESSION_E2E_TIMEOUT_MS = 120e3
const APP_READY_OPTIONS = { waitUntil: 'domcontentloaded' as const }
const PLAYBACK_POSITION_SELECTOR = '#runtime_playback_controls [data-intent="positionMs"]'
const SEEK_FORWARD_STEP_MS = 10000
let runtimeVisitCounter = 0

jest.setTimeout(SESSION_E2E_TIMEOUT_MS)

async function getRuntimeInviteSecret(page: Page): Promise<string> {
  const inviteLink = await page.$eval(
    '[data-invite-field="invite-link"] code',
    e => e.textContent || ''
  )
  const inviteUrl = new URL(inviteLink)
  const secret = inviteUrl.searchParams.get('secret')
  if (!secret) {
    throw new Error('Expected runtime invite link to include a secret.')
  }

  return secret
}

async function waitForRuntimeText(page: Page, text: string): Promise<void> {
  await page.waitForFunction(
    expectedText =>
      Boolean(
        document.body &&
          document.body.textContent &&
          document.body.textContent.includes(expectedText)
      ),
    text
  )
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

async function waitForPlaybackState(page: Page, state: 'playing' | 'paused'): Promise<void> {
  await page.waitForFunction(expectedState => {
    const controls = document.querySelector('#runtime_playback_controls')
    return Boolean(controls && controls.getAttribute('data-playback-state') === expectedState)
  }, state)
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
      await page.waitForSelector('#runtime_room_mood')
      await page.waitForSelector('#runtime_cozy_command_bar')
      await page.waitForSelector('#runtime_readiness_meter')
      await page.waitForSelector('#runtime_pair_guide')
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
      await waitForRuntimeText(page, '24 local fixtures')
      await waitForRuntimeText(page, 'Recovered retries counted')
      await waitForRuntimeText(page, 'Cat-side cue')
      await waitForRuntimeText(page, 'Best next tap')
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
      await waitForRuntimeText(page, 'Clean realtime lane wins')
      await waitForRuntimeText(page, 'Retry lane stays green')
      await waitForRuntimeText(page, 'Site matrix covered')
      await waitForRuntimeText(page, 'Bursts stay calm')
      await waitForRuntimeText(page, 'Rapid seek, pause, resume, and rate bursts')
      await waitForRuntimeText(page, '6 lanes run for 3 deterministic trials')
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
      await waitForRuntimeText(page, 'typed control stream')
      await waitForRuntimeText(page, 'Low-latency control lane')
      await waitForRuntimeText(page, 'Zero video-byte sharing')
      await waitForRuntimeText(page, 'Website opens locally')
      await waitForRuntimeText(page, 'Popup fallback ready')
      await waitForRuntimeText(page, 'Only controls sync')
      await waitForRuntimeText(page, 'Jitter-guarded frames')
      await waitForRuntimeText(page, 'Reliable retry guard')
      await waitForRuntimeText(page, '4ms best mock RT')
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
        { id: 'youtube', label: 'YouTube' },
        { id: 'animepahe', label: 'AnimePahe' },
        { id: 'cineby', label: 'Cineby' },
        { id: 'miruro', label: 'Miruro' }
      ]

      for (const suggestion of suggestions) {
        await page.click(`[data-source-suggestion="${suggestion.id}"]`)
        await waitForRuntimeText(page, `${suggestion.label} lane`)
        await waitForRuntimeText(
          page,
          `${suggestion.label} is covered by the low-latency streaming-site mock tests`
        )
      }
    })

    it('should queue shorthand streaming URLs with automatic https', async () => {
      await ms.visit(`/join/${hostId}`)
      await page.waitForSelector(RUNTIME_SHELL_SELECTOR)

      await page.click('#runtime-add-media-url')
      await page.type('#runtime-add-media-url', 'youtube.com/watch?v=honeystream-demo')
      await waitForRuntimeText(page, 'Honeystream will add https:// automatically')
      await page.press('#runtime-add-media-url', 'Enter')

      await waitForRuntimeText(page, 'Source queued with https:// added')
      await waitForRuntimeText(page, 'Website loaded')
      await waitForRuntimeText(page, 'YouTube watch page')
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
        await visitRuntimePath(guestPage, '/join/deadbeafdeadbeafdeadbeafdeadbeaf')
        await guestPage.waitForSelector(RUNTIME_SHELL_SELECTOR)
        await waitForRuntimeText(guestPage, 'Network error')
      } finally {
        await guestPage.close()
        await guestContext.close()
      }
    })
  })

  describe('p2p: host + client', () => {
    let clientContext: BrowserContext
    let clientPage: Page
    let clientId: string

    beforeEach(async () => {
      clientContext = await browser.newContext()
      clientPage = await clientContext.newPage()
      clientId = await ms.setProfile('clientA', clientPage)
    })

    afterEach(async () => {
      await clientPage.close()
      await clientContext.close()
    })

    it(
      'should require the private invite secret for clients',
      async () => {
        await ms.visit(`/join/${hostId}`)
        const hostPage = page
        await hostPage.waitForSelector(RUNTIME_SHELL_SELECTOR)

        await visitRuntimePath(clientPage, `/join/${hostId}`)
        await clientPage.waitForSelector(RUNTIME_SHELL_SELECTOR)
        await waitForRuntimeText(clientPage, 'Invite secret is required')

        await ms.screenshot('session_host+client')
      },
      SESSION_E2E_TIMEOUT_MS
    )

    it('should accept connecting client', async () => {
      await ms.visit(`/join/${hostId}`)
      const hostPage = page
      await hostPage.waitForSelector(RUNTIME_SHELL_SELECTOR)
      const inviteSecret = await getRuntimeInviteSecret(hostPage)

      await visitRuntimePath(
        clientPage,
        `/join/${hostId}?secret=${encodeURIComponent(inviteSecret)}`
      )
      await clientPage.waitForSelector(RUNTIME_SHELL_SELECTOR)
      await waitForRuntimeText(hostPage, 'Synced')
      await waitForRuntimeText(clientPage, 'Synced')
      await hostPage.waitForSelector('[data-session-state-tone="synced"]')
      await clientPage.waitForSelector('[data-session-state-tone="synced"]')
    })

    it('should accept guest queued media and guest playback controls', async () => {
      await ms.visit(`/join/${hostId}`)
      const hostPage = page
      await hostPage.waitForSelector(RUNTIME_SHELL_SELECTOR)
      const inviteSecret = await getRuntimeInviteSecret(hostPage)

      await visitRuntimePath(
        clientPage,
        `/join/${hostId}?secret=${encodeURIComponent(inviteSecret)}`
      )
      await clientPage.waitForSelector(RUNTIME_SHELL_SELECTOR)
      await waitForRuntimeText(hostPage, 'Synced')
      await waitForRuntimeText(clientPage, 'Synced')

      await clientPage.click('#runtime-add-media-url')
      await clientPage.type('#runtime-add-media-url', 'youtube.com/watch?v=guest-e2e')
      await waitForRuntimeText(clientPage, 'Honeystream will add https:// automatically')
      await clientPage.press('#runtime-add-media-url', 'Enter')

      await waitForRuntimeText(clientPage, 'Source queued with https:// added')
      await waitForRuntimeText(hostPage, 'Website loaded')
      await waitForRuntimeText(clientPage, 'Website loaded')
      await waitForRuntimeText(hostPage, 'YouTube watch page')
      await waitForRuntimeText(clientPage, 'YouTube watch page')
      await hostPage.waitForSelector(
        '#runtime_playback_controls [data-intent="playPause"]:not([disabled])'
      )
      await clientPage.waitForSelector(
        '#runtime_playback_controls [data-intent="playPause"]:not([disabled])'
      )
      await waitForPlaybackState(hostPage, 'playing')
      await waitForPlaybackState(clientPage, 'playing')

      await clientPage.click('#runtime_playback_controls [data-intent="playPause"]')
      await waitForPlaybackState(hostPage, 'paused')
      await waitForPlaybackState(clientPage, 'paused')

      await clientPage.click('#runtime_playback_controls [data-intent="rateUp"]')
      await waitForRuntimeText(hostPage, '1.25x')
      await waitForRuntimeText(clientPage, '1.25x')

      const expectedSeekPositionMs =
        (await getPlaybackPositionMs(clientPage)) + SEEK_FORWARD_STEP_MS
      await clientPage.click('#runtime_playback_controls [data-intent="seekForward"]')
      await waitForPlaybackPositionAtLeast(hostPage, expectedSeekPositionMs)
      await waitForPlaybackPositionAtLeast(clientPage, expectedSeekPositionMs)
    })
  })
})

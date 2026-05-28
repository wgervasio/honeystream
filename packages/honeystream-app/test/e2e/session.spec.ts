import { Page, BrowserContext } from 'playwright-core'

const RUNTIME_SHELL_SELECTOR = '[data-runtime-session-shell="true"]'
const SESSION_E2E_TIMEOUT_MS = 45e3
const APP_PORT = process.env.HONEYSTREAM_E2E_APP_PORT || process.env.PORT || '8080'
const APP_BASE_URL = process.env.HONEYSTREAM_E2E_APP_URL || `http://localhost:${APP_PORT}`
const APP_READY_OPTIONS = { waitUntil: 'domcontentloaded' as const }

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

async function visitRuntimePath(page: Page, path: string): Promise<void> {
  await page.goto(`${APP_BASE_URL}/#${path}`, APP_READY_OPTIONS)
}

describe('session', () => {
  const hostId = ms.useProfile()

  describe('host', () => {
    it('should start a session', async () => {
      await ms.visit(`/join/${hostId}`)
      await page.waitForSelector(RUNTIME_SHELL_SELECTOR)
      await page.waitForSelector('#runtime_happy_path')
      await page.waitForSelector('#runtime_room_signals')
      await page.waitForSelector('#runtime_room_mood')
      await page.waitForSelector('#runtime_cozy_command_bar')
      await page.waitForSelector('#runtime_launchpad')
      await page.waitForSelector('#runtime_concierge_strip')
      await page.waitForSelector('#runtime_watch_deck')
      await waitForRuntimeText(page, 'Cozy watch room')
      await waitForRuntimeText(page, 'Hosting room')
      await waitForRuntimeText(page, 'Cat-side cue')
      await waitForRuntimeText(page, 'Best next tap')
      await waitForRuntimeText(page, 'Paste source')
      await waitForRuntimeText(page, 'Invite link')
      await waitForRuntimeText(page, 'Room feels ready when')
      await waitForRuntimeText(page, 'Tonight launchpad')
      await waitForRuntimeText(page, 'Next best move')
      await waitForRuntimeText(page, 'Sync check')
      await waitForRuntimeText(page, 'Pick the first source')
      await waitForRuntimeText(page, 'Press play when ready')
      await waitForRuntimeText(page, 'Controls obvious')
      await waitForRuntimeText(page, 'Website lane')
      await waitForRuntimeText(page, 'syncs only the tiny control stream')
      await waitForRuntimeText(page, 'Low-latency control lane')
      await waitForRuntimeText(page, 'Zero video-byte sharing')
      await waitForRuntimeText(page, 'Pick the next cozy stream')
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
      await waitForRuntimeText(page, 'watch')
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
    })
  })
})

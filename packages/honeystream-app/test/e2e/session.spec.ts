import { Page, BrowserContext } from 'playwright-core'

const RUNTIME_SHELL_SELECTOR = '[data-runtime-session-shell="true"]'
const SESSION_E2E_TIMEOUT_MS = 45e3

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

describe('session', () => {
  const hostId = ms.useProfile()

  describe('host', () => {
    it('should start a session', async () => {
      await ms.visit(`/join/${hostId}`)
      await page.waitForSelector(RUNTIME_SHELL_SELECTOR)
      await page.waitForSelector('#runtime_happy_path')
      await page.waitForSelector('#runtime_watch_deck')
      await waitForRuntimeText(page, 'Cozy watch room')
      await waitForRuntimeText(page, 'Hosting room')
      await waitForRuntimeText(page, 'Invite link')
      await waitForRuntimeText(page, 'Website lane')
      await waitForRuntimeText(page, 'Pick the next cozy stream')
      await ms.screenshot('session_host')
    })

    it('should not join invalid session', async () => {
      const guestContext = await browser.newContext()
      const guestPage = await guestContext.newPage()

      try {
        await ms.setProfile('default', guestPage)
        await guestPage.goto(`http://localhost:8080/#/join/deadbeafdeadbeafdeadbeafdeadbeaf`)
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

        await clientPage.goto(`http://localhost:8080/#/join/${hostId}`)
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

      await clientPage.goto(
        `http://localhost:8080/#/join/${hostId}?secret=${encodeURIComponent(inviteSecret)}`
      )
      await clientPage.waitForSelector(RUNTIME_SHELL_SELECTOR)
      await waitForRuntimeText(hostPage, 'Synced')
      await waitForRuntimeText(clientPage, 'Synced')
    })
  })
})

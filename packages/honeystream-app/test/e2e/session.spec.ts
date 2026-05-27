import { Page, BrowserContext } from 'playwright-core'

describe('session', () => {
  const hostId = ms.useProfile()

  beforeAll(() => {
    jest.setTimeout(20e3)
  })

  describe('host', () => {
    it('should start a session', async () => {
      await ms.visit(`/join/${hostId}`)
      await page.waitForSelector(`#userlist [data-user=${hostId}]`)
      await ms.screenshot('session_host')
    })

    it('should not join invalid session', async () => {
      const guestContext = await browser.newContext()
      const guestPage = await guestContext.newPage()

      try {
        await ms.setProfile('default', guestPage)
        await guestPage.goto(`http://localhost:8080/#/join/deadbeafdeadbeafdeadbeafdeadbeaf`)
        await guestPage.waitForSelector('#disconnect_reason')
        const reason = await guestPage.$eval('#disconnect_reason', e => e.textContent)
        expect(reason).toBe('Session not found.')
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

    it('should require allowing client to connect', async () => {
      await ms.visit(`/join/${hostId}`)
      const hostPage = page
      await hostPage.waitForSelector(`#userlist [data-user=${hostId}]`)

      await clientPage.goto(`http://localhost:8080/#/join/${hostId}`)

      await hostPage.click(`#userlist [data-pending="true"] [data-id="allow"]`)
      await hostPage.waitForSelector(`[data-user="${clientId}"][data-pending="false"]`)

      await ms.screenshot('session_host+client')
    }, 10e3)

    it('should accept connecting client', async () => {
      await ms.visit(`/join/${hostId}`)
      const hostPage = page
      await hostPage.waitForSelector(`#userlist [data-user=${hostId}]`)

      // set public session
      await hostPage.evaluate(() =>
        (window as any).app.store.dispatch({
          type: 'SET_SETTING',
          payload: { key: 'sessionMode', value: 0 }
        })
      )

      await clientPage.goto(`http://localhost:8080/#/join/${hostId}`)
      await hostPage.waitForSelector(`[data-user="${clientId}"][data-pending="false"]`)
    })
  })
})

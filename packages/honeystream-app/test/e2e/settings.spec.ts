jest.setTimeout(30e3)

const RUNTIME_USERNAME_SELECTOR = '#settings-runtime-username'
const RUNTIME_USERNAME_VALUE = 'coolguy'

describe('settings', () => {
  const userId = ms.useProfile()

  describe('appearance', () => {
    it('should apply a new language', async () => {
      await ms.visit(`/settings`)
      await page.click('#settings_tab_appearance')
      await page.selectOption('#appearance_language', 'ja-JP')

      let h1 = await page.$eval('h1', e => e.textContent)
      expect(h1).toBe('設定')

      await ms.screenshot('language')

      // revert
      await page.click('#settings_tab_appearance')
      await page.selectOption('#appearance_language', 'en-US')
      h1 = await page.$eval('h1', e => e.textContent)
      expect(h1).toBe('Settings')
    })
  })

  describe('in-session', () => {
    it('should edit runtime username settings', async () => {
      await ms.visit(`/join/${userId}`)
      await page.waitForSelector('[data-runtime-session-shell="true"]')
      await page.fill(RUNTIME_USERNAME_SELECTOR, RUNTIME_USERNAME_VALUE)
      await page.waitForFunction(
        (input: { readonly selector: string; readonly value: string }) => {
          const { selector, value } = input
          const element = document.querySelector(selector) as HTMLInputElement | null
          return Boolean(element && element.value === value)
        },
        { selector: RUNTIME_USERNAME_SELECTOR, value: RUNTIME_USERNAME_VALUE }
      )
      const username = await page.$eval(
        RUNTIME_USERNAME_SELECTOR,
        e => (e as HTMLInputElement).value
      )
      expect(username).toBe(RUNTIME_USERNAME_VALUE)
    })
  })
})

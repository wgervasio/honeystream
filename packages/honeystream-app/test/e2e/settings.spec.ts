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
      await page.fill('#settings-runtime-username', 'coolguy')
      const username = await page.$eval('#settings-runtime-username', e => (e as HTMLInputElement).value)
      expect(username).toBe('coolguy')
    })
  })
})

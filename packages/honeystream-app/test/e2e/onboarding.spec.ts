describe('onboarding', () => {
  beforeEach(async () => {
    await ms.visit('/')
  })

  it('should show welcome screen on first visit', async () => {
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForSelector('#welcome_headline')
    const headline = await page.$eval('#welcome_headline', e => e.textContent)
    expect(headline).toContain('cozy synced stream')
    await page.type('#profile_username', 'default')
    await ms.screenshot('welcome')
    await page.click('#getstarted')
    await page.waitForSelector('#startsession')
  })

  it('should show home on next visit', async () => {
    await page.waitForSelector('#startsession')
    await page.waitForSelector('#home_headline')
    const headline = await page.$eval('#home_headline', e => e.textContent)
    const siteExamples = await page.$eval('#home_site_examples', e => e.textContent)
    expect(headline).toContain('Happy streams')
    expect(siteExamples).toContain('YouTube')
    await page.waitForSelector('#home_feature_private')
    await page.waitForSelector('#home_feature_sync')
    await page.waitForSelector('#home_feature_sites')
  })

  it('should show friendly join guidance', async () => {
    await ms.visit('/join')
    await page.waitForSelector('#join_headline')
    const headline = await page.$eval('#join_headline', e => e.textContent)
    expect(headline).toContain('hop into sync')
  })
})

import { Page, Browser, BrowserContext } from 'playwright-core'

interface HoneystreamTestUtils {
  screenshot: (filename: string, page?: Page) => Promise<void>
  visit: Page['goto']
  setProfile(profileName?: string, page?: Page): Promise<string>
  useProfile(profileName?: string, page?: Page): string
}

declare global {
  const browser: Browser
  const context: BrowserContext
  const ms: HoneystreamTestUtils
  const page: Page
}

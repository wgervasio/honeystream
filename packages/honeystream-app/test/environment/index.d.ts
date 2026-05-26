import { Page, Browser, BrowserContext } from 'playwright-chromium'

interface HoneystreamTestUtils {
  screenshot: (filename: string, page?: Page) => Promise<void>
  visit: Page['goto']
  setProfile(profileName?: string, page?: Page): Promise<string>
  useProfile(profileName?: string, page?: Page): string
}

declare global {
  const ms: HoneystreamTestUtils
}

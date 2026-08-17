const { promises: fs } = require('fs')
const path = require('path')
const NodeEnvironment = require('jest-environment-node')
const playwright = require('playwright-core')
const { getAppBaseUrl } = require('./server-config')
const { patchUnsupportedChromiumTargets } = require('./playwright-compat')
const playwrightConfig = require('../../jest-playwright.config')

const ARTIFACTS_PATH = path.join(__dirname, '../artifacts')
const APP_READY_OPTIONS = Object.freeze({ waitUntil: 'domcontentloaded' })
const CAPTURE_SCREENSHOTS = process.env.HONEYSTREAM_E2E_SCREENSHOTS === 'true'
const BROWSER_CLOSE_TIMEOUT_MS = 5000
const NAVIGATION_TIMEOUT_MS = 30000
const PERSISTED_STATE_KEY = 'persist:honeystream-state'

const PROFILES = {
  default: {
    identity: {
      public: 'ac85c8efdac0de31c4f400ab785ad6b0cafd8022711128a3a860147788cd825d',
      secret: '6baed98eefe4a9fc850e6768d083aa8d23f5eb27632b1c189a42d5c3520c6161'
    },
    localStorage: {
      welcomed: true
    },
    initialState: {
      settings: {
        username: 'host'
      }
    }
  },
  clientA: {
    identity: {
      public: '19e17b67e6588f9b7f642d4b76cf1116179799a811d5735926182dd217e80949',
      secret: '747f216b51ac33346e9a871ed7aa5a3ab4ad3607064dffc490da3f82c8a61630'
    },
    localStorage: {
      welcomed: true
    },
    initialState: {
      settings: {
        username: 'clientA'
      }
    }
  }
}
let visitCounter = 0

function withE2EVisitParam(pathname) {
  visitCounter += 1
  return `${pathname}${pathname.includes('?') ? '&' : '?'}__e2eVisit=${visitCounter}`
}

function isTimeoutError(error) {
  return Boolean(error && error.message && /timeout|timed out/i.test(error.message))
}

async function gotoAppPage(page, url, opts, label) {
  const didUseHashNavigation = await page
    .evaluate(nextUrl => {
      const next = new URL(nextUrl)
      if (
        window.location.origin !== next.origin ||
        window.location.pathname !== next.pathname ||
        !next.hash
      ) {
        return false
      }

      window.location.hash = next.hash
      return true
    }, url)
    .catch(() => false)
  if (didUseHashNavigation) {
    return
  }

  try {
    await page.goto(url, {
      ...(opts || APP_READY_OPTIONS),
      timeout: NAVIGATION_TIMEOUT_MS
    })
  } catch (error) {
    if (!isTimeoutError(error)) {
      throw error
    }
    console.warn(`${label} navigation timed out after ${NAVIGATION_TIMEOUT_MS}ms.`)
  }
}

function getProfileStorage(profile) {
  return {
    identity: profile.identity.secret,
    'identity.pub': profile.identity.public,
    [PERSISTED_STATE_KEY]: JSON.stringify({
      settings: JSON.stringify(profile.initialState.settings),
      _persist: JSON.stringify({ version: 3, rehydrated: true })
    }),
    ...profile.localStorage
  }
}

function writeProfileStorage(data) {
  if (window.location.protocol !== 'http:' && window.location.protocol !== 'https:') {
    return
  }

  Object.keys(data).forEach(key => {
    const value = data[key]
    if (value) {
      localStorage.setItem(key, value)
    } else {
      localStorage.removeItem(key)
    }
  })
}

async function setProfile(profileName = 'default', page = this.global.page) {
  const profile = PROFILES[profileName]
  if (!profile) {
    throw new Error(`Unknown e2e profile "${profileName}".`)
  }

  const storage = getProfileStorage(profile)
  await page.addInitScript(writeProfileStorage, storage)

  if (page.url().startsWith(getAppBaseUrl())) {
    await page.evaluate(writeProfileStorage, storage)
  }

  return profile.identity.public
}

function useProfile(profileName = 'default', page = this.global.page) {
  const profile = PROFILES[profileName]

  this.global.beforeAll(async () => {
    await setProfile.call(this, profileName, page)
  })

  return profile.identity.public
}

const screenshot = (filename, page) => {
  if (!CAPTURE_SCREENSHOTS) {
    return Promise.resolve()
  }

  const filepath = path.join(ARTIFACTS_PATH, `${filename}.jpg`)
  return page.screenshot({ path: filepath, quality: 70 })
}

function withTimeout(operation, label, timeoutMs) {
  let timeout
  const operationPromise = Promise.resolve()
    .then(operation)
    .catch(error => {
      console.warn(`${label} failed:`, error && error.message ? error.message : error)
      return undefined
    })
  const timeoutPromise = new Promise(resolve => {
    timeout = setTimeout(() => {
      console.warn(`${label} did not finish within ${timeoutMs}ms.`)
      resolve(undefined)
    }, timeoutMs)
  })

  return Promise.race([operationPromise, timeoutPromise]).finally(() => {
    if (timeout) {
      clearTimeout(timeout)
    }
  })
}

function closeBrowserProcess(browserProcess) {
  if (
    !browserProcess ||
    !browserProcess.pid ||
    browserProcess.killed ||
    (browserProcess.exitCode !== null && typeof browserProcess.exitCode !== 'undefined') ||
    browserProcess.signalCode
  ) {
    return
  }

  browserProcess.kill()
}

async function closeResource(label, resource) {
  if (!resource || typeof resource.close !== 'function') {
    return
  }

  await withTimeout(() => resource.close(), label, BROWSER_CLOSE_TIMEOUT_MS)
}

async function closeBrowser(browser) {
  if (!browser || typeof browser.close !== 'function') {
    return
  }

  const ownedServer = browser._ownedServer
  if (ownedServer && typeof ownedServer.kill === 'function') {
    ownedServer.kill()
    return
  }

  const browserProcess = typeof browser.process === 'function' ? browser.process() : undefined
  if (browserProcess) {
    await closeResource('Playwright browser close', browser)
    closeBrowserProcess(browserProcess)
    return
  }

  await closeResource('Playwright browser close', browser)
}

class HoneystreamEnvironment extends NodeEnvironment {
  async setup() {
    await super.setup()

    patchUnsupportedChromiumTargets()

    const launchOptions = playwrightConfig.launchBrowserApp || {}
    const browser = await playwright.chromium.launch(launchOptions)
    const context = await browser.newContext(playwrightConfig.context || {})
    const page = await context.newPage()

    page.on('pageerror', error => process.emit('uncaughtException', error))

    this.global.browserName = 'chromium'
    this.global.browser = browser
    this.global.context = context
    this.global.page = page

    const honeystream = {
      screenshot: (filename, page = this.global.page) => screenshot(filename, page),
      visit: async (pathname, opts) =>
        gotoAppPage(
          this.global.page,
          `${getAppBaseUrl()}/#${withE2EVisitParam(pathname)}`,
          opts || APP_READY_OPTIONS,
          'app route'
        ),
      useProfile: useProfile.bind(this),
      setProfile: setProfile.bind(this)
    }
    this.global.ms = honeystream
  }

  async teardown() {
    const page = this.global.page
    const context = this.global.context
    const browser = this.global.browser

    this.global.ms = undefined

    try {
      if (page) {
        page.removeAllListeners('pageerror')
      }
      await closeResource('Playwright page close', page)
      await closeResource('Playwright context close', context)
      await closeBrowser(browser)
    } catch (error) {
      console.warn(error && error.message ? error.message : error)
    } finally {
      await super.teardown()
    }
  }
}

module.exports = HoneystreamEnvironment

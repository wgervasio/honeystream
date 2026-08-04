const fs = require('fs')

const macChromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
  (process.platform === 'darwin' && fs.existsSync(macChromePath) ? macChromePath : undefined)

module.exports = {
  launchBrowserApp: {
    headless: process.env.HEADLESS !== 'false',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-features=WebRtcHideLocalIpsWithMdns'
    ],
    ...(executablePath ? { executablePath } : {})
  }
}

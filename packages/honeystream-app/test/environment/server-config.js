const fs = require('fs')
const path = require('path')

const ARTIFACTS_PATH = path.join(__dirname, '../artifacts')
const SERVER_CONFIG_PATH = path.join(ARTIFACTS_PATH, 'server-config.json')
const DEFAULT_APP_HOST = '127.0.0.1'
const DEFAULT_APP_PORT = '8080'

function readServerConfig() {
  try {
    return JSON.parse(fs.readFileSync(SERVER_CONFIG_PATH, 'utf8'))
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return undefined
    }

    throw error
  }
}

function writeServerConfig(config) {
  fs.mkdirSync(ARTIFACTS_PATH, { recursive: true })
  fs.writeFileSync(SERVER_CONFIG_PATH, JSON.stringify(config), 'utf8')
}

function removeServerConfig() {
  try {
    fs.unlinkSync(SERVER_CONFIG_PATH)
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return
    }

    throw error
  }
}

function getAppBaseUrl() {
  if (process.env.HONEYSTREAM_E2E_APP_URL) {
    return process.env.HONEYSTREAM_E2E_APP_URL
  }

  const config = readServerConfig()
  if (config && typeof config.appBaseUrl === 'string' && config.appBaseUrl.length > 0) {
    return config.appBaseUrl
  }

  const appHost = process.env.HONEYSTREAM_E2E_APP_HOST || DEFAULT_APP_HOST
  const appPort = process.env.HONEYSTREAM_E2E_APP_PORT || process.env.PORT || DEFAULT_APP_PORT
  return `http://${appHost}:${appPort}`
}

module.exports = {
  getAppBaseUrl,
  removeServerConfig,
  writeServerConfig
}

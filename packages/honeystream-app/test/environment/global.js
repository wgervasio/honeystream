const { promises: fs } = require('fs')
const path = require('path')
const { setup: setupServer, teardown: teardownServer } = require('jest-dev-server')

const APP_PORT = process.env.HONEYSTREAM_E2E_APP_PORT || process.env.PORT || '8080'
const SIGNAL_SERVER_PORT = process.env.SIGNAL_SERVER_PORT || '27064'
const SIGNAL_SERVER_URL =
  process.env.HONEYSTREAM_SIGNAL_SERVER || `ws://localhost:${SIGNAL_SERVER_PORT}`
const SERVER_LAUNCH_TIMEOUT_MS = 300e3
const useExternalServers = process.env.HONEYSTREAM_E2E_EXTERNAL_SERVER === 'true'

async function setup(jestConfig = {}) {
  try {
    await fs.mkdir(path.join(__dirname, '../artifacts'))
  } catch {}

  if (!useExternalServers) {
    await setupServer([
      {
        command: `cross-env PORT=${APP_PORT} HONEYSTREAM_SIGNAL_SERVER=${SIGNAL_SERVER_URL} yarn start`,
        launchTimeout: SERVER_LAUNCH_TIMEOUT_MS,
        port: Number(APP_PORT),
        waitOnScheme: {
          resources: [`http-get://localhost:${APP_PORT}/`]
        }
      },
      {
        command: `cross-env SIGNAL_SERVER_PORT=${SIGNAL_SERVER_PORT} yarn start:signal-server`,
        launchTimeout: SERVER_LAUNCH_TIMEOUT_MS,
        port: Number(SIGNAL_SERVER_PORT),
        waitOnScheme: {
          resources: [`tcp:localhost:${SIGNAL_SERVER_PORT}`]
        }
      }
    ])
  }
}

async function teardown(jestConfig = {}) {
  if (!useExternalServers) {
    await teardownServer()
  }
}

module.exports = { setup, teardown }

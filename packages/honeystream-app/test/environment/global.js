const { promises: fs } = require('fs')
const path = require('path')
const { setup: setupServer, teardown: teardownServer } = require('jest-dev-server')

const SIGNAL_SERVER_URL = process.env.HONEYSTREAM_SIGNAL_SERVER || 'ws://localhost:27064'
const useExternalServers = process.env.HONEYSTREAM_E2E_EXTERNAL_SERVER === 'true'

async function setup(jestConfig = {}) {
  try {
    await fs.mkdir(path.join(__dirname, '../artifacts'))
  } catch {}

  if (!useExternalServers) {
    await setupServer([
      {
        command: `cross-env HONEYSTREAM_SIGNAL_SERVER=${SIGNAL_SERVER_URL} yarn start`,
        launchTimeout: 120e3,
        port: 8080,
        waitOnScheme: {
          resources: ['http-get://localhost:8080/']
        }
      },
      {
        command: 'yarn start:signal-server',
        port: 27064,
        waitOnScheme: {
          resources: ['tcp:localhost:27064']
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

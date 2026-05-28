const { promises: fs } = require('fs')
const path = require('path')
const {
  getServers,
  setup: setupServer,
  teardown: teardownServer
} = require('jest-dev-server')

const APP_PORT = process.env.HONEYSTREAM_E2E_APP_PORT || process.env.PORT || '8080'
const SIGNAL_SERVER_PORT = process.env.SIGNAL_SERVER_PORT || '27064'
const SIGNAL_SERVER_URL =
  process.env.HONEYSTREAM_SIGNAL_SERVER || `ws://localhost:${SIGNAL_SERVER_PORT}`
const SERVER_LAUNCH_TIMEOUT_MS = 300e3
const useExternalServers = process.env.HONEYSTREAM_E2E_EXTERNAL_SERVER === 'true'

function destroyChildStream(stream) {
  if (!stream) return
  stream.removeAllListeners()
  if (typeof stream.destroy === 'function') {
    stream.destroy()
    return
  }
  if (typeof stream.end === 'function') {
    stream.end()
  }
}

async function setup(jestConfig = {}) {
  await fs.mkdir(path.join(__dirname, '../artifacts'), { recursive: true })

  if (!useExternalServers) {
    await setupServer([
      {
        command: `cross-env PORT=${APP_PORT} HONEYSTREAM_SIGNAL_SERVER=${SIGNAL_SERVER_URL} yarn start`,
        launchTimeout: SERVER_LAUNCH_TIMEOUT_MS,
        port: Number(APP_PORT),
        usedPortAction: 'error',
        waitOnScheme: {
          resources: [`http-get://localhost:${APP_PORT}/`]
        }
      },
      {
        command: `cross-env SIGNAL_SERVER_PORT=${SIGNAL_SERVER_PORT} yarn start:signal-server`,
        launchTimeout: SERVER_LAUNCH_TIMEOUT_MS,
        port: Number(SIGNAL_SERVER_PORT),
        usedPortAction: 'error',
        waitOnScheme: {
          resources: [`tcp:localhost:${SIGNAL_SERVER_PORT}`]
        }
      }
    ])
  }
}

function releaseServerProcessHandles() {
  const servers = getServers()

  servers.forEach(server => {
    if (!server) return
    if (server.stderr) {
      server.stderr.unpipe(process.stderr)
    }
    destroyChildStream(server.stderr)
    destroyChildStream(server.stdout)
    destroyChildStream(server.stdin)
  })
  servers.splice(0, servers.length)
}

async function teardown(jestConfig = {}) {
  if (!useExternalServers) {
    try {
      await teardownServer()
    } finally {
      releaseServerProcessHandles()
    }
  }
}

module.exports = { setup, teardown }

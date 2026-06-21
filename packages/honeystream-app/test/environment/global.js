const { promises: fs } = require('fs')
const childProcess = require('child_process')
const net = require('net')
const path = require('path')
const { getServers, setup: setupServer } = require('jest-dev-server')
const { removeServerConfig, writeServerConfig } = require('./server-config')

const DEFAULT_APP_PORT = '8080'
const DEFAULT_SIGNAL_SERVER_PORT = '27064'
const MAX_PORT_SEARCH_ATTEMPTS = 100
const SERVER_LAUNCH_TIMEOUT_MS = Number(process.env.HONEYSTREAM_E2E_SERVER_TIMEOUT_MS || 600e3)
const SERVER_TEARDOWN_TIMEOUT_MS = Number(
  process.env.HONEYSTREAM_E2E_SERVER_TEARDOWN_TIMEOUT_MS || 5000
)
const useExternalServers = process.env.HONEYSTREAM_E2E_EXTERNAL_SERVER === 'true'

function parsePort(value, label) {
  const port = Number(value)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${label} must be a valid TCP port, received "${value}".`)
  }

  return port
}

function canBindPort(port, host) {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    let settled = false

    const settle = (callback, value) => {
      if (settled) return
      settled = true
      server.removeAllListeners('error')
      server.removeAllListeners('listening')
      callback(value)
    }

    server.once('error', error => {
      if (error && (error.code === 'EADDRINUSE' || error.code === 'EACCES')) {
        settle(resolve, false)
        return
      }

      settle(reject, error)
    })
    server.once('listening', () => {
      server.close(error => {
        if (error) {
          settle(reject, error)
          return
        }

        settle(resolve, true)
      })
    })
    if (host) {
      server.listen(port, host)
      return
    }
    server.listen(port)
  })
}

async function findAvailablePort(startPort, host, label) {
  const maxPort = Math.min(65535, startPort + MAX_PORT_SEARCH_ATTEMPTS - 1)
  for (let port = startPort; port <= maxPort; port += 1) {
    if (await canBindPort(port, host)) {
      return String(port)
    }
  }

  throw new Error(`${label} could not find a free TCP port from ${startPort} through ${maxPort}.`)
}

async function resolvePort(defaultPort, explicitValue, host, label) {
  const requestedPort = parsePort(explicitValue || defaultPort, label)
  if (explicitValue) {
    return String(requestedPort)
  }

  return findAvailablePort(requestedPort, host, label)
}

async function resolveServerConfig() {
  const appHost = process.env.HONEYSTREAM_E2E_APP_HOST || '127.0.0.1'
  const signalServerHost = process.env.HONEYSTREAM_SIGNAL_SERVER_HOST || '127.0.0.1'
  const appPort = await resolvePort(
    DEFAULT_APP_PORT,
    process.env.HONEYSTREAM_E2E_APP_PORT || process.env.PORT,
    appHost,
    'HONEYSTREAM_E2E_APP_PORT'
  )
  const signalServerPort = await resolvePort(
    DEFAULT_SIGNAL_SERVER_PORT,
    process.env.SIGNAL_SERVER_PORT,
    undefined,
    'SIGNAL_SERVER_PORT'
  )
  const signalServerUrl = `ws://${signalServerHost}:${signalServerPort}`
  const appBaseUrl = process.env.HONEYSTREAM_E2E_APP_URL || `http://${appHost}:${appPort}`

  process.env.HONEYSTREAM_E2E_APP_HOST = appHost
  process.env.HONEYSTREAM_E2E_APP_PORT = appPort
  process.env.HONEYSTREAM_SIGNAL_SERVER_HOST = signalServerHost
  process.env.SIGNAL_SERVER_PORT = signalServerPort
  process.env.HONEYSTREAM_SIGNAL_SERVER = signalServerUrl

  return {
    appHost,
    appBaseUrl,
    appPort,
    signalServerHost,
    signalServerPort,
    signalServerUrl
  }
}

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

function buildAppBundle() {
  const result = childProcess.spawnSync(
    process.execPath,
    ['scripts/e2e-app-server.js', '--build-only'],
    {
      cwd: path.join(__dirname, '../..'),
      env: process.env,
      stdio: 'inherit'
    }
  )

  if (result.error) {
    throw result.error
  }
  if (result.status !== 0) {
    throw new Error(`E2E app bundle build failed with exit code ${result.status}.`)
  }
}

async function setup(jestConfig = {}) {
  await fs.mkdir(path.join(__dirname, '../artifacts'), { recursive: true })
  removeServerConfig()

  if (!useExternalServers) {
    const config = await resolveServerConfig()
    writeServerConfig(config)
    process.env.HOST = config.appHost
    process.env.PUBLIC_HOST = config.appHost
    process.env.PORT = config.appPort
    process.env.HONEYSTREAM_E2E_LOCAL_RTC = process.env.HONEYSTREAM_E2E_LOCAL_RTC || 'true'
    process.env.HONEYSTREAM_E2E_BROADCAST_RTC = process.env.HONEYSTREAM_E2E_BROADCAST_RTC || 'true'
    buildAppBundle()

    await setupServer([
      {
        command: `cross-env HOST=${config.appHost} PUBLIC_HOST=${config.appHost} PORT=${
          config.appPort
        } HONEYSTREAM_SIGNAL_SERVER=${config.signalServerUrl} HONEYSTREAM_E2E_LOCAL_RTC=${
          process.env.HONEYSTREAM_E2E_LOCAL_RTC
        } HONEYSTREAM_E2E_BROADCAST_RTC=${
          process.env.HONEYSTREAM_E2E_BROADCAST_RTC
        } HONEYSTREAM_E2E_SKIP_BUILD=true node scripts/e2e-app-server.js`,
        launchTimeout: SERVER_LAUNCH_TIMEOUT_MS,
        port: Number(config.appPort),
        usedPortAction: 'error',
        waitOnScheme: {
          resources: [`http-get://${config.appHost}:${config.appPort}/`]
        }
      },
      {
        command: `cross-env SIGNAL_SERVER_PORT=${config.signalServerPort} yarn start:signal-server`,
        launchTimeout: SERVER_LAUNCH_TIMEOUT_MS,
        port: Number(config.signalServerPort),
        usedPortAction: 'error',
        waitOnScheme: {
          resources: [`tcp:${config.signalServerHost}:${config.signalServerPort}`]
        }
      }
    ])
  }
}

function releaseServerProcessHandles() {
  const servers = getServers()

  servers.forEach(server => {
    if (!server) return
    server.removeAllListeners('exit')
    server.removeAllListeners('error')
    if (server.stderr) {
      server.stderr.unpipe(process.stderr)
    }
    destroyChildStream(server.stderr)
    destroyChildStream(server.stdout)
    destroyChildStream(server.stdin)
  })
  servers.splice(0, servers.length)
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

async function destroyServerProcesses() {
  const servers = getServers().slice()
  releaseServerProcessHandles()

  await Promise.all(
    servers.map((server, index) =>
      withTimeout(
        () => (server && typeof server.destroy === 'function' ? server.destroy() : undefined),
        `E2E server ${index + 1} teardown`,
        SERVER_TEARDOWN_TIMEOUT_MS
      )
    )
  )
}

async function teardown(jestConfig = {}) {
  if (!useExternalServers) {
    try {
      await destroyServerProcesses()
    } finally {
      releaseServerProcessHandles()
      removeServerConfig()
    }
  }
}

module.exports = { setup, teardown }

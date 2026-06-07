process.env.NODE_ENV = process.env.NODE_ENV || 'development'

const fs = require('fs')
const http = require('http')
const path = require('path')
const webpack = require('webpack')
const WebSocket = require('ws')

const distPath = path.join(__dirname, '../dist')
const bundleFiles = ['index.html', 'app.dev.js']
const buildSignaturePath = path.join(distPath, 'e2e-build-signature.json')
const profileSeedPath = '/__honeystream_e2e_profile_seed__'
const relayPath = '/__honeystream_e2e_peer_relay__'
const defaultRelayGuestPeerTimeoutMs = 15000
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp'
}

function getHost() {
  return process.env.HOST || '127.0.0.1'
}

function getPublicHost() {
  return process.env.PUBLIC_HOST || getHost()
}

function getPort() {
  return Number(process.env.PORT || 8080)
}

function getLatestMtimeMs(targetPath) {
  const stat = fs.statSync(targetPath)
  if (!stat.isDirectory()) {
    return stat.mtimeMs
  }

  return fs.readdirSync(targetPath).reduce((latestMtimeMs, entry) => {
    const childPath = path.join(targetPath, entry)
    return Math.max(latestMtimeMs, getLatestMtimeMs(childPath))
  }, stat.mtimeMs)
}

function getBuildSignature() {
  return {
    HONEYSTREAM_E2E_BROADCAST_RTC: process.env.HONEYSTREAM_E2E_BROADCAST_RTC || '',
    HONEYSTREAM_E2E_LOCAL_RTC: process.env.HONEYSTREAM_E2E_LOCAL_RTC || '',
    HONEYSTREAM_SIGNAL_SERVER: process.env.HONEYSTREAM_SIGNAL_SERVER || '',
    NODE_ENV: process.env.NODE_ENV || ''
  }
}

function hasMatchingBuildSignature() {
  if (!fs.existsSync(buildSignaturePath)) {
    return false
  }

  const expectedSignature = getBuildSignature()
  let actualSignature
  try {
    actualSignature = JSON.parse(fs.readFileSync(buildSignaturePath, 'utf8'))
  } catch (error) {
    console.warn(`Ignoring unreadable E2E build signature: ${error.message}`)
    return false
  }
  return Object.keys(expectedSignature).every(key => actualSignature[key] === expectedSignature[key])
}

function writeBuildSignature() {
  fs.writeFileSync(buildSignaturePath, JSON.stringify(getBuildSignature()), 'utf8')
}

function hasFreshBundle() {
  const bundlePaths = bundleFiles.map(filename => path.join(distPath, filename))
  if (!bundlePaths.every(filepath => fs.existsSync(filepath))) {
    return false
  }
  if (!hasMatchingBuildSignature()) {
    return false
  }

  const indexHtml = fs.readFileSync(bundlePaths[0], 'utf8')
  const expectedScript = `http://${getPublicHost()}:${getPort()}/app.dev.js`
  if (indexHtml.indexOf(expectedScript) === -1) {
    return false
  }

  const bundleMtimeMs = Math.min(...bundlePaths.map(filepath => fs.statSync(filepath).mtimeMs))
  const sourcePaths = [
    path.join(__dirname, '../src'),
    path.join(__dirname, '../public'),
    path.join(__dirname, '../webpack.config.base.js'),
    path.join(__dirname, '../webpack.config.dev.js')
  ]
  const sourceMtimeMs = Math.max(...sourcePaths.map(getLatestMtimeMs))

  return bundleMtimeMs >= sourceMtimeMs
}

function buildApp() {
  if (process.env.HONEYSTREAM_E2E_FORCE_BUILD !== 'true' && hasFreshBundle()) {
    console.log('E2E app bundle is fresh; reusing dist/app.dev.js.')
    return Promise.resolve()
  }

  const webpackConfigPath = require.resolve('../webpack.config.dev')
  const webpackBaseConfigPath = require.resolve('../webpack.config.base')
  delete require.cache[webpackConfigPath]
  delete require.cache[webpackBaseConfigPath]
  const webpackConfig = require(webpackConfigPath)
  const compiler = webpack(webpackConfig)

  return new Promise((resolve, reject) => {
    compiler.run((runError, stats) => {
      const finish = closeError => {
        if (runError) {
          reject(runError)
          return
        }
        if (closeError) {
          reject(closeError)
          return
        }
        if (!stats) {
          reject(new Error('E2E app build did not produce webpack stats.'))
          return
        }
        if (stats.hasErrors()) {
          reject(new Error(stats.toString({ all: false, errors: true })))
          return
        }

        const info = stats.toJson({ all: false, timings: true, warnings: true })
        const warningCount = info.warnings ? info.warnings.length : 0
        writeBuildSignature()
        console.log(`E2E app bundle ready in ${info.time || 0}ms with ${warningCount} warnings.`)
        resolve()
      }

      if (typeof compiler.close === 'function') {
        compiler.close(finish)
        return
      }

      finish()
    })
  })
}

function safeJoinDist(urlPath) {
  const normalizedPath = path.normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '')
  return path.join(distPath, normalizedPath)
}

function sendFile(response, filepath) {
  fs.readFile(filepath, (error, data) => {
    if (error) {
      response.writeHead(error.code === 'ENOENT' ? 404 : 500)
      response.end()
      return
    }

    const contentType = contentTypes[path.extname(filepath)] || 'application/octet-stream'
    response.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': data.length,
      'X-Content-Type-Options': 'nosniff'
    })
    response.end(data)
  })
}

function sendProfileSeedPage(response) {
  const body = '<!doctype html><html><head><meta charset="utf-8"></head><body>profile seed</body></html>'
  response.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'X-Content-Type-Options': 'nosniff'
  })
  response.end(body)
}

function isRelayRole(value) {
  return value === 'guest' || value === 'host'
}

function getRelayGuestPeerTimeoutMs() {
  const configuredValue = Number(process.env.HONEYSTREAM_E2E_RELAY_GUEST_TIMEOUT_MS)
  return Number.isFinite(configuredValue) && configuredValue > 0
    ? configuredValue
    : defaultRelayGuestPeerTimeoutMs
}

function createE2EPeerRelay(server) {
  const rooms = new Map()
  const wsServer = new WebSocket.Server({ server, path: relayPath })
  const guestPeerTimeoutMs = getRelayGuestPeerTimeoutMs()

  const getRoom = roomId => {
    const existingRoom = rooms.get(roomId)
    if (existingRoom) return existingRoom

    const room = {}
    rooms.set(roomId, room)
    return room
  }

  const sendJson = (client, message) => {
    if (client.socket.readyState === WebSocket.OPEN) {
      client.socket.send(JSON.stringify(message))
    }
  }

  const clearPeerUnavailableTimer = client => {
    if (!client.peerUnavailableTimer) return
    clearTimeout(client.peerUnavailableTimer)
    client.peerUnavailableTimer = undefined
  }

  const scheduleGuestPeerUnavailable = client => {
    if (client.role !== 'guest') return
    clearPeerUnavailableTimer(client)
    client.peerUnavailableTimer = setTimeout(() => {
      const room = rooms.get(client.roomId)
      if (!room || room.guest !== client || room.host) return
      sendJson(client, {
        kind: 'peerUnavailable',
        message: 'Network error: e2e relay peer was not found.'
      })
    }, guestPeerTimeoutMs)
  }

  const announcePeerIfReady = room => {
    if (!room.host || !room.guest) return
    clearPeerUnavailableTimer(room.guest)
    sendJson(room.host, { kind: 'peer', peerId: room.guest.peerId })
    sendJson(room.guest, { kind: 'peer', peerId: room.host.peerId })
  }

  const removeClient = client => {
    clearPeerUnavailableTimer(client)
    const room = rooms.get(client.roomId)
    if (!room || room[client.role] !== client) return

    room[client.role] = undefined
    const peer = client.role === 'host' ? room.guest : room.host
    if (peer) sendJson(peer, { kind: 'leave', peerId: client.peerId })
    if (!room.host && !room.guest) rooms.delete(client.roomId)
  }

  const forwardData = (client, rawMessage) => {
    let message
    try {
      message = JSON.parse(rawMessage.toString())
    } catch {
      client.socket.close()
      return
    }
    if (
      !message ||
      message.kind !== 'data' ||
      typeof message.toPeerId !== 'string' ||
      typeof message.envelope !== 'object' ||
      message.envelope === null
    ) {
      client.socket.close()
      return
    }

    const room = rooms.get(client.roomId)
    const peer = room && (client.role === 'host' ? room.guest : room.host)
    if (!peer || peer.peerId !== message.toPeerId) return

    sendJson(peer, {
      kind: 'data',
      fromPeerId: client.peerId,
      envelope: message.envelope
    })
  }

  wsServer.on('connection', (socket, request) => {
    const url = new URL(request.url || relayPath, `http://${getHost()}:${getPort()}`)
    const peerId = url.searchParams.get('peerId') || ''
    const role = url.searchParams.get('role') || ''
    const roomId = url.searchParams.get('roomId') || ''

    if (!isRelayRole(role) || peerId.length === 0 || roomId.length === 0) {
      socket.close()
      return
    }

    const room = getRoom(roomId)
    const previousClient = room[role]
    if (previousClient) previousClient.socket.close()

    const client = { peerId, role, roomId, socket, peerUnavailableTimer: undefined }
    room[role] = client
    socket.on('message', message => forwardData(client, message))
    socket.once('close', () => removeClient(client))
    scheduleGuestPeerUnavailable(client)
    announcePeerIfReady(room)
  })

  return {
    close() {
      wsServer.close()
      rooms.forEach(room => {
        if (room.host) room.host.socket.close()
        if (room.guest) room.guest.socket.close()
      })
      rooms.clear()
    }
  }
}

function createServer() {
  const server = http.createServer((request, response) => {
    if (!request.url) {
      response.writeHead(400)
      response.end()
      return
    }

    const parsedUrl = new URL(request.url, `http://${getHost()}:${getPort()}`)
    if (parsedUrl.pathname === profileSeedPath) {
      sendProfileSeedPage(response)
      return
    }

    const pathname = parsedUrl.pathname === '/' ? '/index.html' : parsedUrl.pathname
    const requestedFile = safeJoinDist(pathname)

    fs.stat(requestedFile, (error, stat) => {
      if (!error && stat.isFile()) {
        sendFile(response, requestedFile)
        return
      }

      sendFile(response, path.join(distPath, 'index.html'))
    })
  })

  const relay = createE2EPeerRelay(server)
  const dispose = () => {
    relay.close()
    server.close(closeError => {
      if (closeError) {
        console.error(closeError)
        process.exitCode = 1
      }
      process.exit()
    })
  }

  process.once('SIGTERM', dispose)
  process.once('SIGINT', dispose)

  server.listen(getPort(), getHost(), () => {
    console.log(`E2E static app server listening at http://${getHost()}:${getPort()}/`)
  })
}

function start() {
  const isBuildOnly = process.argv.indexOf('--build-only') !== -1
  const serverReady = process.env.HONEYSTREAM_E2E_SKIP_BUILD === 'true'
    ? Promise.resolve()
    : buildApp()

  serverReady
    .then(() => {
      if (!isBuildOnly) {
        createServer()
      }
    })
    .catch(error => {
      console.error(error)
      process.exit(1)
    })
}

if (require.main === module) {
  start()
}

module.exports = {
  buildApp,
  createServer,
  start
}

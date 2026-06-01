process.env.NODE_ENV = process.env.NODE_ENV || 'development'

const fs = require('fs')
const http = require('http')
const path = require('path')
const webpack = require('webpack')

const distPath = path.join(__dirname, '../dist')
const bundleFiles = ['index.html', 'app.dev.js']
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

function hasFreshBundle() {
  const bundlePaths = bundleFiles.map(filename => path.join(distPath, filename))
  if (!bundlePaths.every(filepath => fs.existsSync(filepath))) {
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

function createServer() {
  const server = http.createServer((request, response) => {
    if (!request.url) {
      response.writeHead(400)
      response.end()
      return
    }

    const parsedUrl = new URL(request.url, `http://${getHost()}:${getPort()}`)
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

  const dispose = () => {
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

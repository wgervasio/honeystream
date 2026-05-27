const { spawnSync } = require('child_process')

const LEGACY_OPENSSL_FLAG = '--openssl-legacy-provider'
const NODE_MAJOR_VERSION = Number(process.versions.node.split('.')[0])

const [command, ...args] = process.argv.slice(2)

if (!command) {
  throw new Error('with-legacy-openssl requires a command to execute.')
}

const env = { ...process.env }

if (NODE_MAJOR_VERSION >= 17) {
  const existingOptions = env.NODE_OPTIONS || ''
  env.NODE_OPTIONS = existingOptions.includes(LEGACY_OPENSSL_FLAG)
    ? existingOptions
    : `${existingOptions} ${LEGACY_OPENSSL_FLAG}`.trim()
}

const result = spawnSync(command, args, {
  env,
  shell: process.platform === 'win32',
  stdio: 'inherit'
})

if (result.error) {
  throw result.error
}

process.exit(typeof result.status === 'number' ? result.status : 1)

#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')

const requiredFiles = [
  'AGENTS.md',
  '.github/copilot-instructions.md',
  '.github/agents/README.md',
  '.github/agents/architecture-contract.md',
  '.github/agents/coding-standards.md',
  '.github/agents/performance-memory-contract.md',
  '.github/agents/refactor-workflow.md',
  '.github/agents/reasoning-records.md',
  '.github/agents/analyzer-policy.md',
  'docs/architecture-migration-plan.md'
]

const requiredPlanHeadings = [
  '## State ownership model',
  '## State management performance strategy',
  '## Playback clock model',
  '## Protocol design',
  '## Pure and impure boundaries',
  '## Memory and byte management contract',
  '## Rationale records',
  '## Analyzer and enforcement roadmap'
]

const architectureRoots = [
  'packages/honeystream-app/src/domain',
  'packages/honeystream-app/src/protocol',
  'packages/honeystream-app/src/transport',
  'packages/honeystream-app/src/playback',
  'packages/honeystream-app/src/ui',
  'packages/honeystream-signal-server/src/protocol'
]

const ignoredDirs = new Set(['node_modules', 'dist', 'lib', 'coverage', '.git', '.awcache'])
const sourceFilePattern = /\.(ts|tsx|js|jsx)$/

const failures = []
const warnings = []

function rel(filePath) {
  return path.relative(root, filePath).split(path.sep).join('/')
}

function read(filePath) {
  return fs.readFileSync(path.join(root, filePath), 'utf8')
}

function exists(filePath) {
  return fs.existsSync(path.join(root, filePath))
}

function addFailure(filePath, message) {
  failures.push(`${filePath}: ${message}`)
}

function addWarning(filePath, message) {
  warnings.push(`${filePath}: ${message}`)
}

function walk(dirPath, files) {
  if (!fs.existsSync(dirPath)) return files

  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    if (ignoredDirs.has(entry.name)) continue

    const entryPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      walk(entryPath, files)
    } else if (sourceFilePattern.test(entry.name)) {
      files.push(entryPath)
    }
  }

  return files
}

function lineCount(text) {
  if (text.length === 0) return 0
  return text.split(/\r?\n/).length
}

function maxLinesFor(filePath) {
  const file = rel(filePath)
  if (file.includes('/protocol/')) return 180
  if (file.includes('/domain/')) return 220
  if (file.includes('/transport/')) return 260
  if (file.includes('/playback/adapters/')) return 320
  if (file.includes('/playback/engine/')) return 240
  if (file.includes('/ui/')) return 220
  if (/\.(spec|test)\.(ts|tsx|js|jsx)$/.test(file)) return 400
  return 240
}

function containsAny(text, patterns) {
  return patterns.find(pattern => pattern.test(text))
}

function checkRequiredFiles() {
  for (const file of requiredFiles) {
    if (!exists(file)) addFailure(file, 'required architecture file is missing')
  }
}

function checkPackageScripts() {
  const pkg = JSON.parse(read('package.json'))
  const scripts = pkg.scripts || {}
  if (scripts.analyze !== 'node scripts/analyze-architecture.js') {
    addFailure('package.json', 'scripts.analyze must run node scripts/analyze-architecture.js')
  }
  if (scripts['analyze:architecture'] !== 'node scripts/analyze-architecture.js') {
    addFailure(
      'package.json',
      'scripts["analyze:architecture"] must run node scripts/analyze-architecture.js'
    )
  }
}

function checkPlanSections() {
  const planPath = 'docs/architecture-migration-plan.md'
  const text = read(planPath)
  for (const heading of requiredPlanHeadings) {
    if (!text.includes(heading)) {
      addFailure(planPath, `missing required section: ${heading}`)
    }
  }
}

function isPureArchitectureFile(filePath) {
  const file = rel(filePath)
  return file.includes('/domain/') || file.includes('/protocol/')
}

function checkArchitectureFile(filePath) {
  const file = rel(filePath)
  const text = fs.readFileSync(filePath, 'utf8')
  const lines = lineCount(text)
  const maxLines = maxLinesFor(filePath)

  if (lines > maxLines) {
    addFailure(file, `file has ${lines} lines; limit is ${maxLines}`)
  }

  const typeEscapes = [
    /\bas any\b/,
    /\bas unknown as\b/,
    /:\s*any\b/,
    /<any>/,
    /\bFunction\b/,
    /@ts-ignore/,
    /@ts-expect-error/
  ]
  if (containsAny(text, typeEscapes)) {
    addFailure(file, 'type escape detected')
  }

  const reduxImports = [
    /from ['"]redux['"]/,
    /from ['"]react-redux['"]/,
    /from ['"]redux-thunk['"]/,
    /from ['"]connected-react-router['"]/,
    /from ['"][^'"]*reducers[^'"]*['"]/,
    /from ['"][^'"]*actions[^'"]*['"]/
  ]
  if (containsAny(text, reduxImports)) {
    addFailure(file, 'new architecture code must not import legacy Redux actions/reducers')
  }

  const singletonOrMixin = [
    /\bgetInstance\s*\(/,
    /\bstatic\s+\w*instance\b/,
    /\bmixin\b/i,
    /Object\.assign\s*\([^)]*\.prototype/,
    /extends\s+\w*Mixin\b/
  ]
  if (containsAny(text, singletonOrMixin)) {
    addFailure(file, 'use dependency injection/factories instead of singletons or mixins')
  }

  if (isPureArchitectureFile(filePath)) {
    const impurePatterns = [
      /from ['"]react['"]/,
      /from ['"]react-dom['"]/,
      /\bwindow\b/,
      /\bdocument\b/,
      /\bnavigator\b/,
      /\blocalStorage\b/,
      /\bsessionStorage\b/,
      /\bchrome\./,
      /\bWebSocket\b/,
      /\bsimple-peer\b/,
      /\bsetTimeout\s*\(/,
      /\bsetInterval\s*\(/,
      /\bfetch\s*\(/,
      /URL\.createObjectURL/
    ]
    if (containsAny(text, impurePatterns)) {
      addFailure(file, 'pure architecture folders cannot use browser, timer, network, or UI APIs')
    }
  }

  const resourcePatterns = [
    /addEventListener\s*\(/,
    /setTimeout\s*\(/,
    /setInterval\s*\(/,
    /URL\.createObjectURL\s*\(/,
    /new\s+WebSocket\b/,
    /new\s+SimplePeer\b/,
    /new\s+MutationObserver\b/,
    /new\s+ResizeObserver\b/,
    /window\.open\s*\(/
  ]
  const cleanupPatterns = [/\bdispose\s*\(/, /\bdestroy\s*\(/, /\bteardown\s*\(/]
  if (containsAny(text, resourcePatterns) && !containsAny(text, cleanupPatterns)) {
    addFailure(file, 'impure resource usage must have explicit dispose/destroy/teardown cleanup')
  }
}

function checkArchitectureFolders() {
  const files = []
  for (const dir of architectureRoots) {
    walk(path.join(root, dir), files)
  }
  files.forEach(checkArchitectureFile)
}

function checkLegacyHotspots() {
  const legacyFiles = [
    'packages/honeystream-app/src/network/middleware/rpc.ts',
    'packages/honeystream-app/src/network/middleware/sync.ts',
    'packages/honeystream-app/src/components/lobby/VideoPlayer.tsx',
    'packages/honeystream-remote-extension/src/background.js',
    'packages/honeystream-remote-extension/src/player.js'
  ]

  for (const file of legacyFiles) {
    if (!exists(file)) continue
    const lines = lineCount(read(file))
    if (lines > 500) {
      addWarning(file, `legacy hotspot has ${lines} lines; migrate behind typed adapters`)
    }
  }
}

function main() {
  checkRequiredFiles()
  checkPackageScripts()
  checkPlanSections()
  checkArchitectureFolders()
  checkLegacyHotspots()

  if (warnings.length > 0) {
    console.warn('Architecture analyzer warnings:')
    warnings.forEach(warning => console.warn(`  - ${warning}`))
  }

  if (failures.length > 0) {
    console.error('Architecture analyzer failures:')
    failures.forEach(failure => console.error(`  - ${failure}`))
    process.exitCode = 1
    return
  }

  console.log('Architecture analyzer passed.')
}

main()

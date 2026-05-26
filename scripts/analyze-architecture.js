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

const appSourceRoot = 'packages/honeystream-app/src/'
const signalSourceRoot = 'packages/honeystream-signal-server/src/'
const signalProtocolRoot = 'packages/honeystream-signal-server/src/protocol/'

const architectureModuleRoots = [
  { id: 'domain', root: 'packages/honeystream-app/src/domain/' },
  { id: 'protocol', root: 'packages/honeystream-app/src/protocol/' },
  { id: 'transport', root: 'packages/honeystream-app/src/transport/' },
  { id: 'playback-engine', root: 'packages/honeystream-app/src/playback/engine/' },
  { id: 'playback-adapters', root: 'packages/honeystream-app/src/playback/adapters/' },
  { id: 'ui', root: 'packages/honeystream-app/src/ui/' },
  { id: 'signal-protocol', root: 'packages/honeystream-signal-server/src/protocol/' }
]

const allowedImportBoundaries = {
  domain: new Set(['domain', 'protocol']),
  protocol: new Set(['protocol']),
  transport: new Set(['transport', 'protocol']),
  'playback-engine': new Set(['playback-engine', 'playback-adapters', 'domain', 'protocol']),
  'playback-adapters': new Set(['playback-adapters', 'protocol']),
  ui: new Set(['ui', 'domain', 'protocol', 'playback-engine']),
  'signal-protocol': new Set(['signal-protocol'])
}

const analyzerExceptionMarker = 'architecture-analyzer-exception'
const analyzerExceptionRequiredMarkers = [
  'Context:',
  'Invariant:',
  'Options considered:',
  'Decision:',
  'Performance impact:',
  'Memory/lifecycle ownership:',
  'Failure mode:',
  'Validation:',
  'Removal condition:'
]

const knownAnalyzerExceptionRules = new Set([
  'type-escape',
  'legacy-redux-import',
  'singleton-mixin',
  'pure-folder-impure-api',
  'import-boundary',
  'bounded-collection',
  'resource-cleanup-pairs'
])

const resourceCleanupPairs = [
  {
    allocate: /addEventListener\s*\(/,
    hasCleanup(text) {
      return (
        /removeEventListener\s*\(/.test(text) ||
        (/\bAbortController\b/.test(text) && /\babort\s*\(/.test(text))
      )
    },
    message:
      'addEventListener usage requires removeEventListener or AbortController.abort cleanup'
  },
  {
    allocate: /\bsetTimeout\s*\(/,
    hasCleanup(text) {
      return /\bclearTimeout\s*\(/.test(text)
    },
    message: 'setTimeout usage requires clearTimeout cleanup'
  },
  {
    allocate: /\bsetInterval\s*\(/,
    hasCleanup(text) {
      return /\bclearInterval\s*\(/.test(text)
    },
    message: 'setInterval usage requires clearInterval cleanup'
  },
  {
    allocate: /\brequestAnimationFrame\s*\(/,
    hasCleanup(text) {
      return /\bcancelAnimationFrame\s*\(/.test(text)
    },
    message: 'requestAnimationFrame usage requires cancelAnimationFrame cleanup'
  },
  {
    allocate: /URL\.createObjectURL\s*\(/,
    hasCleanup(text) {
      return /URL\.revokeObjectURL\s*\(/.test(text)
    },
    message: 'URL.createObjectURL usage requires URL.revokeObjectURL cleanup'
  },
  {
    allocate: /\bnew\s+MutationObserver\s*\(/,
    hasCleanup(text) {
      return /\.disconnect\s*\(/.test(text)
    },
    message: 'MutationObserver usage requires disconnect cleanup'
  },
  {
    allocate: /\bnew\s+ResizeObserver\s*\(/,
    hasCleanup(text) {
      return /\.disconnect\s*\(/.test(text)
    },
    message: 'ResizeObserver usage requires disconnect cleanup'
  },
  {
    allocate: /\bnew\s+WebSocket\s*\(/,
    hasCleanup(text) {
      return /\.close\s*\(/.test(text)
    },
    message: 'WebSocket usage requires close cleanup'
  },
  {
    allocate: /\bnew\s+SimplePeer\s*\(/,
    hasCleanup(text) {
      return /\.destroy\s*\(/.test(text) || /\.close\s*\(/.test(text)
    },
    message: 'SimplePeer usage requires destroy/close cleanup'
  },
  {
    allocate: /\bwindow\.open\s*\(/,
    hasCleanup(text) {
      return /\.close\s*\(/.test(text)
    },
    message: 'window.open usage requires close cleanup for owned popup handles'
  }
]

const ignoredDirs = new Set(['node_modules', 'dist', 'lib', 'coverage', '.git', '.awcache'])
const sourceFilePattern = /\.(ts|tsx|js|jsx)$/

const failures = []
const warnings = []
const appSourceEntries = readTopLevelEntries(path.join(root, appSourceRoot))
const signalSourceEntries = readTopLevelEntries(path.join(root, signalSourceRoot))

function rel(filePath) {
  return path.relative(root, filePath).split(path.sep).join('/')
}

function toPosix(filePath) {
  return filePath.split(path.sep).join('/')
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

function readTopLevelEntries(dirPath) {
  if (!fs.existsSync(dirPath)) return new Set()
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  return new Set(entries.map(entry => entry.name))
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

function isTestFile(file) {
  return /\.(spec|test)\.(ts|tsx|js|jsx)$/.test(file)
}

function startsWithPathPrefix(filePath, prefix) {
  return filePath === prefix.slice(0, -1) || filePath.startsWith(prefix)
}

function getArchitectureModuleFromRelative(relativePath) {
  for (const moduleRoot of architectureModuleRoots) {
    if (startsWithPathPrefix(relativePath, moduleRoot.root)) {
      return moduleRoot.id
    }
  }

  return null
}

function appModuleFromSpecifier(specifier) {
  if (specifier === 'domain' || specifier.startsWith('domain/')) return 'domain'
  if (specifier === 'protocol' || specifier.startsWith('protocol/')) return 'protocol'
  if (specifier === 'transport' || specifier.startsWith('transport/')) return 'transport'
  if (specifier === 'playback/engine' || specifier.startsWith('playback/engine/')) {
    return 'playback-engine'
  }
  if (specifier === 'playback/adapters' || specifier.startsWith('playback/adapters/')) {
    return 'playback-adapters'
  }
  if (specifier === 'ui' || specifier.startsWith('ui/')) return 'ui'
  return null
}

function resolveImportReference(filePath, specifier) {
  const sourceRelativePath = rel(filePath)

  if (specifier.startsWith('.')) {
    const resolvedPath = path.resolve(path.dirname(filePath), specifier)
    const targetRelativePath = toPosix(path.relative(root, resolvedPath))
    return {
      isLocalImport: true,
      targetRelativePath,
      targetModule: getArchitectureModuleFromRelative(targetRelativePath)
    }
  }

  if (specifier.startsWith('/')) {
    const resolvedPath = path.resolve(root, `.${specifier}`)
    const targetRelativePath = toPosix(path.relative(root, resolvedPath))
    return {
      isLocalImport: true,
      targetRelativePath,
      targetModule: getArchitectureModuleFromRelative(targetRelativePath)
    }
  }

  if (startsWithPathPrefix(sourceRelativePath, appSourceRoot)) {
    const appModule = appModuleFromSpecifier(specifier)
    if (appModule) {
      return {
        isLocalImport: true,
        targetRelativePath: `${appSourceRoot}${specifier}`,
        targetModule: appModule
      }
    }

    const topLevel = specifier.split('/')[0]
    if (appSourceEntries.has(topLevel)) {
      return {
        isLocalImport: true,
        targetRelativePath: `${appSourceRoot}${specifier}`,
        targetModule: getArchitectureModuleFromRelative(`${appSourceRoot}${specifier}`)
      }
    }
  }

  if (startsWithPathPrefix(sourceRelativePath, signalSourceRoot)) {
    if (specifier === 'protocol' || specifier.startsWith('protocol/')) {
      return {
        isLocalImport: true,
        targetRelativePath: `${signalSourceRoot}${specifier}`,
        targetModule: 'signal-protocol'
      }
    }

    const topLevel = specifier.split('/')[0]
    if (signalSourceEntries.has(topLevel)) {
      return {
        isLocalImport: true,
        targetRelativePath: `${signalSourceRoot}${specifier}`,
        targetModule: getArchitectureModuleFromRelative(`${signalSourceRoot}${specifier}`)
      }
    }
  }

  return {
    isLocalImport: false,
    targetRelativePath: null,
    targetModule: null
  }
}

function collectImportSpecifiers(text) {
  const imports = []
  const importPattern =
    /\bimport\s+(?:[^'"`]*?\s+from\s+)?['"]([^'"]+)['"]|\bexport\s+(?:[^'"`]*?\s+from\s+)?['"]([^'"]+)['"]|\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  let match = importPattern.exec(text)

  while (match) {
    const specifier = match[1] || match[2] || match[3] || match[4]
    if (specifier) imports.push(specifier)
    match = importPattern.exec(text)
  }

  return imports
}

function collectAnalyzerExceptions(text) {
  const exceptions = []
  const exceptionPattern = new RegExp(`${analyzerExceptionMarker}\\s*:?\\s*([^\\r\\n*]+)`, 'gi')
  let match = exceptionPattern.exec(text)

  while (match) {
    const rawRules = match[1]
      .split(',')
      .map(rule => rule.trim().toLowerCase())
      .filter(Boolean)
    exceptions.push({
      rules: rawRules,
      snippet: text.slice(match.index, match.index + 2000)
    })
    match = exceptionPattern.exec(text)
  }

  return exceptions
}

function hasAnalyzerException(exceptions, ruleId) {
  return exceptions.some(exception => {
    return exception.rules.includes(ruleId) || exception.rules.includes('all')
  })
}

function addRuleFailure(filePath, ruleId, message, exceptions) {
  if (hasAnalyzerException(exceptions, ruleId)) return
  addFailure(filePath, message)
}

function validateAnalyzerExceptions(filePath, exceptions) {
  for (const exception of exceptions) {
    if (exception.rules.length === 0) {
      addFailure(
        filePath,
        `${analyzerExceptionMarker} must declare at least one rule id (or "all")`
      )
      continue
    }

    for (const rule of exception.rules) {
      if (rule === 'all') continue
      if (!knownAnalyzerExceptionRules.has(rule)) {
        addFailure(filePath, `${analyzerExceptionMarker} references unknown rule "${rule}"`)
      }
    }

    for (const marker of analyzerExceptionRequiredMarkers) {
      if (!exception.snippet.includes(marker)) {
        addFailure(
          filePath,
          `${analyzerExceptionMarker} is missing rationale marker "${marker}" near exception block`
        )
      }
    }
  }
}

function checkImportBoundaries(filePath, text, exceptions) {
  const file = rel(filePath)
  const sourceModule = getArchitectureModuleFromRelative(file)
  const allowedTargets = allowedImportBoundaries[sourceModule]
  if (!sourceModule || !allowedTargets) return

  const imports = collectImportSpecifiers(text)
  for (const specifier of imports) {
    const resolvedImport = resolveImportReference(filePath, specifier)
    if (!resolvedImport.isLocalImport) continue

    if (resolvedImport.targetModule) {
      if (!allowedTargets.has(resolvedImport.targetModule)) {
        addRuleFailure(
          file,
          'import-boundary',
          `import boundary violation: ${sourceModule} must not import ${resolvedImport.targetModule} (${specifier})`,
          exceptions
        )
      }
      continue
    }

    if (!resolvedImport.targetRelativePath) continue

    if (
      sourceModule === 'signal-protocol' &&
      startsWithPathPrefix(resolvedImport.targetRelativePath, signalSourceRoot) &&
      !startsWithPathPrefix(resolvedImport.targetRelativePath, signalProtocolRoot)
    ) {
      addRuleFailure(
        file,
        'import-boundary',
        `import boundary violation: signal protocol files must not import non-protocol modules (${specifier})`,
        exceptions
      )
    }

    if (
      sourceModule !== 'signal-protocol' &&
      startsWithPathPrefix(resolvedImport.targetRelativePath, appSourceRoot)
    ) {
      addRuleFailure(
        file,
        'import-boundary',
        `import boundary violation: ${sourceModule} must not import non-architecture app modules (${specifier})`,
        exceptions
      )
    }
  }
}

function hasCollectionCapHint(text) {
  const capTokens = /\b(max|cap|limit|bounded|lru|ttl|evict|ring)\b/i
  const boundedLength = /\.length\s*[<>]=?\s*(\d+|[A-Za-z_][A-Za-z0-9_]*)/
  const boundedSize = /\.size\s*[<>]=?\s*(\d+|[A-Za-z_][A-Za-z0-9_]*)/
  const truncationPattern = /\.slice\s*\(\s*-\s*(\d+|[A-Za-z_][A-Za-z0-9_]*)\s*\)/
  return capTokens.test(text) || boundedLength.test(text) || boundedSize.test(text) || truncationPattern.test(text)
}

function checkBoundedCollections(filePath, text, exceptions) {
  const file = rel(filePath)
  if (isTestFile(file)) return

  const hasMapOrSetAllocation = /\bnew\s+(Map|Set)\s*\(/.test(text)
  const hasRiskyArrayMutation =
    /(\bqueue\b|\bevents?\b|\bcache\b|\bhistory\b|\bdiagnostics?\b|\bpending\b|\bmessages?\b)[A-Za-z0-9_]*\s*\.\s*(push|unshift|splice)\s*\(/i.test(
      text
    )

  if ((hasMapOrSetAllocation || hasRiskyArrayMutation) && !hasCollectionCapHint(text)) {
    addRuleFailure(
      file,
      'bounded-collection',
      'mutable map/set or stateful array usage should define an explicit cap/eviction guard',
      exceptions
    )
  }
}

function checkResourceCleanupPairs(filePath, text, exceptions) {
  const file = rel(filePath)

  for (const rule of resourceCleanupPairs) {
    if (!rule.allocate.test(text)) continue
    if (rule.hasCleanup(text)) continue

    addRuleFailure(file, 'resource-cleanup-pairs', rule.message, exceptions)
  }
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
  const analyzerExceptions = collectAnalyzerExceptions(text)

  if (lines > maxLines) {
    addFailure(file, `file has ${lines} lines; limit is ${maxLines}`)
  }

  validateAnalyzerExceptions(file, analyzerExceptions)

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
    addRuleFailure(file, 'type-escape', 'type escape detected', analyzerExceptions)
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
    addRuleFailure(
      file,
      'legacy-redux-import',
      'new architecture code must not import legacy Redux actions/reducers',
      analyzerExceptions
    )
  }

  const singletonOrMixin = [
    /\bgetInstance\s*\(/,
    /\bstatic\s+\w*instance\b/,
    /\bmixin\b/i,
    /Object\.assign\s*\([^)]*\.prototype/,
    /extends\s+\w*Mixin\b/
  ]
  if (containsAny(text, singletonOrMixin)) {
    addRuleFailure(
      file,
      'singleton-mixin',
      'use dependency injection/factories instead of singletons or mixins',
      analyzerExceptions
    )
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
      addRuleFailure(
        file,
        'pure-folder-impure-api',
        'pure architecture folders cannot use browser, timer, network, or UI APIs',
        analyzerExceptions
      )
    }
  }

  checkImportBoundaries(filePath, text, analyzerExceptions)
  checkBoundedCollections(filePath, text, analyzerExceptions)
  checkResourceCleanupPairs(filePath, text, analyzerExceptions)
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

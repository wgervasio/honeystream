'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const { createCleanupRegistry } = require('../helpers/cleanup-registry')

test('cleanup registry runs cleanup handlers in reverse order once', () => {
  const registry = createCleanupRegistry()
  const calls = []

  registry.add(() => calls.push('first'))
  registry.add(() => calls.push('second'))

  registry.dispose()
  registry.dispose()

  assert.deepStrictEqual(calls, ['second', 'first'])
})

test('cleanup registry removes registered event listeners on dispose', () => {
  const calls = []
  const target = {
    addEventListener(type, listener, options) {
      calls.push(['add', type, listener, options])
    },
    removeEventListener(type, listener, options) {
      calls.push(['remove', type, listener, options])
    }
  }

  const registry = createCleanupRegistry()
  const listener = () => {}
  registry.addEventListener(target, 'message', listener, true)
  registry.dispose()

  assert.deepStrictEqual(calls, [
    ['add', 'message', listener, true],
    ['remove', 'message', listener, true]
  ])
})

test('cleanup registry clears timeout callbacks when disposed', async () => {
  const registry = createCleanupRegistry()
  let fired = false

  registry.addTimeout(() => {
    fired = true
  }, 20)

  registry.dispose()
  await new Promise(resolve => setTimeout(resolve, 40))

  assert.equal(fired, false)
})

test('cleanup registry runs new cleanup immediately after disposal', () => {
  const registry = createCleanupRegistry()
  let runs = 0

  registry.dispose()
  registry.add(() => {
    runs += 1
  })

  assert.equal(runs, 1)
  assert.equal(registry.isDisposed(), true)
})

'use strict'

// Intentionally not wired into legacy player/background scripts yet.
// This keeps the current runtime behavior unchanged while making listener/timer
// ownership explicit for incremental migration work.
function createCleanupRegistry() {
  const cleanups = []
  let disposed = false

  function add(cleanup) {
    if (typeof cleanup !== 'function') {
      throw new TypeError('cleanup must be a function')
    }

    if (disposed) {
      cleanup()
      return cleanup
    }

    cleanups.push(cleanup)
    return cleanup
  }

  function addEventListener(target, type, listener, options) {
    if (
      !target ||
      typeof target.addEventListener !== 'function' ||
      typeof target.removeEventListener !== 'function'
    ) {
      throw new TypeError('target must support addEventListener/removeEventListener')
    }

    target.addEventListener(type, listener, options)
    return add(() => target.removeEventListener(type, listener, options))
  }

  function addTimeout(callback, delay) {
    if (typeof callback !== 'function') {
      throw new TypeError('callback must be a function')
    }

    const timeoutId = setTimeout(callback, delay)
    return add(() => clearTimeout(timeoutId))
  }

  function addInterval(callback, delay) {
    if (typeof callback !== 'function') {
      throw new TypeError('callback must be a function')
    }

    const intervalId = setInterval(callback, delay)
    return add(() => clearInterval(intervalId))
  }

  function dispose() {
    if (disposed) return
    disposed = true

    while (cleanups.length > 0) {
      const cleanup = cleanups.pop()
      cleanup()
    }
  }

  return {
    add,
    addEventListener,
    addTimeout,
    addInterval,
    dispose,
    isDisposed() {
      return disposed
    }
  }
}

module.exports = {
  createCleanupRegistry
}

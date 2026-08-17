const UNSUPPORTED_CHROMIUM_TARGET_TYPES = ['browser_ui']

function patchUnsupportedChromiumTargets() {
  const { CRBrowser } = require('playwright-core/lib/chromium/crBrowser')
  const prototype = CRBrowser && CRBrowser.prototype
  if (!prototype || prototype.__honeystreamUnsupportedTargetPatch) {
    return
  }

  const originalHandler = prototype._onAttachedToTarget
  Object.defineProperty(prototype, '__honeystreamUnsupportedTargetPatch', {
    configurable: false,
    enumerable: false,
    value: true
  })

  prototype._onAttachedToTarget = function honeystreamOnAttachedToTarget(payload) {
    const targetInfo = payload && payload.targetInfo
    if (targetInfo && UNSUPPORTED_CHROMIUM_TARGET_TYPES.indexOf(targetInfo.type) !== -1) {
      const detach = () =>
        this._session
          .send('Target.detachFromTarget', { sessionId: payload.sessionId })
          .catch(error => {
            console.warn(
              `Ignoring unsupported Chromium target detach failure: ${
                error && error.message ? error.message : error
              }`
            )
          })

      if (payload.waitingForDebugger) {
        const targetSession = this._connection.session(payload.sessionId)
        targetSession
          .send('Runtime.runIfWaitingForDebugger')
          .catch(error => {
            console.warn(
              `Ignoring unsupported Chromium target resume failure: ${
                error && error.message ? error.message : error
              }`
            )
          })
          .then(detach)
        return
      }

      detach()
      return
    }

    return originalHandler.call(this, payload)
  }
}

patchUnsupportedChromiumTargets()

module.exports = { patchUnsupportedChromiumTargets }

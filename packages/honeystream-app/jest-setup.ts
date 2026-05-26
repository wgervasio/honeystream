process.on('unhandledRejection', reason => {
  console.error(reason)
})

const testGlobals = globalThis as typeof globalThis & {
  FEATURE_POPUP_PLAYER: boolean
  FEATURE_RUNTIME_SESSION_SHELL: boolean
  FEATURE_SESSION_BROWSER: boolean
}

testGlobals.FEATURE_SESSION_BROWSER = false
testGlobals.FEATURE_POPUP_PLAYER = true
testGlobals.FEATURE_RUNTIME_SESSION_SHELL = false

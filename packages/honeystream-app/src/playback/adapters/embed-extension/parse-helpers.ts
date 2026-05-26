import { EmbedPlayerSettings, WEBVIEW_INIT_TYPE_PREFIX } from './contracts'
import { EmbedBridgeDiagnosticCode } from './diagnostics'

export type UnknownRecord = { readonly [key: string]: unknown }

export type EmbedBridgeParseSuccess<T> = {
  readonly ok: true
  readonly value: T
}

export type EmbedBridgeParseFailure = {
  readonly ok: false
  readonly code: EmbedBridgeDiagnosticCode
  readonly reason: string
  readonly rawType?: string
}

export type EmbedBridgeParseResult<T> = EmbedBridgeParseSuccess<T> | EmbedBridgeParseFailure

const PLAYER_SETTING_KEYS = [
  'autoFullscreen',
  'theaterMode',
  'mediaSessionProxy',
  'syncOnBuffer',
  'seekThreshold',
  'theaterModeSelectors'
]

export const success = <T>(value: T): EmbedBridgeParseSuccess<T> => ({ ok: true, value })

export const failure = (
  code: EmbedBridgeDiagnosticCode,
  reason: string,
  rawType?: string
): EmbedBridgeParseFailure => ({ ok: false, code, reason, rawType })

export const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

export const isNonNegativeInteger = (value: unknown): value is number =>
  isFiniteNumber(value) && Number.isInteger(value) && value >= 0

export const getTypeField = (value: UnknownRecord): EmbedBridgeParseResult<string> => {
  if (typeof value.type !== 'string') {
    return failure('invalid-message-type', 'Message "type" must be a string')
  }

  return success(value.type)
}

export const parseNavigationPayload = (
  payload: unknown,
  messageType: string
): EmbedBridgeParseResult<{ readonly url: string }> => {
  if (!isRecord(payload) || typeof payload.url !== 'string' || payload.url.length === 0) {
    return failure('invalid-message-payload', `Expected ${messageType}.payload.url to be a string`)
  }

  return success({ url: payload.url })
}

export const parseWebviewId = (messageType: string): EmbedBridgeParseResult<number> => {
  const suffix = messageType.slice(WEBVIEW_INIT_TYPE_PREFIX.length)
  if (!/^\d+$/.test(suffix)) {
    return failure(
      'invalid-webview-id',
      `${WEBVIEW_INIT_TYPE_PREFIX} messages must end with a numeric id`,
      messageType
    )
  }

  const webviewId = Number(suffix)
  if (!Number.isSafeInteger(webviewId) || webviewId < 0) {
    return failure('invalid-webview-id', 'Webview id must be a non-negative integer', messageType)
  }

  return success(webviewId)
}

export const parseWebviewInitPayload = (
  payload: unknown,
  rawType: string
): EmbedBridgeParseResult<{ readonly tabId: number; readonly frameId: number }> => {
  if (!isRecord(payload)) {
    return failure('invalid-message-payload', 'Webview init payload must be an object', rawType)
  }

  if (!isNonNegativeInteger(payload.tabId) || !isNonNegativeInteger(payload.frameId)) {
    return failure(
      'invalid-message-payload',
      'Webview init payload must include non-negative integer tabId and frameId',
      rawType
    )
  }

  return success({ tabId: payload.tabId, frameId: payload.frameId })
}

export const parsePlayerSettings = (
  payload: unknown,
  rawType: string
): EmbedBridgeParseResult<EmbedPlayerSettings> => {
  if (!isRecord(payload)) {
    return failure('invalid-message-payload', 'set-settings payload must be an object', rawType)
  }

  for (const key of Object.keys(payload)) {
    if (PLAYER_SETTING_KEYS.indexOf(key) === -1) {
      return failure('invalid-message-payload', `Unknown player setting key "${key}"`, rawType)
    }
  }

  const autoFullscreen = payload.autoFullscreen
  if (typeof autoFullscreen !== 'undefined' && typeof autoFullscreen !== 'boolean') {
    return failure('invalid-message-payload', 'autoFullscreen must be boolean', rawType)
  }

  const theaterMode = payload.theaterMode
  if (typeof theaterMode !== 'undefined' && typeof theaterMode !== 'boolean') {
    return failure('invalid-message-payload', 'theaterMode must be boolean', rawType)
  }

  const mediaSessionProxy = payload.mediaSessionProxy
  if (typeof mediaSessionProxy !== 'undefined' && typeof mediaSessionProxy !== 'boolean') {
    return failure('invalid-message-payload', 'mediaSessionProxy must be boolean', rawType)
  }

  const syncOnBuffer = payload.syncOnBuffer
  if (typeof syncOnBuffer !== 'undefined' && typeof syncOnBuffer !== 'boolean') {
    return failure('invalid-message-payload', 'syncOnBuffer must be boolean', rawType)
  }

  const seekThreshold = payload.seekThreshold
  if (typeof seekThreshold !== 'undefined' && !isFiniteNumber(seekThreshold)) {
    return failure('invalid-message-payload', 'seekThreshold must be a number', rawType)
  }

  let theaterModeSelectors: string[] | undefined
  if (typeof payload.theaterModeSelectors !== 'undefined') {
    if (!Array.isArray(payload.theaterModeSelectors)) {
      return failure('invalid-message-payload', 'theaterModeSelectors must be an array', rawType)
    }

    theaterModeSelectors = []
    for (const selector of payload.theaterModeSelectors) {
      if (typeof selector !== 'string') {
        return failure('invalid-message-payload', 'theaterModeSelectors must contain strings', rawType)
      }
      theaterModeSelectors.push(selector)
    }
  }

  return success({
    autoFullscreen,
    theaterMode,
    mediaSessionProxy,
    syncOnBuffer,
    seekThreshold,
    theaterModeSelectors
  })
}

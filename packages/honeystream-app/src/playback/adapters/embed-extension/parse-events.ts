import {
  EmbedHostToPlayerEvent,
  EmbedPlayerToHostEvent,
  EmbedWebviewControlEvent,
  EmbedWebviewLifecycleEvent,
  HOST_EVENT_TYPE
} from './contracts'
import {
  EmbedBridgeParseResult,
  failure,
  getTypeField,
  isFiniteNumber,
  isNonNegativeInteger,
  isRecord,
  parseNavigationPayload,
  parsePlayerSettings,
  success
} from './parse-helpers'

const isPlaybackChangeState = (value: unknown): value is 'playing' | 'paused' | 'ended' =>
  value === 'playing' || value === 'paused' || value === 'ended'

const parseHostToPlayerEvent = (
  payload: unknown,
  rawType: string
): EmbedBridgeParseResult<EmbedHostToPlayerEvent> => {
  if (!isRecord(payload)) {
    return failure('invalid-message-payload', 'Host event payload must be an object', rawType)
  }

  const typeResult = getTypeField(payload)
  if (!typeResult.ok) return typeResult
  const type = typeResult.value

  switch (type) {
    case 'set-media-playback':
      if (payload.payload !== 0 && payload.payload !== 1 && payload.payload !== 2) {
        return failure(
          'invalid-message-payload',
          'set-media-playback payload must be 0, 1, or 2',
          rawType
        )
      }
      return success({ type, payload: payload.payload })
    case 'seek-media':
    case 'set-media-volume':
    case 'set-media-playback-rate':
      if (!isFiniteNumber(payload.payload)) {
        return failure('invalid-message-payload', `${type} payload must be a number`, rawType)
      }
      return success({ type, payload: payload.payload })
    case 'set-interact':
      if (typeof payload.payload !== 'boolean') {
        return failure('invalid-message-payload', 'set-interact payload must be boolean', rawType)
      }
      return success({ type, payload: payload.payload })
    case 'apply-fullscreen':
      if (typeof payload.payload !== 'string' || payload.payload.length === 0) {
        return failure('invalid-message-payload', 'apply-fullscreen payload must be a URL string', rawType)
      }
      return success({ type, payload: payload.payload })
    case 'set-settings': {
      const settingsResult = parsePlayerSettings(payload.payload, rawType)
      if (!settingsResult.ok) return settingsResult
      return success({ type, payload: settingsResult.value })
    }
    default:
      return failure('unsupported-message-type', `Unsupported host event type "${type}"`, rawType)
  }
}

export const parseWebviewControlEvent = (
  payload: unknown,
  rawType: string
): EmbedBridgeParseResult<EmbedWebviewControlEvent> => {
  if (!isRecord(payload)) {
    return failure('invalid-message-payload', 'Webview control payload must be an object', rawType)
  }

  const typeResult = getTypeField(payload)
  if (!typeResult.ok) return typeResult
  const type = typeResult.value

  switch (type) {
    case 'navigate':
      if (!isFiniteNumber(payload.payload) || !Number.isInteger(payload.payload)) {
        return failure('invalid-message-payload', 'navigate payload must be an integer', rawType)
      }
      return success({ type, payload: payload.payload })
    case 'reload':
      if (typeof payload.payload !== 'undefined' && typeof payload.payload !== 'boolean') {
        return failure('invalid-message-payload', 'reload payload must be boolean if provided', rawType)
      }
      return success({ type, payload: payload.payload })
    case 'stop':
      return success({ type })
    case HOST_EVENT_TYPE: {
      const hostEventResult = parseHostToPlayerEvent(payload.payload, rawType)
      if (!hostEventResult.ok) return hostEventResult
      return success({ type, payload: hostEventResult.value })
    }
    default:
      return failure('unsupported-message-type', `Unsupported webview control type "${type}"`, rawType)
  }
}

const parsePlayerToHostEvent = (
  payload: unknown,
  rawType: string
): EmbedBridgeParseResult<EmbedPlayerToHostEvent> => {
  if (!isRecord(payload)) {
    return failure('invalid-message-payload', 'Player event payload must be an object', rawType)
  }

  const typeResult = getTypeField(payload)
  if (!typeResult.ok) return typeResult
  const type = typeResult.value

  switch (type) {
    case 'media-ready':
      if (!isRecord(payload.payload) || typeof payload.payload.href !== 'string') {
        return failure('invalid-message-payload', 'media-ready payload must include href', rawType)
      }
      if (
        typeof payload.payload.duration !== 'undefined' &&
        !isFiniteNumber(payload.payload.duration)
      ) {
        return failure('invalid-message-payload', 'media-ready duration must be a number', rawType)
      }
      return success({
        type,
        payload: { href: payload.payload.href, duration: payload.payload.duration }
      })
    case 'media-autoplay-error':
      if (!isRecord(payload.payload) || typeof payload.payload.error !== 'string') {
        return failure('invalid-message-payload', 'media-autoplay-error payload must include error', rawType)
      }
      return success({ type, payload: { error: payload.payload.error } })
    case 'media-seeked':
    case 'media-time-update':
      if (!isFiniteNumber(payload.payload)) {
        return failure('invalid-message-payload', `${type} payload must be a number`, rawType)
      }
      return success({ type, payload: payload.payload })
    case 'media-volume-change':
    case 'media-playback-rate-change':
      if (!isRecord(payload.payload) || !isFiniteNumber(payload.payload.value)) {
        return failure('invalid-message-payload', `${type} payload.value must be a number`, rawType)
      }
      return success({ type, payload: { value: payload.payload.value } })
    case 'media-playback-change':
      if (
        !isRecord(payload.payload) ||
        !isPlaybackChangeState(payload.payload.state) ||
        !isFiniteNumber(payload.payload.time) ||
        typeof payload.payload.isTrusted !== 'boolean'
      ) {
        return failure(
          'invalid-message-payload',
          'media-playback-change payload must include state, time, and isTrusted',
          rawType
        )
      }
      return success({
        type,
        payload: {
          state: payload.payload.state,
          time: payload.payload.time,
          isTrusted: payload.payload.isTrusted
        }
      })
    case 'media-metadata-change':
      if (typeof payload.payload === 'undefined') {
        return success({ type })
      }
      if (!isRecord(payload.payload)) {
        return failure('invalid-message-payload', 'media-metadata-change payload must be an object', rawType)
      }
      return success({ type, payload: { ...payload.payload } })
    default:
      return failure('unsupported-message-type', `Unsupported player event type "${type}"`, rawType)
  }
}

export const parseWebviewLifecycleEvent = (
  payload: unknown,
  rawType: string
): EmbedBridgeParseResult<EmbedWebviewLifecycleEvent> => {
  if (!isRecord(payload)) {
    return failure('invalid-message-payload', 'Webview event payload must be an object', rawType)
  }

  const typeResult = getTypeField(payload)
  if (!typeResult.ok) return typeResult
  const type = typeResult.value

  switch (type) {
    case 'load-script':
      return success({ type })
    case 'activity':
      if (typeof payload.payload !== 'string') {
        return failure('invalid-message-payload', 'activity payload must be a string', rawType)
      }
      return success({ type, payload: payload.payload })
    case 'message': {
      const playerEventResult = parsePlayerToHostEvent(payload.payload, rawType)
      if (!playerEventResult.ok) return playerEventResult
      return success({ type, payload: playerEventResult.value })
    }
    case 'will-navigate':
    case 'did-navigate':
    case 'did-navigate-in-page': {
      const navResult = parseNavigationPayload(payload.payload, type)
      if (!navResult.ok) return navResult
      return success({ type, payload: navResult.value })
    }
    default:
      return failure('unsupported-message-type', `Unsupported webview event type "${type}"`, rawType)
  }
}

export const parseFramePath = (
  framePath: unknown,
  rawType: string
): EmbedBridgeParseResult<readonly number[]> => {
  if (!Array.isArray(framePath) || framePath.length === 0) {
    return failure('invalid-message-payload', 'framePath must be a non-empty array', rawType)
  }

  const parsedFramePath: number[] = []
  for (const frameId of framePath) {
    if (!isNonNegativeInteger(frameId)) {
      return failure('invalid-message-payload', 'framePath must contain non-negative integers', rawType)
    }

    parsedFramePath.push(frameId)
  }

  return success(parsedFramePath)
}

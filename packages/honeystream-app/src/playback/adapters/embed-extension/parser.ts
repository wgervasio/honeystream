import {
  EmbedBridgeInboundContext,
  EmbedBridgeWindowEvent,
  EmbedExtensionInboundMessage,
  EmbedExtensionOutboundMessage,
  EmbedFrameOwnership,
  WEBVIEW_EVENT_TYPE,
  WEBVIEW_INIT_TYPE_PREFIX
} from './contracts'
import { EmbedBridgeDiagnostic } from './diagnostics'
import {
  EmbedBridgeParseFailure,
  EmbedBridgeParseResult,
  EmbedBridgeParseSuccess,
  failure,
  getTypeField,
  isNonNegativeInteger,
  isRecord,
  parseWebviewId,
  parseWebviewInitPayload,
  success
} from './parse-helpers'
import { parseFramePath, parseWebviewControlEvent, parseWebviewLifecycleEvent } from './parse-events'

export type { EmbedBridgeParseFailure, EmbedBridgeParseResult, EmbedBridgeParseSuccess }

export const parseEmbedExtensionOutboundMessage = (
  input: unknown
): EmbedBridgeParseResult<EmbedExtensionOutboundMessage> => {
  if (!isRecord(input)) {
    return failure('invalid-message-shape', 'Outbound message must be an object')
  }

  const typeResult = getTypeField(input)
  if (!typeResult.ok) return typeResult
  const type = typeResult.value
  if (type !== WEBVIEW_EVENT_TYPE) {
    return failure('unsupported-message-type', `Unsupported outbound message type "${type}"`, type)
  }

  if (!isNonNegativeInteger(input.tabId)) {
    return failure('invalid-message-payload', 'Outbound message tabId must be a non-negative integer', type)
  }

  if (typeof input.frameId !== 'undefined' && !isNonNegativeInteger(input.frameId)) {
    return failure(
      'invalid-message-payload',
      'Outbound message frameId must be a non-negative integer when provided',
      type
    )
  }

  const payloadResult = parseWebviewControlEvent(input.payload, type)
  if (!payloadResult.ok) return payloadResult

  return success({
    type,
    payload: payloadResult.value,
    tabId: input.tabId,
    frameId: input.frameId
  })
}

export const parseEmbedExtensionInboundMessage = (
  input: unknown
): EmbedBridgeParseResult<EmbedExtensionInboundMessage> => {
  if (!isRecord(input)) {
    return failure('invalid-message-shape', 'Inbound message must be an object')
  }

  const typeResult = getTypeField(input)
  if (!typeResult.ok) return typeResult
  const type = typeResult.value

  if (type.indexOf(WEBVIEW_INIT_TYPE_PREFIX) === 0) {
    const webviewIdResult = parseWebviewId(type)
    if (!webviewIdResult.ok) return webviewIdResult

    const payloadResult = parseWebviewInitPayload(input.payload, type)
    if (!payloadResult.ok) return payloadResult

    return success({
      kind: 'webview-init',
      webviewId: webviewIdResult.value,
      tabId: payloadResult.value.tabId,
      frameId: payloadResult.value.frameId
    })
  }

  if (type !== WEBVIEW_EVENT_TYPE) {
    return failure('unsupported-message-type', `Unsupported inbound message type "${type}"`, type)
  }

  const framePathResult = parseFramePath(input.framePath, type)
  if (!framePathResult.ok) return framePathResult

  const eventResult = parseWebviewLifecycleEvent(input.payload, type)
  if (!eventResult.ok) return eventResult

  return success({
    kind: 'webview-event',
    framePath: framePathResult.value,
    event: eventResult.value
  })
}

export const isOwnedFramePath = (
  framePath: readonly number[],
  ownership: EmbedFrameOwnership
): boolean => {
  if (framePath.length === 0 || framePath[0] !== 0) return false
  if (ownership.popup) return true
  return framePath.length > 1 && framePath[1] === ownership.frameId
}

export const parseOwnedInboundMessage = (
  event: EmbedBridgeWindowEvent,
  context: EmbedBridgeInboundContext
): EmbedBridgeParseResult<EmbedExtensionInboundMessage> => {
  if (event.origin !== context.allowedOrigin) {
    return failure(
      'invalid-origin',
      `Inbound event origin must match ${context.allowedOrigin}. Received: ${event.origin}`
    )
  }

  const parsed = parseEmbedExtensionInboundMessage(event.data)
  if (!parsed.ok) return parsed

  if (parsed.value.kind === 'webview-init') {
    if (parsed.value.webviewId !== context.ownership.webviewId) {
      return failure(
        'invalid-webview-id',
        `Expected webview id ${context.ownership.webviewId}, received ${parsed.value.webviewId}`,
        WEBVIEW_INIT_TYPE_PREFIX
      )
    }
    return parsed
  }

  if (!isOwnedFramePath(parsed.value.framePath, context.ownership)) {
    return failure(
      'invalid-frame-ownership',
      `Frame path [${parsed.value.framePath.join(', ')}] is outside owned frame ${context.ownership.frameId}`,
      WEBVIEW_EVENT_TYPE
    )
  }

  return parsed
}

export const toEmbedBridgeDiagnostic = (
  parseFailure: EmbedBridgeParseFailure,
  direction: 'inbound' | 'outbound',
  receivedAtMs: number = Date.now()
): EmbedBridgeDiagnostic => ({
  code: parseFailure.code,
  direction,
  reason: parseFailure.reason,
  rawType: parseFailure.rawType,
  receivedAtMs
})

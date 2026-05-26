import {
  WEBVIEW_EVENT_TYPE,
  WEBVIEW_INIT_TYPE_PREFIX,
  EmbedBridgeInboundContext
} from './contracts'
import { EmbedBridgeDiagnostics } from './diagnostics'
import {
  EmbedBridgeParseResult,
  parseEmbedExtensionInboundMessage,
  parseEmbedExtensionOutboundMessage,
  parseOwnedInboundMessage
} from './parser'

const expectOk = <T>(result: EmbedBridgeParseResult<T>): T => {
  expect(result.ok).toBe(true)
  if (!result.ok) {
    throw new Error(result.reason)
  }

  return result.value
}

describe('embed-extension bridge parser', () => {
  const context: EmbedBridgeInboundContext = {
    allowedOrigin: 'https://app.gethoneystream.com',
    ownership: {
      webviewId: 7,
      frameId: 42,
      popup: false
    }
  }

  test('parses webview init messages with strict ids', () => {
    const parsed = expectOk(
      parseEmbedExtensionInboundMessage({
        type: `${WEBVIEW_INIT_TYPE_PREFIX}7`,
        payload: { tabId: 101, frameId: 42 }
      })
    )

    expect(parsed).toEqual({
      kind: 'webview-init',
      webviewId: 7,
      tabId: 101,
      frameId: 42
    })
  })

  test('parses nested webview message events', () => {
    const parsed = expectOk(
      parseEmbedExtensionInboundMessage({
        type: WEBVIEW_EVENT_TYPE,
        framePath: [0, 42],
        payload: {
          type: 'message',
          payload: {
            type: 'media-ready',
            payload: {
              href: 'https://example.com/watch',
              duration: 12345
            }
          }
        }
      })
    )

    expect(parsed.kind).toBe('webview-event')
    if (parsed.kind !== 'webview-event') return
    expect(parsed.event.type).toBe('message')
    if (parsed.event.type !== 'message') return
    expect(parsed.event.payload.type).toBe('media-ready')
  })

  test('rejects inbound messages from unexpected origins', () => {
    const parsed = parseOwnedInboundMessage(
      {
        origin: 'https://malicious.example',
        data: {
          type: `${WEBVIEW_INIT_TYPE_PREFIX}7`,
          payload: { tabId: 101, frameId: 42 }
        }
      },
      context
    )

    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.code).toBe('invalid-origin')
  })

  test('rejects non-owned frame paths for non-popup ownership', () => {
    const parsed = parseOwnedInboundMessage(
      {
        origin: context.allowedOrigin,
        data: {
          type: WEBVIEW_EVENT_TYPE,
          framePath: [0, 999],
          payload: { type: 'load-script' }
        }
      },
      context
    )

    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.code).toBe('invalid-frame-ownership')
  })

  test('parses outbound host-event payloads', () => {
    const parsed = expectOk(
      parseEmbedExtensionOutboundMessage({
        type: WEBVIEW_EVENT_TYPE,
        tabId: 101,
        frameId: 42,
        payload: {
          type: 'honeystream-host-event',
          payload: {
            type: 'set-settings',
            payload: {
              autoFullscreen: true,
              syncOnBuffer: false,
              theaterModeSelectors: ['#player']
            }
          }
        }
      })
    )

    expect(parsed.payload.type).toBe('honeystream-host-event')
    if (parsed.payload.type !== 'honeystream-host-event') return
    expect(parsed.payload.payload.type).toBe('set-settings')
  })

  test('keeps diagnostics bounded', () => {
    const diagnostics = new EmbedBridgeDiagnostics(2)

    diagnostics.push({
      code: 'invalid-message-shape',
      direction: 'inbound',
      reason: 'first',
      receivedAtMs: 1
    })
    diagnostics.push({
      code: 'invalid-origin',
      direction: 'inbound',
      reason: 'second',
      receivedAtMs: 2
    })
    diagnostics.push({
      code: 'unsupported-message-type',
      direction: 'inbound',
      reason: 'third',
      receivedAtMs: 3
    })

    expect(diagnostics.size).toBe(2)
    expect(diagnostics.snapshot().map(diagnostic => diagnostic.reason)).toEqual(['second', 'third'])
  })
})

import {
  EmbedExtensionAdapter,
  EmbedExtensionMediaEvent,
  EmbedExtensionMessageTarget,
  EmbedExtensionOutboundDispatcher
} from './EmbedExtensionAdapter'
import { createEmbedExtensionAdapterFactory } from './EmbedExtensionAdapterFactory'
import {
  EmbedBridgeWindowEvent,
  EmbedExtensionOutboundMessage,
  EmbedFrameOwnership,
  WEBVIEW_EVENT_TYPE,
  WEBVIEW_INIT_TYPE_PREFIX
} from './contracts'

type MessageListener = (event: EmbedBridgeWindowEvent) => void

class TestMessageTarget implements EmbedExtensionMessageTarget {
  readonly addCalls: Array<boolean | AddEventListenerOptions | undefined> = []
  readonly removeCalls: Array<boolean | EventListenerOptions | undefined> = []
  private readonly listeners = new Set<MessageListener>()

  addEventListener(
    type: 'message',
    listener: MessageListener,
    options?: boolean | AddEventListenerOptions
  ): void {
    this.addCalls.push(options)
    this.listeners.add(listener)
  }

  removeEventListener(
    type: 'message',
    listener: MessageListener,
    options?: boolean | EventListenerOptions
  ): void {
    this.removeCalls.push(options)
    this.listeners.delete(listener)
  }

  emit(event: EmbedBridgeWindowEvent): void {
    for (const listener of Array.from(this.listeners)) {
      listener(event)
    }
  }
}

const createOwnership = (): EmbedFrameOwnership => ({
  webviewId: 7,
  frameId: -1,
  popup: false
})

const createMedia = (source: 'website' | 'direct-media' | 'local-file' = 'website') => ({
  mediaId: 'media-1',
  source,
  url: 'https://example.com/watch'
})

const createPlayback = (overrides: Partial<{ state: 'idle' | 'playing' | 'paused' }> = {}) => ({
  state: overrides.state || ('playing' as const),
  positionMs: 2500,
  updatedAtHostMs: 10000,
  rate: 1.25,
  durationMs: 120000
})

const createHarness = (overrides?: {
  diagnosticsLimit?: number
  dispatchToAllFrames?: boolean
  routing?: { readonly tabId: number; readonly frameId: number }
}) => {
  const target = new TestMessageTarget()
  const dispatched: EmbedExtensionOutboundMessage[] = []
  const outbound: EmbedExtensionOutboundDispatcher = {
    dispatch(message) {
      dispatched.push(message)
    }
  }

  const adapter = new EmbedExtensionAdapter({
    allowedOrigin: 'https://app.gethoneystream.com',
    ownership: createOwnership(),
    messageTarget: target,
    outbound,
    diagnosticsLimit: overrides && overrides.diagnosticsLimit,
    dispatchToAllFrames: overrides && overrides.dispatchToAllFrames,
    routing: overrides && overrides.routing
  })

  return {
    adapter,
    target,
    dispatched
  }
}

describe('EmbedExtensionAdapter', () => {
  it('removes message listener on dispose', () => {
    const { adapter, target } = createHarness()

    expect(target.addCalls).toEqual([undefined])

    adapter.dispose()
    adapter.dispose()

    expect(target.removeCalls).toEqual([undefined])
  })

  it('parses inbound media messages and emits typed events', () => {
    const { adapter, target } = createHarness()
    const events: EmbedExtensionMediaEvent[] = []
    adapter.onMediaEvent(event => {
      events.push(event)
    })

    target.emit({
      origin: 'https://app.gethoneystream.com',
      data: {
        type: `${WEBVIEW_INIT_TYPE_PREFIX}7`,
        payload: { tabId: 9, frameId: 42 }
      }
    })

    target.emit({
      origin: 'https://app.gethoneystream.com',
      data: {
        type: WEBVIEW_EVENT_TYPE,
        framePath: [0, 42],
        payload: {
          type: 'message',
          payload: {
            type: 'media-playback-change',
            payload: {
              state: 'playing',
              time: 1400,
              isTrusted: true
            }
          }
        }
      }
    })

    expect(events).toHaveLength(1)
    expect(events[0].playerEvent.type).toBe('media-playback-change')
    expect(events[0].framePath).toEqual([0, 42])
    expect(events[0].isTopSubFrame).toBe(true)
  })

  it('dispatches typed outbound host events for desired playback commands', () => {
    const { adapter, target, dispatched } = createHarness({ dispatchToAllFrames: false })

    target.emit({
      origin: 'https://app.gethoneystream.com',
      data: {
        type: `${WEBVIEW_INIT_TYPE_PREFIX}7`,
        payload: { tabId: 101, frameId: 42 }
      }
    })

    adapter.loadMedia({ media: createMedia('website') })
    adapter.applyPlayback({
      desiredPlayback: createPlayback({ state: 'paused' }),
      seekToleranceMs: 180
    })

    expect(dispatched).toHaveLength(3)
    expect(dispatched[0]).toMatchObject({
      type: WEBVIEW_EVENT_TYPE,
      tabId: 101,
      frameId: 42,
      payload: {
        type: 'honeystream-host-event',
        payload: {
          type: 'set-media-playback',
          payload: 2
        }
      }
    })
    expect(dispatched[1]).toMatchObject({
      payload: {
        type: 'honeystream-host-event',
        payload: {
          type: 'seek-media',
          payload: 2500
        }
      }
    })
    expect(dispatched[2]).toMatchObject({
      payload: {
        type: 'honeystream-host-event',
        payload: {
          type: 'set-media-playback-rate',
          payload: 1.25
        }
      }
    })
  })

  it('keeps diagnostics bounded when inbound parsing fails', () => {
    const { adapter, target } = createHarness({ diagnosticsLimit: 2 })

    target.emit({
      origin: 'https://malicious.example',
      data: {
        type: `${WEBVIEW_INIT_TYPE_PREFIX}7`,
        payload: { tabId: 9, frameId: 42 }
      }
    })
    target.emit({
      origin: 'https://app.gethoneystream.com',
      data: 'not-a-valid-message'
    })
    target.emit({
      origin: 'https://app.gethoneystream.com',
      data: { type: 'honeystream-unknown-message' }
    })

    expect(adapter.diagnosticCount).toBe(2)
    expect(adapter.diagnosticsSnapshot().map(diagnostic => diagnostic.code)).toEqual([
      'invalid-message-shape',
      'unsupported-message-type'
    ])
  })

  it('throws when applying playback before bridge routing is available', () => {
    const { adapter } = createHarness()
    adapter.loadMedia({ media: createMedia('website') })

    expect(() =>
      adapter.applyPlayback({
        desiredPlayback: createPlayback(),
        seekToleranceMs: 250
      })
    ).toThrow('routing is unavailable')
  })
})

describe('createEmbedExtensionAdapterFactory', () => {
  it('creates adapters for embed-supported media and rejects unsupported local-file media', () => {
    const target = new TestMessageTarget()
    const outbound: EmbedExtensionOutboundDispatcher = {
      dispatch() {
        return
      }
    }

    const factory = createEmbedExtensionAdapterFactory({
      allowedOrigin: 'https://app.gethoneystream.com',
      messageTarget: target,
      outbound,
      resolveOwnership() {
        return {
          webviewId: 5,
          frameId: 10,
          popup: false
        }
      }
    })

    const adapter = factory.createAdapter(createMedia('website'))
    expect(adapter.kind).toBe('embed-extension')
    adapter.dispose()

    expect(() => factory.createAdapter(createMedia('local-file'))).toThrow('does not support media')
  })
})

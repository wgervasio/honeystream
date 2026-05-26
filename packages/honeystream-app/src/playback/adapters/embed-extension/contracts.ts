export const WEBVIEW_INIT_TYPE_PREFIX = 'honeystream-webview-init'
export const WEBVIEW_EVENT_TYPE = 'honeystream-webview-event'
export const HOST_EVENT_TYPE = 'honeystream-host-event'
export const EMBED_BRIDGE_DIAGNOSTIC_LIMIT = 64

export type PlaybackStateCode = 0 | 1 | 2

export type EmbedPlayerSettings = {
  readonly autoFullscreen?: boolean
  readonly theaterMode?: boolean
  readonly mediaSessionProxy?: boolean
  readonly syncOnBuffer?: boolean
  readonly seekThreshold?: number
  readonly theaterModeSelectors?: readonly string[]
}

export type EmbedHostToPlayerEvent =
  | { readonly type: 'set-media-playback'; readonly payload: PlaybackStateCode }
  | { readonly type: 'seek-media'; readonly payload: number }
  | { readonly type: 'set-media-volume'; readonly payload: number }
  | { readonly type: 'set-media-playback-rate'; readonly payload: number }
  | { readonly type: 'set-interact'; readonly payload: boolean }
  | { readonly type: 'apply-fullscreen'; readonly payload: string }
  | { readonly type: 'set-settings'; readonly payload: EmbedPlayerSettings }

export type EmbedWebviewControlEvent =
  | { readonly type: 'navigate'; readonly payload: number }
  | { readonly type: 'reload'; readonly payload?: boolean }
  | { readonly type: 'stop' }
  | { readonly type: typeof HOST_EVENT_TYPE; readonly payload: EmbedHostToPlayerEvent }

export type EmbedExtensionOutboundMessage = {
  readonly type: typeof WEBVIEW_EVENT_TYPE
  readonly payload: EmbedWebviewControlEvent
  readonly tabId: number
  readonly frameId?: number
}

export type EmbedPlaybackChangeState = 'playing' | 'paused' | 'ended'

export type EmbedPlayerToHostEvent =
  | {
      readonly type: 'media-ready'
      readonly payload: {
        readonly href: string
        readonly duration?: number
      }
    }
  | { readonly type: 'media-autoplay-error'; readonly payload: { readonly error: string } }
  | { readonly type: 'media-seeked'; readonly payload: number }
  | { readonly type: 'media-time-update'; readonly payload: number }
  | { readonly type: 'media-volume-change'; readonly payload: { readonly value: number } }
  | {
      readonly type: 'media-playback-change'
      readonly payload: {
        readonly state: EmbedPlaybackChangeState
        readonly time: number
        readonly isTrusted: boolean
      }
    }
  | { readonly type: 'media-playback-rate-change'; readonly payload: { readonly value: number } }
  | { readonly type: 'media-metadata-change'; readonly payload?: Record<string, unknown> }

export type EmbedWebviewLifecycleEvent =
  | { readonly type: 'load-script' }
  | { readonly type: 'activity'; readonly payload: string }
  | { readonly type: 'will-navigate'; readonly payload: { readonly url: string } }
  | { readonly type: 'did-navigate'; readonly payload: { readonly url: string } }
  | { readonly type: 'did-navigate-in-page'; readonly payload: { readonly url: string } }
  | { readonly type: 'message'; readonly payload: EmbedPlayerToHostEvent }

export type EmbedExtensionInboundMessage =
  | {
      readonly kind: 'webview-init'
      readonly webviewId: number
      readonly tabId: number
      readonly frameId: number
    }
  | {
      readonly kind: 'webview-event'
      readonly framePath: readonly number[]
      readonly event: EmbedWebviewLifecycleEvent
    }

export interface Disposable {
  dispose(): void
}

export interface EmbedFrameOwnership {
  readonly webviewId: number
  readonly frameId: number
  readonly popup: boolean
}

export interface EmbedBridgeInboundContext {
  readonly allowedOrigin: string
  readonly ownership: EmbedFrameOwnership
}

export interface EmbedBridgeWindowEvent {
  readonly origin: string
  readonly data: unknown
}

/**
 * Owns iframe/extension bridge listeners and dispatch lifecycle.
 * dispose() must remove listeners, clear timers, and release frame/window refs.
 */
export interface EmbedExtensionBridgeLifecycle extends Disposable {
  readonly allowedOrigin: string
  readonly ownership: EmbedFrameOwnership
  setOwnership(next: EmbedFrameOwnership): void
}

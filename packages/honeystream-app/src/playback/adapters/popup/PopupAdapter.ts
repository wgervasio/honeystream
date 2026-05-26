import {
  DesiredPlaybackMedia,
  PlaybackAdapter,
  PlaybackAdapterApplyRequest,
  PlaybackAdapterLoadRequest,
  PlaybackMediaSource
} from '../shared/playbackAdapter'

/**
 * Context:
 * Popup fallback playback needs an explicit owner for popup window lifetime and listener cleanup.
 * Invariant:
 * Popup listeners are detached on replacement/dispose and only owned popups are closed by this adapter.
 * Options considered:
 * Reusing legacy UI popup orchestration vs a minimal adapter-scoped owner.
 * Decision:
 * Keep popup ownership local to the adapter with an injectable open strategy.
 * Performance impact:
 * Constant-time operations on load/apply/dispose with no retained history.
 * Memory/lifecycle ownership:
 * PopupAdapter owns popup references and unload listeners for the active media only.
 * Failure mode:
 * Blocked popups or externally closed windows surface explicit errors.
 * Validation:
 * playback/adapters/popup/PopupAdapter.spec.ts
 */

const POPUP_UNSUPPORTED_BROWSER_ERROR = 'PopupAdapter requires window.open support in this environment.'
const POPUP_UNAVAILABLE_ERROR = 'PopupAdapter could not open popup window.'
const POPUP_UNAVAILABLE_FOR_PLAYBACK_ERROR = 'PopupAdapter popup window is unavailable.'
const POPUP_NOT_LOADED_ERROR = 'PopupAdapter cannot apply playback before media is loaded.'
const POPUP_DISPOSED_ERROR = 'PopupAdapter has been disposed.'

const DEFAULT_POPUP_TARGET = '_blank'
const DEFAULT_POPUP_FEATURES = 'noopener,noreferrer'

const POPUP_SUPPORTED_MEDIA_SOURCES: readonly PlaybackMediaSource[] = ['direct-media', 'website']
const POPUP_CLOSE_EVENT_TYPES = ['beforeunload', 'pagehide', 'unload'] as const

type PopupCloseEventType = (typeof POPUP_CLOSE_EVENT_TYPES)[number]
type PopupCloseListener = () => void

const cloneMedia = (media: DesiredPlaybackMedia): DesiredPlaybackMedia => ({
  mediaId: media.mediaId,
  source: media.source,
  url: media.url
})

const supportsPopupMediaSource = (source: PlaybackMediaSource): boolean =>
  POPUP_SUPPORTED_MEDIA_SOURCES.indexOf(source) >= 0

export interface PopupAdapterWindow {
  readonly closed: boolean
  addEventListener(
    type: PopupCloseEventType,
    listener: PopupCloseListener,
    options?: boolean | AddEventListenerOptions
  ): void
  removeEventListener(
    type: PopupCloseEventType,
    listener: PopupCloseListener,
    options?: boolean | EventListenerOptions
  ): void
  close(): void
}

export interface PopupAdapterWindowApi {
  open(url: string, target: string, features: string): PopupAdapterWindow | null
}

export interface PopupAdapterOpenResult {
  readonly popup: PopupAdapterWindow
  readonly owned: boolean
}

export type PopupAdapterOpenPopup = (
  media: DesiredPlaybackMedia
) => PopupAdapterOpenResult | undefined

export interface PopupAdapterOptions {
  readonly popupWindowApi?: PopupAdapterWindowApi
  readonly openPopup?: PopupAdapterOpenPopup
  readonly popupTarget?: string
  readonly popupFeatures?: string
}

const browserPopupWindowApi: PopupAdapterWindowApi = {
  open(url: string, target: string, features: string): PopupAdapterWindow | null {
    if (typeof window === 'undefined' || typeof window.open !== 'function') {
      throw new Error(POPUP_UNSUPPORTED_BROWSER_ERROR)
    }
    const popup = window.open(url, target, features)
    if (!popup) {
      return null
    }

    const listenerMap: Record<PopupCloseEventType, Map<PopupCloseListener, EventListener>> = {
      beforeunload: new Map<PopupCloseListener, EventListener>(),
      pagehide: new Map<PopupCloseListener, EventListener>(),
      unload: new Map<PopupCloseListener, EventListener>()
    }
    const activePopup = popup
    return {
      get closed() {
        return activePopup.closed
      },
      addEventListener(type, listener, options) {
        const wrappedListener: EventListener = () => {
          listener()
        }
        listenerMap[type].set(listener, wrappedListener)
        activePopup.addEventListener(type, wrappedListener, options)
      },
      removeEventListener(type, listener, options) {
        const wrappedListener = listenerMap[type].get(listener)
        if (!wrappedListener) return

        listenerMap[type].delete(listener)
        activePopup.removeEventListener(type, wrappedListener, options)
      },
      close() {
        activePopup.close()
      }
    }
  }
}

export class PopupAdapter implements PlaybackAdapter {
  readonly kind = 'popup'

  private readonly popupWindowApi: PopupAdapterWindowApi
  private readonly openPopup?: PopupAdapterOpenPopup
  private readonly popupTarget: string
  private readonly popupFeatures: string

  private disposed = false
  private currentMedia?: DesiredPlaybackMedia
  private activePopup?: PopupAdapterOpenResult
  private activePopupCloseListener?: PopupCloseListener
  private activePopupListenerTarget?: PopupAdapterWindow

  constructor(options: PopupAdapterOptions = {}) {
    this.popupWindowApi = options.popupWindowApi || browserPopupWindowApi
    this.openPopup = options.openPopup
    this.popupTarget = options.popupTarget || DEFAULT_POPUP_TARGET
    this.popupFeatures = options.popupFeatures || DEFAULT_POPUP_FEATURES
  }

  loadMedia(request: PlaybackAdapterLoadRequest): void {
    this.assertNotDisposed()
    this.assertSupportsMediaSource(request.media.source)

    this.releasePopup(true, true)

    const media = cloneMedia(request.media)
    const popup = this.tryOpenPopup(media)
    this.activePopup = popup
    this.currentMedia = media
    this.attachPopupCloseListeners(popup.popup)
  }

  applyPlayback(_request: PlaybackAdapterApplyRequest): void {
    this.assertNotDisposed()

    if (!this.currentMedia) {
      throw new Error(POPUP_NOT_LOADED_ERROR)
    }

    const activePopup = this.activePopup
    if (!activePopup || activePopup.popup.closed) {
      this.releasePopup(false, false)
      throw new Error(POPUP_UNAVAILABLE_FOR_PLAYBACK_ERROR)
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.releasePopup(true, true)
  }

  private tryOpenPopup(media: DesiredPlaybackMedia): PopupAdapterOpenResult {
    const opened = this.openPopup
      ? this.openPopup(cloneMedia(media))
      : (() => {
          const popup = this.popupWindowApi.open(media.url, this.popupTarget, this.popupFeatures)
          if (!popup) return undefined
          return {
            popup,
            owned: true
          }
        })()

    if (!opened || opened.popup.closed) {
      throw new Error(POPUP_UNAVAILABLE_ERROR)
    }

    return opened
  }

  private attachPopupCloseListeners(popup: PopupAdapterWindow): void {
    const onPopupClose: PopupCloseListener = () => {
      this.releasePopup(false, false)
    }

    this.activePopupCloseListener = onPopupClose
    this.activePopupListenerTarget = popup

    for (const eventType of POPUP_CLOSE_EVENT_TYPES) {
      popup.addEventListener(eventType, onPopupClose)
    }
  }

  private detachPopupCloseListeners(): void {
    const listener = this.activePopupCloseListener
    const listenerTarget = this.activePopupListenerTarget
    if (!listener || !listenerTarget) return

    this.activePopupCloseListener = undefined
    this.activePopupListenerTarget = undefined

    for (const eventType of POPUP_CLOSE_EVENT_TYPES) {
      listenerTarget.removeEventListener(eventType, listener)
    }
  }

  private releasePopup(closeOwnedPopup: boolean, clearMedia: boolean): void {
    const popup = this.activePopup
    this.activePopup = undefined
    this.detachPopupCloseListeners()

    if (popup && popup.owned && closeOwnedPopup && !popup.popup.closed) {
      popup.popup.close()
    }

    if (clearMedia) {
      this.currentMedia = undefined
    }
  }

  private assertSupportsMediaSource(source: PlaybackMediaSource): void {
    if (supportsPopupMediaSource(source)) return
    throw new Error(`PopupAdapter does not support media source "${source}".`)
  }

  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new Error(POPUP_DISPOSED_ERROR)
    }
  }
}

export const createPopupAdapter = (options: PopupAdapterOptions = {}): PopupAdapter =>
  new PopupAdapter(options)

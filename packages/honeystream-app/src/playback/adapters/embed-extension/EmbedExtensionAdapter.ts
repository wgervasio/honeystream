import { Disposable, DisposableGroup, toDisposable } from '../shared/disposable'
import {
  DesiredPlaybackMedia,
  PlaybackAdapter,
  PlaybackAdapterApplyRequest,
  PlaybackAdapterLoadRequest
} from '../shared/playbackAdapter'
import {
  EMBED_BRIDGE_DIAGNOSTIC_LIMIT,
  EmbedBridgeInboundContext,
  EmbedBridgeWindowEvent,
  EmbedExtensionBridgeLifecycle,
  EmbedExtensionOutboundMessage,
  EmbedFrameOwnership,
  EmbedHostToPlayerEvent,
  EmbedPlayerToHostEvent,
  PlaybackStateCode,
  WEBVIEW_EVENT_TYPE,
  HOST_EVENT_TYPE
} from './contracts'
import { EmbedBridgeDiagnostic, EmbedBridgeDiagnostics } from './diagnostics'
import {
  EmbedBridgeParseFailure,
  parseEmbedExtensionOutboundMessage,
  parseOwnedInboundMessage,
  toEmbedBridgeDiagnostic
} from './parser'

const cloneOwnership = (ownership: EmbedFrameOwnership): EmbedFrameOwnership => ({
  webviewId: ownership.webviewId,
  frameId: ownership.frameId,
  popup: ownership.popup
})

const cloneRouting = (routing: EmbedExtensionRouting): EmbedExtensionRouting => ({
  tabId: routing.tabId,
  frameId: routing.frameId
})

const cloneMedia = (media: DesiredPlaybackMedia): DesiredPlaybackMedia => ({
  mediaId: media.mediaId,
  source: media.source,
  url: media.url
})

const EMBED_MEDIA_EVENT_LISTENER_LIMIT = 32

const toPlaybackStateCode = (
  state: PlaybackAdapterApplyRequest['desiredPlayback']['state']
): PlaybackStateCode => {
  switch (state) {
    case 'playing':
      return 1
    case 'paused':
      return 2
    case 'idle':
      return 0
  }
}

export interface EmbedExtensionMessageTarget {
  addEventListener(
    type: 'message',
    listener: (event: EmbedBridgeWindowEvent) => void,
    options?: boolean | AddEventListenerOptions
  ): void
  removeEventListener(
    type: 'message',
    listener: (event: EmbedBridgeWindowEvent) => void,
    options?: boolean | EventListenerOptions
  ): void
}

export interface EmbedExtensionOutboundDispatcher {
  dispatch(message: EmbedExtensionOutboundMessage): void
}

export interface EmbedExtensionRouting {
  readonly tabId: number
  readonly frameId: number
}

export interface EmbedExtensionMediaEvent {
  readonly playerEvent: EmbedPlayerToHostEvent
  readonly framePath: readonly number[]
  readonly isTopSubFrame: boolean
}

export type EmbedExtensionMediaEventListener = (event: EmbedExtensionMediaEvent) => void

export interface EmbedExtensionAdapterOptions {
  readonly allowedOrigin: string
  readonly ownership: EmbedFrameOwnership
  readonly messageTarget: EmbedExtensionMessageTarget
  readonly outbound: EmbedExtensionOutboundDispatcher
  readonly routing?: EmbedExtensionRouting
  readonly diagnosticsLimit?: number
  readonly now?: () => number
  readonly dispatchToAllFrames?: boolean
}

export class EmbedExtensionAdapter implements PlaybackAdapter, EmbedExtensionBridgeLifecycle {
  readonly kind = 'embed-extension'
  readonly allowedOrigin: string

  private readonly disposables = new DisposableGroup()
  private readonly diagnostics: EmbedBridgeDiagnostics
  private readonly mediaEventListeners = new Set<EmbedExtensionMediaEventListener>()
  private readonly now: () => number
  private readonly dispatchToAllFrames: boolean
  private readonly outbound: EmbedExtensionOutboundDispatcher

  private ownershipState: EmbedFrameOwnership
  private routingState?: EmbedExtensionRouting
  private currentMedia?: DesiredPlaybackMedia
  private disposed = false

  constructor(options: EmbedExtensionAdapterOptions) {
    this.allowedOrigin = options.allowedOrigin
    this.ownershipState = cloneOwnership(options.ownership)
    this.routingState = options.routing ? cloneRouting(options.routing) : undefined
    this.now = options.now || Date.now
    this.dispatchToAllFrames = options.dispatchToAllFrames !== false
    this.outbound = options.outbound
    this.diagnostics = new EmbedBridgeDiagnostics(
      options.diagnosticsLimit || EMBED_BRIDGE_DIAGNOSTIC_LIMIT
    )
    options.messageTarget.addEventListener('message', this.onBridgeMessage)
    this.disposables.add(
      toDisposable(() => {
        options.messageTarget.removeEventListener('message', this.onBridgeMessage)
      })
    )
  }

  get ownership(): EmbedFrameOwnership {
    return cloneOwnership(this.ownershipState)
  }

  get diagnosticCount(): number {
    return this.diagnostics.size
  }

  get routing(): EmbedExtensionRouting | undefined {
    return this.routingState ? cloneRouting(this.routingState) : undefined
  }

  diagnosticsSnapshot(): readonly EmbedBridgeDiagnostic[] {
    return this.diagnostics.snapshot()
  }

  onMediaEvent(listener: EmbedExtensionMediaEventListener): Disposable {
    this.assertNotDisposed()

    if (this.mediaEventListeners.size >= EMBED_MEDIA_EVENT_LISTENER_LIMIT) {
      throw new Error(
        `EmbedExtensionAdapter supports at most ${EMBED_MEDIA_EVENT_LISTENER_LIMIT} media-event listeners.`
      )
    }

    this.mediaEventListeners.add(listener)
    return toDisposable(() => {
      this.mediaEventListeners.delete(listener)
    })
  }

  setOwnership(next: EmbedFrameOwnership): void {
    this.assertNotDisposed()
    this.ownershipState = cloneOwnership(next)

    if (this.routingState) {
      this.routingState = {
        tabId: this.routingState.tabId,
        frameId: next.frameId
      }
    }
  }

  loadMedia(request: PlaybackAdapterLoadRequest): void {
    this.assertNotDisposed()
    this.currentMedia = cloneMedia(request.media)
  }

  applyPlayback(request: PlaybackAdapterApplyRequest): void {
    this.assertNotDisposed()

    if (!this.currentMedia) {
      throw new Error('EmbedExtensionAdapter cannot apply playback before media is loaded.')
    }

    const playbackStateCode = toPlaybackStateCode(request.desiredPlayback.state)
    this.dispatchHostEvent({
      type: 'set-media-playback',
      payload: playbackStateCode
    })
    this.dispatchHostEvent({
      type: 'seek-media',
      payload: request.desiredPlayback.positionMs
    })
    this.dispatchHostEvent({
      type: 'set-media-playback-rate',
      payload: request.desiredPlayback.rate
    })
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.disposables.dispose()

    this.mediaEventListeners.clear()
    this.currentMedia = undefined
    this.routingState = undefined
  }

  private onBridgeMessage = (event: EmbedBridgeWindowEvent): void => {
    if (this.disposed) return

    const parseResult = parseOwnedInboundMessage(event, this.toInboundContext())
    if (!parseResult.ok) {
      this.recordParseFailure(parseResult, 'inbound')
      return
    }

    const message = parseResult.value
    if (message.kind === 'webview-init') {
      this.routingState = {
        tabId: message.tabId,
        frameId: message.frameId
      }
      this.ownershipState = {
        webviewId: message.webviewId,
        frameId: message.frameId,
        popup: this.ownershipState.popup
      }
      return
    }

    if (message.event.type !== 'message') {
      return
    }

    const topFrameId = message.framePath[message.framePath.length - 1]
    this.emitMediaEvent({
      playerEvent: message.event.payload,
      framePath: message.framePath.slice(),
      isTopSubFrame: topFrameId === this.ownershipState.frameId
    })
  }

  private toInboundContext(): EmbedBridgeInboundContext {
    return {
      allowedOrigin: this.allowedOrigin,
      ownership: this.ownershipState
    }
  }

  private dispatchHostEvent(event: EmbedHostToPlayerEvent): void {
    const routing = this.requireRouting()
    const outboundResult = parseEmbedExtensionOutboundMessage({
      type: WEBVIEW_EVENT_TYPE,
      tabId: routing.tabId,
      frameId: this.dispatchToAllFrames ? undefined : routing.frameId,
      payload: {
        type: HOST_EVENT_TYPE,
        payload: event
      }
    })

    if (!outboundResult.ok) {
      this.recordParseFailure(outboundResult, 'outbound')
      throw new Error(`EmbedExtensionAdapter outbound dispatch failed: ${outboundResult.reason}`)
    }

    this.outbound.dispatch(outboundResult.value)
  }

  private emitMediaEvent(event: EmbedExtensionMediaEvent): void {
    for (const listener of Array.from(this.mediaEventListeners)) {
      listener(event)
    }
  }

  private requireRouting(): EmbedExtensionRouting {
    if (!this.routingState) {
      throw new Error('EmbedExtensionAdapter routing is unavailable before webview initialization.')
    }

    return this.routingState
  }

  private recordParseFailure(
    parseFailure: EmbedBridgeParseFailure,
    direction: 'inbound' | 'outbound'
  ): void {
    this.diagnostics.push(toEmbedBridgeDiagnostic(parseFailure, direction, this.now()))
  }

  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new Error('EmbedExtensionAdapter has been disposed.')
    }
  }
}

export const createEmbedExtensionAdapter = (
  options: EmbedExtensionAdapterOptions
): EmbedExtensionAdapter => new EmbedExtensionAdapter(options)

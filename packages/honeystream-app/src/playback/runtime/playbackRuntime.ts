import {
  EmbedExtensionInboundMessage,
  EmbedExtensionOutboundMessage,
  HOST_EVENT_TYPE,
  WEBVIEW_EVENT_TYPE
} from '../adapters/embed-extension/contracts'
import {
  EmbedBridgeParseResult,
  parseEmbedExtensionInboundMessage,
  parseEmbedExtensionOutboundMessage
} from '../adapters/embed-extension/parser'
import { LocalFileAdapter, LocalFileMetadata } from '../adapters/local-file/LocalFileAdapter'
import { Disposable, PlaybackAdapter } from '../adapters/shared'
import { DesiredPlaybackMedia } from '../adapters/shared/playbackAdapter'
import { PlaybackEngine } from '../engine/playbackEngine'
import {
  PlaybackEngineApplyResult,
  PlaybackEngineDesiredState,
  PlaybackEngineStateApplication
} from '../engine/playbackEngineContract'
import {
  PlaybackAdapterSelectionOptions,
  PlaybackRuntimeAdapterKind,
  selectPlaybackAdapterKind
} from './adapterSelection'

const cloneMedia = (media: DesiredPlaybackMedia): DesiredPlaybackMedia => ({ ...media })

export interface PlaybackRuntimeEmbedContracts {
  readonly hostEventType: typeof HOST_EVENT_TYPE
  readonly webviewEventType: typeof WEBVIEW_EVENT_TYPE
  parseInboundMessage(input: unknown): EmbedBridgeParseResult<EmbedExtensionInboundMessage>
  parseOutboundMessage(input: unknown): EmbedBridgeParseResult<EmbedExtensionOutboundMessage>
}

const defaultEmbedContracts: PlaybackRuntimeEmbedContracts = {
  hostEventType: HOST_EVENT_TYPE,
  webviewEventType: WEBVIEW_EVENT_TYPE,
  parseInboundMessage: parseEmbedExtensionInboundMessage,
  parseOutboundMessage: parseEmbedExtensionOutboundMessage
}

export interface PlaybackRuntimeAdapterContext {
  readonly kind: PlaybackRuntimeAdapterKind
  readonly media: DesiredPlaybackMedia
  readonly localFiles: LocalFileAdapter
  readonly embedContracts: PlaybackRuntimeEmbedContracts
}

export interface PlaybackRuntimeAdapterFactories {
  createLocalFileAdapter(context: PlaybackRuntimeAdapterContext): PlaybackAdapter
  createEmbedExtensionAdapter(context: PlaybackRuntimeAdapterContext): PlaybackAdapter
  createPopupAdapter(context: PlaybackRuntimeAdapterContext): PlaybackAdapter
}

export interface PlaybackRuntimeOptions {
  readonly adapters: PlaybackRuntimeAdapterFactories
  readonly localFileAdapter?: LocalFileAdapter
  readonly embedContracts?: PlaybackRuntimeEmbedContracts
  readonly defaultSeekToleranceMs?: number
  readonly selection?: PlaybackAdapterSelectionOptions
  readonly selectAdapterKind?: (media: DesiredPlaybackMedia) => PlaybackRuntimeAdapterKind
}

export interface PlaybackRuntimeApplyResult extends PlaybackEngineApplyResult {
  readonly adapterKind?: PlaybackRuntimeAdapterKind
}

export class PlaybackRuntime implements PlaybackEngineStateApplication, Disposable {
  private readonly engine: PlaybackEngine
  private readonly localFileAdapter: LocalFileAdapter
  private readonly embedContracts: PlaybackRuntimeEmbedContracts
  private readonly selectAdapterKind: (media: DesiredPlaybackMedia) => PlaybackRuntimeAdapterKind
  private readonly adapters: PlaybackRuntimeAdapterFactories

  private disposed = false
  private currentAdapterKind?: PlaybackRuntimeAdapterKind

  constructor(options: PlaybackRuntimeOptions) {
    this.adapters = options.adapters
    this.localFileAdapter = options.localFileAdapter || new LocalFileAdapter()
    this.embedContracts = options.embedContracts || defaultEmbedContracts
    this.selectAdapterKind =
      options.selectAdapterKind ||
      (media => {
        return selectPlaybackAdapterKind(media, options.selection)
      })

    this.engine = new PlaybackEngine({
      adapterFactory: {
        createAdapter: media => {
          const kind = this.selectAdapterKind(media)
          this.currentAdapterKind = kind
          const context: PlaybackRuntimeAdapterContext = {
            kind,
            media: cloneMedia(media),
            localFiles: this.localFileAdapter,
            embedContracts: this.embedContracts
          }

          if (kind === 'local-file') {
            return this.adapters.createLocalFileAdapter(context)
          }
          if (kind === 'popup') {
            return this.adapters.createPopupAdapter(context)
          }
          return this.adapters.createEmbedExtensionAdapter(context)
        }
      },
      defaultSeekToleranceMs: options.defaultSeekToleranceMs
    })
  }

  get isDisposed(): boolean {
    return this.disposed
  }

  getCurrentAdapterKind(): PlaybackRuntimeAdapterKind | undefined {
    return this.currentAdapterKind
  }

  getLastDesiredState(): PlaybackEngineDesiredState | undefined {
    return this.engine.getLastDesiredState()
  }

  async applyDesiredState(
    desiredState: PlaybackEngineDesiredState
  ): Promise<PlaybackRuntimeApplyResult> {
    this.assertNotDisposed()

    const result = await this.engine.applyDesiredState(desiredState)

    if (!desiredState.media) {
      this.currentAdapterKind = undefined
    }

    return {
      ...result,
      adapterKind: this.currentAdapterKind
    }
  }

  registerLocalFile(file: File, key?: string): LocalFileMetadata {
    this.assertNotDisposed()
    return this.localFileAdapter.registerLocalFile(file, key)
  }

  getLocalFileUrl(metadata: LocalFileMetadata): string | undefined {
    this.assertNotDisposed()
    return this.localFileAdapter.getLocalFileUrl(metadata)
  }

  getLocalFileMetadata(value: unknown): LocalFileMetadata | undefined {
    this.assertNotDisposed()
    return this.localFileAdapter.getLocalFileMetadata(value)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true

    this.engine.dispose()
    this.currentAdapterKind = undefined
    this.localFileAdapter.dispose()
  }

  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new Error('PlaybackRuntime has been disposed.')
    }
  }
}

export const createPlaybackRuntime = (options: PlaybackRuntimeOptions): PlaybackRuntime =>
  new PlaybackRuntime(options)

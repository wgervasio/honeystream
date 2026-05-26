import { Buffer } from 'buffer'
import { LocalFileAdapter } from '../adapters/local-file'
import {
  DesiredPlaybackMedia,
  DesiredPlaybackModel,
  PlaybackAdapter,
  PlaybackAdapterApplyRequest,
  PlaybackAdapterLoadRequest
} from '../adapters/shared/playbackAdapter'
import {
  PlaybackAdapterSelectionOptions,
  PlaybackRuntimeAdapterKind,
  selectPlaybackAdapterKind
} from './adapterSelection'
import { PlaybackRuntime, PlaybackRuntimeAdapterContext } from './playbackRuntime'

class TestFile implements File {
  readonly lastModified: number
  readonly name: string
  readonly size: number
  readonly type = 'video/mp4'
  readonly webkitRelativePath = ''
  readonly [Symbol.toStringTag] = 'File'

  constructor(name: string, private readonly content: string) {
    this.name = name
    this.lastModified = 456
    this.size = content.length
  }

  arrayBuffer(): Promise<ArrayBuffer> {
    const buffer = Buffer.from(this.content, 'utf8')
    return Promise.resolve(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength))
  }

  slice(): Blob {
    throw new Error('TestFile.slice() is not used in this test suite.')
  }

  stream(): ReadableStream<Uint8Array> {
    throw new Error('TestFile.stream() is not used in this test suite.')
  }

  text(): Promise<string> {
    return Promise.resolve(this.content)
  }
}

const createFile = (name: string, content = 'video-data'): File => new TestFile(name, content)

class FakePlaybackAdapter implements PlaybackAdapter {
  public readonly loadRequests: PlaybackAdapterLoadRequest[] = []
  public readonly applyRequests: PlaybackAdapterApplyRequest[] = []
  public disposeCallCount = 0

  constructor(public readonly kind: string) {}

  loadMedia(request: PlaybackAdapterLoadRequest): void {
    this.loadRequests.push(request)
  }

  applyPlayback(request: PlaybackAdapterApplyRequest): void {
    this.applyRequests.push(request)
  }

  dispose(): void {
    this.disposeCallCount += 1
  }
}

type CreatedAdapter = {
  readonly kind: PlaybackRuntimeAdapterKind
  readonly context: PlaybackRuntimeAdapterContext
  readonly adapter: FakePlaybackAdapter
}

const createMedia = (
  mediaId: string,
  source: DesiredPlaybackMedia['source'],
  url: string
): DesiredPlaybackMedia => ({
  mediaId,
  source,
  url
})

const createPlayback = (overrides: Partial<DesiredPlaybackModel> = {}): DesiredPlaybackModel => ({
  state: 'playing',
  positionMs: 1200,
  updatedAtHostMs: 5000,
  rate: 1,
  durationMs: 30000,
  ...overrides
})

const createHarness = (
  options: {
    readonly selection?: PlaybackAdapterSelectionOptions
    readonly selectAdapterKind?: (media: DesiredPlaybackMedia) => PlaybackRuntimeAdapterKind
  } = {}
) => {
  const createdAdapters: CreatedAdapter[] = []
  const revokedObjectUrls: string[] = []
  let objectUrlCount = 0

  const localFileAdapter = new LocalFileAdapter({
    createObjectURL: () => {
      objectUrlCount += 1
      return `blob:video-${objectUrlCount}`
    },
    revokeObjectURL: objectUrl => {
      revokedObjectUrls.push(objectUrl)
    }
  })

  const createFactory = (kind: PlaybackRuntimeAdapterKind) => {
    return (context: PlaybackRuntimeAdapterContext): PlaybackAdapter => {
      const adapter = new FakePlaybackAdapter(`fake-${kind}`)
      createdAdapters.push({ kind, context, adapter })
      return adapter
    }
  }

  const runtime = new PlaybackRuntime({
    adapters: {
      createLocalFileAdapter: createFactory('local-file'),
      createEmbedExtensionAdapter: createFactory('embed-extension'),
      createPopupAdapter: createFactory('popup')
    },
    selection: options.selection,
    selectAdapterKind: options.selectAdapterKind,
    localFileAdapter
  })

  return {
    runtime,
    createdAdapters,
    revokedObjectUrls
  }
}

describe('selectPlaybackAdapterKind', () => {
  it('always routes local-file media to the local-file adapter', () => {
    const media = createMedia('local-1', 'local-file', 'honeystream-local://video-key')

    expect(selectPlaybackAdapterKind(media, { forcePopup: true })).toBe('local-file')
  })

  it('routes blocked or mixed-content websites to popup', () => {
    const blockedHosts = new Set<string>(['blocked.example'])

    expect(
      selectPlaybackAdapterKind(createMedia('blocked', 'website', 'https://blocked.example/watch'), {
        blockedEmbedHosts: blockedHosts
      })
    ).toBe('popup')

    expect(selectPlaybackAdapterKind(createMedia('http', 'website', 'http://example.com/watch'))).toBe(
      'popup'
    )
  })

  it('routes embeddable https media to the embed-extension adapter', () => {
    const media = createMedia('embed', 'website', 'https://example.com/watch')
    expect(selectPlaybackAdapterKind(media)).toBe('embed-extension')
  })
})

describe('PlaybackRuntime', () => {
  it('selects embed, local-file, and popup adapters across media changes', async () => {
    const { runtime, createdAdapters } = createHarness({
      selection: { blockedEmbedHosts: new Set<string>(['blocked.example']) }
    })

    await runtime.applyDesiredState({
      media: createMedia('embed-1', 'website', 'https://example.com/watch'),
      playback: createPlayback()
    })
    await runtime.applyDesiredState({
      media: createMedia('local-1', 'local-file', 'honeystream-local://local-key'),
      playback: createPlayback({ positionMs: 2400 })
    })
    const popupResult = await runtime.applyDesiredState({
      media: createMedia('popup-1', 'website', 'https://blocked.example/watch'),
      playback: createPlayback({ positionMs: 3600 })
    })

    expect(createdAdapters.map(entry => entry.kind)).toEqual([
      'embed-extension',
      'local-file',
      'popup'
    ])
    expect(createdAdapters[0].adapter.disposeCallCount).toBe(1)
    expect(createdAdapters[1].adapter.disposeCallCount).toBe(1)
    expect(createdAdapters[2].adapter.disposeCallCount).toBe(0)
    expect(runtime.getCurrentAdapterKind()).toBe('popup')
    expect(popupResult.adapterKind).toBe('popup')

    runtime.dispose()
  })

  it('disposes active adapters when desired media is cleared', async () => {
    const { runtime, createdAdapters } = createHarness()

    await runtime.applyDesiredState({
      media: createMedia('embed-1', 'website', 'https://example.com/watch'),
      playback: createPlayback()
    })

    const result = await runtime.applyDesiredState({
      playback: createPlayback({ state: 'idle', positionMs: 0 })
    })

    expect(createdAdapters).toHaveLength(1)
    expect(createdAdapters[0].adapter.disposeCallCount).toBe(1)
    expect(result.adapterDisposed).toBe(true)
    expect(result.adapterKind).toBeUndefined()
    expect(runtime.getCurrentAdapterKind()).toBeUndefined()

    runtime.dispose()
  })

  it('owns local-file registry lifecycle and runtime disposal idempotently', async () => {
    const { runtime, createdAdapters, revokedObjectUrls } = createHarness()
    const localMetadata = runtime.registerLocalFile(createFile('movie.mp4'), 'local-key')

    expect(runtime.getLocalFileUrl(localMetadata)).toBe('blob:video-1')

    await runtime.applyDesiredState({
      media: createMedia('embed-1', 'website', 'https://example.com/watch'),
      playback: createPlayback()
    })

    runtime.dispose()
    runtime.dispose()

    expect(createdAdapters).toHaveLength(1)
    expect(createdAdapters[0].adapter.disposeCallCount).toBe(1)
    expect(revokedObjectUrls).toEqual(['blob:video-1'])
    expect(runtime.isDisposed).toBe(true)
    expect(() => runtime.registerLocalFile(createFile('movie-2.mp4'), 'local-key-2')).toThrow(
      'PlaybackRuntime has been disposed.'
    )
  })

  it('passes embed contracts into selected adapter factories', async () => {
    const { runtime, createdAdapters } = createHarness()

    await runtime.applyDesiredState({
      media: createMedia('embed-1', 'website', 'https://example.com/watch'),
      playback: createPlayback()
    })

    expect(createdAdapters).toHaveLength(1)
    const embedContext = createdAdapters[0].context

    expect(embedContext.embedContracts.hostEventType).toBe('honeystream-host-event')
    expect(embedContext.embedContracts.webviewEventType).toBe('honeystream-webview-event')

    const inboundMessage = embedContext.embedContracts.parseInboundMessage({
      type: 'honeystream-webview-init1',
      payload: { tabId: 10, frameId: 5 }
    })
    expect(inboundMessage.ok).toBe(true)

    const outboundMessage = embedContext.embedContracts.parseOutboundMessage({
      type: 'honeystream-webview-event',
      tabId: 10,
      frameId: 5,
      payload: {
        type: 'honeystream-host-event',
        payload: { type: 'set-media-playback', payload: 1 }
      }
    })
    expect(outboundMessage.ok).toBe(true)

    runtime.dispose()
  })
})

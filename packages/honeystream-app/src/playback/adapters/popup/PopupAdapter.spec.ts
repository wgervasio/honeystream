import {
  createPopupAdapter,
  PopupAdapterOpenResult,
  PopupAdapterWindow,
  PopupAdapterWindowApi
} from './PopupAdapter'
import { createPopupAdapterFactory } from './PopupAdapterFactory'

type PopupCloseEventType = 'beforeunload' | 'pagehide' | 'unload'
type PopupCloseListener = () => void

type OpenPopupCall = {
  readonly url: string
  readonly target: string
  readonly features: string
}

class TestPopupWindow implements PopupAdapterWindow {
  public closed = false
  public closeCallCount = 0
  public readonly addCalls: PopupCloseEventType[] = []
  public readonly removeCalls: PopupCloseEventType[] = []
  private readonly listeners: Record<PopupCloseEventType, Set<PopupCloseListener>> = {
    beforeunload: new Set<PopupCloseListener>(),
    pagehide: new Set<PopupCloseListener>(),
    unload: new Set<PopupCloseListener>()
  }

  addEventListener(type: PopupCloseEventType, listener: PopupCloseListener): void {
    this.addCalls.push(type)
    this.listeners[type].add(listener)
  }

  removeEventListener(type: PopupCloseEventType, listener: PopupCloseListener): void {
    this.removeCalls.push(type)
    this.listeners[type].delete(listener)
  }

  close(): void {
    this.closeCallCount += 1
    this.closed = true
  }

  emit(type: PopupCloseEventType): void {
    for (const listener of Array.from(this.listeners[type])) {
      listener()
    }
  }
}

class TestPopupWindowApi implements PopupAdapterWindowApi {
  public readonly openCalls: OpenPopupCall[] = []
  private readonly openResults: Array<PopupAdapterWindow | null> = []

  queueOpenResult(result: PopupAdapterWindow | null): void {
    this.openResults.push(result)
  }

  open(url: string, target: string, features: string): PopupAdapterWindow | null {
    this.openCalls.push({ url, target, features })
    if (this.openResults.length === 0) {
      return null
    }

    return this.openResults.shift() || null
  }
}

const createMedia = (mediaId: string, source: 'website' | 'direct-media' | 'local-file' = 'website') => ({
  mediaId,
  source,
  url: `https://example.com/watch/${mediaId}`
})

const createPlayback = () => ({
  state: 'playing' as const,
  positionMs: 1200,
  updatedAtHostMs: 4000,
  rate: 1,
  durationMs: 30000
})

describe('PopupAdapter', () => {
  it('opens popups with explicit target/features and closes owned popups on replacement/dispose', () => {
    const popupWindowApi = new TestPopupWindowApi()
    const firstPopup = new TestPopupWindow()
    const secondPopup = new TestPopupWindow()
    popupWindowApi.queueOpenResult(firstPopup)
    popupWindowApi.queueOpenResult(secondPopup)

    const adapter = createPopupAdapter({
      popupWindowApi,
      popupTarget: 'HoneystreamPopupPlayback',
      popupFeatures: 'noopener,noreferrer,width=900,height=600'
    })

    adapter.loadMedia({ media: createMedia('media-1') })
    adapter.loadMedia({ media: createMedia('media-2') })
    adapter.dispose()
    adapter.dispose()

    expect(popupWindowApi.openCalls).toEqual([
      {
        url: 'https://example.com/watch/media-1',
        target: 'HoneystreamPopupPlayback',
        features: 'noopener,noreferrer,width=900,height=600'
      },
      {
        url: 'https://example.com/watch/media-2',
        target: 'HoneystreamPopupPlayback',
        features: 'noopener,noreferrer,width=900,height=600'
      }
    ])
    expect(firstPopup.closeCallCount).toBe(1)
    expect(secondPopup.closeCallCount).toBe(1)
    expect(firstPopup.removeCalls).toEqual(['beforeunload', 'pagehide', 'unload'])
    expect(secondPopup.removeCalls).toEqual(['beforeunload', 'pagehide', 'unload'])
    expect(() =>
      adapter.applyPlayback({
        desiredPlayback: createPlayback(),
        seekToleranceMs: 250
      })
    ).toThrow('PopupAdapter has been disposed.')
  })

  it('detaches listeners and clears popup references when popup closes itself', () => {
    const popupWindowApi = new TestPopupWindowApi()
    const popup = new TestPopupWindow()
    popupWindowApi.queueOpenResult(popup)

    const adapter = createPopupAdapter({ popupWindowApi })
    adapter.loadMedia({ media: createMedia('media-1') })

    popup.emit('pagehide')

    expect(() =>
      adapter.applyPlayback({
        desiredPlayback: createPlayback(),
        seekToleranceMs: 250
      })
    ).toThrow('PopupAdapter popup window is unavailable.')
    expect(popup.removeCalls).toEqual(['beforeunload', 'pagehide', 'unload'])
  })

  it('does not close unowned popups during adapter cleanup', () => {
    const popup = new TestPopupWindow()
    const openPopup = (): PopupAdapterOpenResult => ({
      popup,
      owned: false
    })

    const adapter = createPopupAdapter({ openPopup })
    adapter.loadMedia({ media: createMedia('media-1') })
    adapter.dispose()

    expect(popup.closeCallCount).toBe(0)
    expect(popup.removeCalls).toEqual(['beforeunload', 'pagehide', 'unload'])
  })

  it('surfaces explicit failure modes for blocked popups and pre-load playback', () => {
    const blockedApi = new TestPopupWindowApi()
    blockedApi.queueOpenResult(null)
    const blockedAdapter = createPopupAdapter({ popupWindowApi: blockedApi })

    expect(() => blockedAdapter.loadMedia({ media: createMedia('blocked-1') })).toThrow(
      'PopupAdapter could not open popup window.'
    )

    const popupWindowApi = new TestPopupWindowApi()
    const popup = new TestPopupWindow()
    popupWindowApi.queueOpenResult(popup)
    const adapter = createPopupAdapter({ popupWindowApi })

    expect(() =>
      adapter.applyPlayback({
        desiredPlayback: createPlayback(),
        seekToleranceMs: 250
      })
    ).toThrow('PopupAdapter cannot apply playback before media is loaded.')

    adapter.loadMedia({ media: createMedia('media-1') })
    popup.closed = true

    expect(() =>
      adapter.applyPlayback({
        desiredPlayback: createPlayback(),
        seekToleranceMs: 250
      })
    ).toThrow('PopupAdapter popup window is unavailable.')
  })
})

describe('createPopupAdapterFactory', () => {
  it('creates popup adapters for supported media and rejects local-file media', () => {
    const popupWindowApi = new TestPopupWindowApi()
    const factory = createPopupAdapterFactory({ popupWindowApi })

    const adapter = factory.createAdapter(createMedia('website-1', 'website'))
    expect(adapter.kind).toBe('popup')
    adapter.dispose()

    expect(() => factory.createAdapter(createMedia('local-1', 'local-file'))).toThrow(
      'does not support media source'
    )
  })
})

/**
 * Context:
 * Playback adapters allocate browser resources that outlive a single function call.
 * Invariant:
 * Every resource has a single explicit owner and deterministic cleanup path.
 * Options considered:
 * Runtime-only conventions vs a typed ownership contract.
 * Decision:
 * Keep a typed ownership table in source so adapters/tests share one cleanup contract.
 * Performance impact:
 * Zero runtime cost outside tiny lookup helpers.
 * Memory/lifecycle ownership:
 * PlaybackEngine owns adapter lifetime; each adapter owns its browser handles.
 * Failure mode:
 * Missing ownership records can leak listeners/timers/object URLs/windows.
 * Validation:
 * adapters/shared/resourceOwnership.spec.ts
 */
export type PlaybackResource =
  | 'adapter-instance'
  | 'object-url'
  | 'dom-listener'
  | 'timer'
  | 'iframe'
  | 'popup-window'

export type PlaybackResourceOwner =
  | 'PlaybackEngine'
  | 'LocalFileAdapter'
  | 'EmbedAdapter'
  | 'PopupAdapter'

export type ResourceReleasePhase = 'media-change' | 'adapter-dispose' | 'engine-dispose'

export interface PlaybackResourceOwnershipRecord {
  readonly resource: PlaybackResource
  readonly owner: PlaybackResourceOwner
  readonly cleanup: string
  readonly releasePhase: ResourceReleasePhase
}

export const playbackResourceOwnership: readonly PlaybackResourceOwnershipRecord[] = [
  {
    resource: 'adapter-instance',
    owner: 'PlaybackEngine',
    cleanup: 'adapter.dispose()',
    releasePhase: 'media-change'
  },
  {
    resource: 'adapter-instance',
    owner: 'PlaybackEngine',
    cleanup: 'adapter.dispose()',
    releasePhase: 'engine-dispose'
  },
  {
    resource: 'object-url',
    owner: 'LocalFileAdapter',
    cleanup: 'URL.revokeObjectURL()',
    releasePhase: 'media-change'
  },
  {
    resource: 'object-url',
    owner: 'LocalFileAdapter',
    cleanup: 'URL.revokeObjectURL()',
    releasePhase: 'adapter-dispose'
  },
  {
    resource: 'dom-listener',
    owner: 'EmbedAdapter',
    cleanup: 'removeEventListener() / AbortController.abort()',
    releasePhase: 'adapter-dispose'
  },
  {
    resource: 'timer',
    owner: 'EmbedAdapter',
    cleanup: 'clearTimeout() / clearInterval()',
    releasePhase: 'adapter-dispose'
  },
  {
    resource: 'iframe',
    owner: 'EmbedAdapter',
    cleanup: 'remove listeners and set src = about:blank',
    releasePhase: 'media-change'
  },
  {
    resource: 'popup-window',
    owner: 'PopupAdapter',
    cleanup: 'remove listeners and close() when owned',
    releasePhase: 'media-change'
  },
  {
    resource: 'popup-window',
    owner: 'PopupAdapter',
    cleanup: 'remove listeners and close() when owned',
    releasePhase: 'adapter-dispose'
  },
  {
    resource: 'dom-listener',
    owner: 'PopupAdapter',
    cleanup: 'removeEventListener() / AbortController.abort()',
    releasePhase: 'adapter-dispose'
  }
]

export const listOwnershipForOwner = (
  owner: PlaybackResourceOwner
): readonly PlaybackResourceOwnershipRecord[] =>
  playbackResourceOwnership.filter(record => record.owner === owner)

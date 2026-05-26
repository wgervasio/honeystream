import { Disposable } from './disposable'

export type PlaybackLifecycleState = 'idle' | 'playing' | 'paused'
export type PlaybackMediaSource = 'direct-media' | 'website' | 'local-file'

export interface DesiredPlaybackModel {
  readonly state: PlaybackLifecycleState
  readonly positionMs: number
  readonly updatedAtHostMs: number
  readonly rate: number
  readonly durationMs?: number
}

export interface DesiredPlaybackMedia {
  readonly mediaId: string
  readonly source: PlaybackMediaSource
  readonly url: string
}

export interface PlaybackAdapterLoadRequest {
  readonly media: DesiredPlaybackMedia
}

export interface PlaybackAdapterApplyRequest {
  readonly desiredPlayback: DesiredPlaybackModel
  readonly seekToleranceMs: number
}

export interface PlaybackAdapter extends Disposable {
  readonly kind: string
  loadMedia(request: PlaybackAdapterLoadRequest): PromiseLike<void> | void
  applyPlayback(request: PlaybackAdapterApplyRequest): PromiseLike<void> | void
}

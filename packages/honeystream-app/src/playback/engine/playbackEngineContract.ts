import {
  DesiredPlaybackMedia,
  DesiredPlaybackModel,
  PlaybackAdapter
} from '../adapters/shared/playbackAdapter'

export interface PlaybackEngineDesiredState {
  readonly media?: DesiredPlaybackMedia
  readonly playback: DesiredPlaybackModel
  readonly seekToleranceMs?: number
}

export interface PlaybackEngineApplyResult {
  readonly adapterCreated: boolean
  readonly mediaChanged: boolean
  readonly adapterDisposed: boolean
  readonly seekToleranceMs: number
  readonly appliedPlayback: DesiredPlaybackModel
}

export interface PlaybackAdapterFactory {
  createAdapter(media: DesiredPlaybackMedia): PlaybackAdapter
}

export interface PlaybackEngineStateApplication {
  applyDesiredState(desiredState: PlaybackEngineDesiredState): Promise<PlaybackEngineApplyResult>
}

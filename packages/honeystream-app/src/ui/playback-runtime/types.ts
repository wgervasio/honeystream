import { PlaybackClockModel } from '../../domain/playback-clock'
import { SessionStatus } from '../../domain/session-state'

export interface PlaybackRuntimeSessionModel {
  readonly status: SessionStatus
  readonly hasCurrentMedia: boolean
  readonly hasNextMedia: boolean
  readonly canIssuePlaybackIntents: boolean
}

export interface PlaybackRuntimeControlIntents {
  onPlayPause(nextPlaying: boolean): void
  onSeek(nextPositionMs: number): void
  onSetRate(nextRate: number): void
  onNext(): void
}

export interface PlaybackRuntimeControlLabels {
  readonly play: string
  readonly pause: string
  readonly seekBackward: string
  readonly seekForward: string
  readonly rateDown: string
  readonly rateUp: string
  readonly next: string
}

export interface PlaybackRuntimeControlsProps {
  readonly className?: string
  readonly description?: string
  readonly id?: string
  readonly intents: PlaybackRuntimeControlIntents
  readonly labels?: Partial<PlaybackRuntimeControlLabels>
  readonly playback: PlaybackClockModel
  readonly clockSyncConfident?: boolean
  readonly rateStep?: number
  readonly seekStepMs?: number
  readonly session: PlaybackRuntimeSessionModel
  readonly title?: string
}

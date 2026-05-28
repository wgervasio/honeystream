import React, { memo } from 'react'
import { clampPlaybackPosition, clampPlaybackRate } from '../../domain/playback-clock'
import { PlaybackRuntimeControlLabels, PlaybackRuntimeControlsProps } from './types'

const DEFAULT_SEEK_STEP_MS = 10_000
const DEFAULT_RATE_STEP = 0.25
const MS_PER_SECOND = 1_000
const SECONDS_PER_MINUTE = 60

const DEFAULT_LABELS: Readonly<PlaybackRuntimeControlLabels> = Object.freeze({
  play: 'Play',
  pause: 'Pause',
  seekBackward: 'Seek -10s',
  seekForward: 'Seek +10s',
  rateDown: 'Rate -',
  rateUp: 'Rate +',
  next: 'Next'
})

const normalizePositiveStep = (value: number | undefined, fallback: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return fallback
  }

  return value
}

const createIntentHandler = (disabled: boolean, callback: () => void): (() => void) => () => {
  if (disabled) {
    return
  }

  callback()
}

const formatPlaybackPosition = (positionMs: number): string => {
  const safePositionMs = Number.isFinite(positionMs) && positionMs > 0 ? positionMs : 0
  const totalSeconds = Math.floor(safePositionMs / MS_PER_SECOND)
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE)
  const seconds = totalSeconds % SECONDS_PER_MINUTE

  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

interface PlaybackRuntimeIntentButton {
  readonly disabled: boolean
  readonly label: string
  readonly onClick: () => void
}

export interface PlaybackRuntimeControlViewModel {
  readonly next: PlaybackRuntimeIntentButton
  readonly playPause: PlaybackRuntimeIntentButton
  readonly positionMs: number
  readonly positionLabel: string
  readonly rateDown: PlaybackRuntimeIntentButton
  readonly rateLabel: string
  readonly rateUp: PlaybackRuntimeIntentButton
  readonly seekBackward: PlaybackRuntimeIntentButton
  readonly seekForward: PlaybackRuntimeIntentButton
}

export function createPlaybackRuntimeControlViewModel(
  props: PlaybackRuntimeControlsProps
): PlaybackRuntimeControlViewModel {
  const labels: PlaybackRuntimeControlLabels = {
    ...DEFAULT_LABELS,
    ...props.labels
  }
  const seekStepMs = normalizePositiveStep(props.seekStepMs, DEFAULT_SEEK_STEP_MS)
  const rateStep = normalizePositiveStep(props.rateStep, DEFAULT_RATE_STEP)
  const playbackRate = clampPlaybackRate(props.playback.rate)
  const playbackPositionMs = clampPlaybackPosition(
    props.playback.positionMs,
    props.playback.durationMs
  )

  const canIssueIntents = props.session.canIssuePlaybackIntents && props.session.status !== 'ended'
  const playbackIntentDisabled = !canIssueIntents || !props.session.hasCurrentMedia
  const nextIntentDisabled =
    !canIssueIntents || (!props.session.hasCurrentMedia && !props.session.hasNextMedia)

  const nextPlaying = props.playback.state !== 'playing'
  const nextSeekBackwardPositionMs = clampPlaybackPosition(
    playbackPositionMs - seekStepMs,
    props.playback.durationMs
  )
  const nextSeekForwardPositionMs = clampPlaybackPosition(
    playbackPositionMs + seekStepMs,
    props.playback.durationMs
  )
  const nextRateDown = clampPlaybackRate(playbackRate - rateStep)
  const nextRateUp = clampPlaybackRate(playbackRate + rateStep)
  const rateDownDisabled = playbackIntentDisabled || nextRateDown === playbackRate
  const rateUpDisabled = playbackIntentDisabled || nextRateUp === playbackRate

  return {
    playPause: {
      label: props.playback.state === 'playing' ? labels.pause : labels.play,
      disabled: playbackIntentDisabled,
      onClick: createIntentHandler(playbackIntentDisabled, () =>
        props.intents.onPlayPause(nextPlaying)
      )
    },
    seekBackward: {
      label: labels.seekBackward,
      disabled: playbackIntentDisabled,
      onClick: createIntentHandler(playbackIntentDisabled, () =>
        props.intents.onSeek(nextSeekBackwardPositionMs)
      )
    },
    seekForward: {
      label: labels.seekForward,
      disabled: playbackIntentDisabled,
      onClick: createIntentHandler(playbackIntentDisabled, () =>
        props.intents.onSeek(nextSeekForwardPositionMs)
      )
    },
    rateDown: {
      label: labels.rateDown,
      disabled: rateDownDisabled,
      onClick: createIntentHandler(rateDownDisabled, () => props.intents.onSetRate(nextRateDown))
    },
    rateUp: {
      label: labels.rateUp,
      disabled: rateUpDisabled,
      onClick: createIntentHandler(rateUpDisabled, () => props.intents.onSetRate(nextRateUp))
    },
    next: {
      label: labels.next,
      disabled: nextIntentDisabled,
      onClick: createIntentHandler(nextIntentDisabled, () => props.intents.onNext())
    },
    rateLabel: `${playbackRate.toFixed(2)}x`,
    positionMs: playbackPositionMs,
    positionLabel: formatPlaybackPosition(playbackPositionMs)
  }
}

export const PlaybackRuntimeControls = memo(function PlaybackRuntimeControls(
  props: PlaybackRuntimeControlsProps
) {
  const controls = createPlaybackRuntimeControlViewModel(props)

  return (
    <section
      id={props.id}
      className={props.className}
      data-playback-state={props.playback.state}
      data-session-state={props.session.status}
    >
      <button
        type="button"
        data-intent="playPause"
        disabled={controls.playPause.disabled}
        onClick={controls.playPause.onClick}
      >
        {controls.playPause.label}
      </button>
      <button
        type="button"
        data-intent="seekBackward"
        disabled={controls.seekBackward.disabled}
        onClick={controls.seekBackward.onClick}
      >
        {controls.seekBackward.label}
      </button>
      <button
        type="button"
        data-intent="seekForward"
        disabled={controls.seekForward.disabled}
        onClick={controls.seekForward.onClick}
      >
        {controls.seekForward.label}
      </button>
      <button
        type="button"
        data-intent="rateDown"
        disabled={controls.rateDown.disabled}
        onClick={controls.rateDown.onClick}
      >
        {controls.rateDown.label}
      </button>
      <span data-intent="rateValue">{controls.rateLabel}</span>
      <button
        type="button"
        data-intent="rateUp"
        disabled={controls.rateUp.disabled}
        onClick={controls.rateUp.onClick}
      >
        {controls.rateUp.label}
      </button>
      <button
        type="button"
        data-intent="next"
        disabled={controls.next.disabled}
        onClick={controls.next.onClick}
      >
        {controls.next.label}
      </button>
      <output
        data-intent="positionMs"
        data-position-ms={controls.positionMs}
        aria-label="Playback position"
      >
        {controls.positionLabel}
      </output>
    </section>
  )
})

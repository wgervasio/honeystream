import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PlaybackClockModel } from '../../domain/playback-clock'
import {
  PlaybackRuntimeControls,
  createPlaybackRuntimeControlViewModel
} from './PlaybackRuntimeControls'
import {
  PlaybackRuntimeControlIntents,
  PlaybackRuntimeControlsProps,
  PlaybackRuntimeSessionModel
} from './types'

interface IntentSpies {
  readonly onNext: jest.Mock
  readonly onPlayPause: jest.Mock
  readonly onSeek: jest.Mock
  readonly onSetRate: jest.Mock
}

interface Harness {
  readonly intents: PlaybackRuntimeControlIntents & IntentSpies
  readonly props: PlaybackRuntimeControlsProps
}

interface HarnessOverrides {
  readonly playback?: Partial<PlaybackClockModel>
  readonly rateStep?: number
  readonly seekStepMs?: number
  readonly session?: Partial<PlaybackRuntimeSessionModel>
}

const createHarness = (overrides: HarnessOverrides = {}): Harness => {
  const intents: PlaybackRuntimeControlIntents & IntentSpies = {
    onPlayPause: jest.fn(),
    onSeek: jest.fn(),
    onSetRate: jest.fn(),
    onNext: jest.fn()
  }

  const playback: PlaybackClockModel = {
    state: 'paused',
    positionMs: 15_000,
    updatedAtHostMs: 1_000,
    rate: 1,
    durationMs: 60_000,
    ...overrides.playback
  }
  const session: PlaybackRuntimeSessionModel = {
    status: 'connected',
    hasCurrentMedia: true,
    hasNextMedia: true,
    canIssuePlaybackIntents: true,
    ...overrides.session
  }

  return {
    intents,
    props: {
      intents,
      playback,
      session,
      rateStep: overrides.rateStep,
      seekStepMs: overrides.seekStepMs
    }
  }
}

const expectIntentDisabled = (html: string, intent: string): void => {
  expect(html).toMatch(new RegExp(`data-intent="${intent}"[^>]*disabled=""`))
}

const expectIntentEnabled = (html: string, intent: string): void => {
  expect(html).toMatch(new RegExp(`data-intent="${intent}"(?![^>]*disabled=)`))
}

describe('PlaybackRuntimeControls', () => {
  it('renders all playback controls as disabled when playback intents are not allowed', () => {
    const { props } = createHarness({
      session: {
        canIssuePlaybackIntents: false
      }
    })

    const html = renderToStaticMarkup(
      <PlaybackRuntimeControls {...props} id="runtime_playback_controls" />
    )
    expect(html).toContain('id="runtime_playback_controls"')
    expectIntentDisabled(html, 'playPause')
    expectIntentDisabled(html, 'seekBackward')
    expectIntentDisabled(html, 'seekForward')
    expectIntentDisabled(html, 'rateDown')
    expectIntentDisabled(html, 'rateUp')
    expectIntentDisabled(html, 'next')
    expect(html).toContain('data-playback-intent-state="disabled"')
    expect(html).toContain('data-sync-confident="warming"')
    expect(html).toContain('0:15 / 1:00')
  })

  it('renders optional cozy control title and guidance', () => {
    const { props } = createHarness()

    const html = renderToStaticMarkup(
      <PlaybackRuntimeControls
        {...props}
        title="Sync controls"
        description="Queue a source first; then play, pause, seek, speed, and next stay host-led."
      />
    )

    expect(html).toContain('data-playback-control-title="true"')
    expect(html).toContain('Sync controls')
    expect(html).toContain('Queue a source first')
    expect(html).toContain('host-led')
  })

  it('renders friendly seek labels and playback duration when known', () => {
    const { props } = createHarness()

    const html = renderToStaticMarkup(<PlaybackRuntimeControls {...props} clockSyncConfident={true} />)

    expect(html).toContain('Rewind 10s')
    expect(html).toContain('Fast forward 10s')
    expect(html).toContain('aria-label="Playback timeline"')
    expect(html).toContain('data-playback-intent-state="enabled"')
    expect(html).toContain('data-sync-confident="yes"')
    expect(html).toContain('0:15 / 1:00')
  })

  it('keeps next enabled when a following media item exists without a current media item', () => {
    const { props } = createHarness({
      session: {
        hasCurrentMedia: false,
        hasNextMedia: true
      }
    })

    const html = renderToStaticMarkup(<PlaybackRuntimeControls {...props} />)
    expectIntentDisabled(html, 'playPause')
    expectIntentDisabled(html, 'seekBackward')
    expectIntentDisabled(html, 'seekForward')
    expectIntentDisabled(html, 'rateDown')
    expectIntentDisabled(html, 'rateUp')
    expectIntentEnabled(html, 'next')
  })

  it('wires play/pause, seek, rate, and next callbacks to computed intent payloads', () => {
    const { intents, props } = createHarness({
      playback: {
        state: 'playing',
        positionMs: 12_000,
        rate: 1.25,
        durationMs: 15_000
      },
      seekStepMs: 5_000,
      rateStep: 0.5
    })
    const controls = createPlaybackRuntimeControlViewModel(props)

    controls.playPause.onClick()
    controls.seekBackward.onClick()
    controls.seekForward.onClick()
    controls.rateDown.onClick()
    controls.rateUp.onClick()
    controls.next.onClick()

    expect(intents.onPlayPause).toHaveBeenCalledWith(false)
    expect(intents.onSeek).toHaveBeenNthCalledWith(1, 7_000)
    expect(intents.onSeek).toHaveBeenNthCalledWith(2, 15_000)
    expect(intents.onSetRate).toHaveBeenNthCalledWith(1, 0.75)
    expect(intents.onSetRate).toHaveBeenNthCalledWith(2, 1.75)
    expect(intents.onNext).toHaveBeenCalledTimes(1)
  })

  it('does not invoke intent callbacks when a control is disabled', () => {
    const { intents, props } = createHarness({
      session: {
        canIssuePlaybackIntents: false
      }
    })
    const controls = createPlaybackRuntimeControlViewModel(props)

    controls.playPause.onClick()
    controls.seekBackward.onClick()
    controls.seekForward.onClick()
    controls.rateDown.onClick()
    controls.rateUp.onClick()
    controls.next.onClick()

    expect(intents.onPlayPause).not.toHaveBeenCalled()
    expect(intents.onSeek).not.toHaveBeenCalled()
    expect(intents.onSetRate).not.toHaveBeenCalled()
    expect(intents.onNext).not.toHaveBeenCalled()
  })
})

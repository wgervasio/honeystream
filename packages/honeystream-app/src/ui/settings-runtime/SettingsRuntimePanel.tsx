import React, { memo } from 'react'
import { MinimalSettings, SafeBrowseBehavior } from 'domain/settings/minimalSettings'
import {
  createSettingsRuntimeCallbacks,
  SettingsRuntimeChangeHandler
} from './settingsRuntimeCallbacks'
import { SettingsRuntimeNormalizationError } from './settingsRuntimeNormalization'

const EMPTY_NORMALIZATION_ERRORS: readonly SettingsRuntimeNormalizationError[] = Object.freeze([])

interface SettingsRuntimePanelProps {
  readonly className?: string
  readonly normalizationErrors?: readonly SettingsRuntimeNormalizationError[]
  readonly onSettingsChange: SettingsRuntimeChangeHandler
  readonly settings: MinimalSettings
}

const getVolumeLabel = (volume: number): string => {
  return `${Math.round(volume * 100)}%`
}

const parseVolume = (value: string): number | undefined => {
  const nextVolume = Number(value)
  return Number.isFinite(nextVolume) ? nextVolume : undefined
}

const parseSafeBrowseBehavior = (value: string): SafeBrowseBehavior => {
  return value === 'disabled' ? 'disabled' : 'prompt'
}

export const SettingsRuntimePanel = memo(function SettingsRuntimePanel(
  props: SettingsRuntimePanelProps
) {
  const errors = props.normalizationErrors || EMPTY_NORMALIZATION_ERRORS
  const callbacks = createSettingsRuntimeCallbacks(props.settings, props.onSettingsChange)

  return (
    <section className={props.className}>
      <div>
        <label htmlFor="settings-runtime-username">Username</label>
        <input
          id="settings-runtime-username"
          type="text"
          value={props.settings.username}
          onChange={event => callbacks.onUsernameChange(event.currentTarget.value)}
        />
      </div>

      <div>
        <label htmlFor="settings-runtime-volume">Volume</label>
        <input
          id="settings-runtime-volume"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={props.settings.volume}
          onChange={event => {
            const nextVolume = parseVolume(event.currentTarget.value)
            if (typeof nextVolume !== 'undefined') {
              callbacks.onVolumeChange(nextVolume)
            }
          }}
        />
        <output htmlFor="settings-runtime-volume">{getVolumeLabel(props.settings.volume)}</output>
      </div>

      <div>
        <label htmlFor="settings-runtime-mute">
          <input
            id="settings-runtime-mute"
            type="checkbox"
            checked={props.settings.mute}
            onChange={event => callbacks.onMuteChange(event.currentTarget.checked)}
          />
          Mute
        </label>
      </div>

      <div>
        <label htmlFor="settings-runtime-safe-browse">Safe browse behavior</label>
        <select
          id="settings-runtime-safe-browse"
          value={props.settings.safeBrowseBehavior}
          onChange={event =>
            callbacks.onSafeBrowseBehaviorChange(parseSafeBrowseBehavior(event.currentTarget.value))
          }
        >
          <option value="prompt">Prompt before loading unknown websites</option>
          <option value="disabled">Disabled</option>
        </select>
      </div>

      <fieldset>
        <legend>Adapter preferences</legend>
        <label htmlFor="settings-runtime-auto-fullscreen">
          <input
            id="settings-runtime-auto-fullscreen"
            type="checkbox"
            checked={props.settings.adapterPreferences.autoFullscreen}
            onChange={event => callbacks.onAutoFullscreenChange(event.currentTarget.checked)}
          />
          Auto fullscreen
        </label>
        <label htmlFor="settings-runtime-theater-mode">
          <input
            id="settings-runtime-theater-mode"
            type="checkbox"
            checked={props.settings.adapterPreferences.theaterMode}
            onChange={event => callbacks.onTheaterModeChange(event.currentTarget.checked)}
          />
          Theater mode
        </label>
      </fieldset>

      {errors.length > 0 ? (
        <section role="alert" aria-live="polite">
          <p>Normalization errors</p>
          <ul>
            {errors.map((error, index) => (
              <li key={`${error.field}-${index}`}>{`${error.field}: ${error.code}`}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  )
})

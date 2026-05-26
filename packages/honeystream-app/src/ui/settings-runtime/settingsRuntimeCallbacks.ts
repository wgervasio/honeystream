import { MinimalSettings, SafeBrowseBehavior } from 'domain/settings/minimalSettings'

export type SettingsRuntimeChangeHandler = (nextSettings: MinimalSettings) => void

export interface SettingsRuntimeCallbacks {
  readonly onUsernameChange: (username: string) => void
  readonly onVolumeChange: (volume: number) => void
  readonly onMuteChange: (mute: boolean) => void
  readonly onSafeBrowseBehaviorChange: (safeBrowseBehavior: SafeBrowseBehavior) => void
  readonly onAutoFullscreenChange: (autoFullscreen: boolean) => void
  readonly onTheaterModeChange: (theaterMode: boolean) => void
}

const updateAdapterPreferences = (
  settings: MinimalSettings,
  updates: Partial<MinimalSettings['adapterPreferences']>
): MinimalSettings => {
  return {
    ...settings,
    adapterPreferences: {
      ...settings.adapterPreferences,
      ...updates
    }
  }
}

export const createSettingsRuntimeCallbacks = (
  settings: MinimalSettings,
  onSettingsChange: SettingsRuntimeChangeHandler
): SettingsRuntimeCallbacks => {
  return {
    onUsernameChange(username) {
      onSettingsChange({
        ...settings,
        username
      })
    },
    onVolumeChange(volume) {
      onSettingsChange({
        ...settings,
        volume
      })
    },
    onMuteChange(mute) {
      onSettingsChange({
        ...settings,
        mute
      })
    },
    onSafeBrowseBehaviorChange(safeBrowseBehavior) {
      onSettingsChange({
        ...settings,
        safeBrowseBehavior
      })
    },
    onAutoFullscreenChange(autoFullscreen) {
      onSettingsChange(updateAdapterPreferences(settings, { autoFullscreen }))
    },
    onTheaterModeChange(theaterMode) {
      onSettingsChange(updateAdapterPreferences(settings, { theaterMode }))
    }
  }
}

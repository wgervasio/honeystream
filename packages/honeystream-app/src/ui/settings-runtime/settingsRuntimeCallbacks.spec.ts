import { createDefaultMinimalSettings } from 'domain/settings/minimalSettings'
import { createSettingsRuntimeCallbacks } from './settingsRuntimeCallbacks'

describe('settings runtime callbacks', () => {
  it('emits callback payloads for top-level settings fields', () => {
    const settings = createDefaultMinimalSettings()
    const onSettingsChange = jest.fn()
    const callbacks = createSettingsRuntimeCallbacks(settings, onSettingsChange)

    callbacks.onUsernameChange('honey')
    callbacks.onVolumeChange(0.2)
    callbacks.onMuteChange(true)
    callbacks.onSafeBrowseBehaviorChange('disabled')

    expect(onSettingsChange.mock.calls).toEqual([
      [{ ...settings, username: 'honey' }],
      [{ ...settings, volume: 0.2 }],
      [{ ...settings, mute: true }],
      [{ ...settings, safeBrowseBehavior: 'disabled' }]
    ])
  })

  it('emits callback payloads for adapter preference fields', () => {
    const settings = createDefaultMinimalSettings()
    const onSettingsChange = jest.fn()
    const callbacks = createSettingsRuntimeCallbacks(settings, onSettingsChange)

    callbacks.onAutoFullscreenChange(false)
    callbacks.onTheaterModeChange(true)

    expect(onSettingsChange.mock.calls).toEqual([
      [
        {
          ...settings,
          adapterPreferences: {
            ...settings.adapterPreferences,
            autoFullscreen: false
          }
        }
      ],
      [
        {
          ...settings,
          adapterPreferences: {
            ...settings.adapterPreferences,
            theaterMode: true
          }
        }
      ]
    ])
  })
})

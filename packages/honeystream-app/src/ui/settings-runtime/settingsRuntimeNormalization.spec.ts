import { createDefaultMinimalSettings } from 'domain/settings/minimalSettings'
import { normalizeSettingsRuntimeInput } from './settingsRuntimeNormalization'

describe('settings runtime normalization', () => {
  it('returns default settings with an error when payload is not an object', () => {
    const result = normalizeSettingsRuntimeInput('invalid')

    expect(result.settings).toEqual(createDefaultMinimalSettings())
    expect(result.errors).toEqual([{ field: 'settings', code: 'invalid-type' }])
  })

  it('reports normalization errors for invalid field values', () => {
    const result = normalizeSettingsRuntimeInput({
      username: 'x',
      volume: 4.2,
      mute: 'yes',
      safeBrowseBehavior: 'always',
      adapterPreferences: {
        autoFullscreen: 'on',
        theaterMode: 1
      }
    })

    expect(result.settings).toEqual({
      username: 'Unknown',
      volume: 1,
      mute: false,
      safeBrowseBehavior: 'prompt',
      adapterPreferences: {
        autoFullscreen: true,
        theaterMode: false
      }
    })
    expect(result.errors).toEqual([
      { field: 'username', code: 'too-short' },
      { field: 'volume', code: 'out-of-range' },
      { field: 'mute', code: 'invalid-type' },
      { field: 'safeBrowseBehavior', code: 'invalid-value' },
      { field: 'adapterPreferences.autoFullscreen', code: 'invalid-type' },
      { field: 'adapterPreferences.theaterMode', code: 'invalid-type' }
    ])
  })

  it('accepts valid minimal settings without normalization errors', () => {
    const result = normalizeSettingsRuntimeInput({
      username: 'honey',
      volume: 0.35,
      mute: true,
      safeBrowseBehavior: 'disabled',
      adapterPreferences: {
        autoFullscreen: false,
        theaterMode: true
      }
    })

    expect(result.errors).toEqual([])
    expect(result.settings).toEqual({
      username: 'honey',
      volume: 0.35,
      mute: true,
      safeBrowseBehavior: 'disabled',
      adapterPreferences: {
        autoFullscreen: false,
        theaterMode: true
      }
    })
  })

  it('supports legacy safe browse and adapter preference fields', () => {
    const result = normalizeSettingsRuntimeInput({
      username: 'legacy',
      volume: 0.4,
      mute: false,
      safeBrowse: false,
      autoFullscreen: false,
      theaterMode: true
    })

    expect(result.errors).toEqual([])
    expect(result.settings.safeBrowseBehavior).toBe('disabled')
    expect(result.settings.adapterPreferences).toEqual({
      autoFullscreen: false,
      theaterMode: true
    })
  })
})

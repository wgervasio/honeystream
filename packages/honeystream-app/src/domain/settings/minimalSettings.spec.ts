import { DEFAULT_USERNAME } from 'constants/settings'
import {
  createDefaultMinimalSettings,
  normalizeMinimalSettings,
  safeBrowseBehaviorToBoolean,
  toLegacyMinimalSettingsPatch
} from './minimalSettings'

describe('minimal settings schema', () => {
  it('creates a stable default shape', () => {
    expect(createDefaultMinimalSettings()).toEqual({
      username: DEFAULT_USERNAME,
      volume: 0.75,
      mute: false,
      safeBrowseBehavior: 'prompt',
      adapterPreferences: {
        autoFullscreen: true,
        theaterMode: false
      }
    })
  })

  it('normalizes legacy flat settings fields', () => {
    const normalized = normalizeMinimalSettings({
      username: '  sam😀  ',
      volume: 1.25,
      mute: true,
      safeBrowse: false,
      autoFullscreen: false,
      theaterMode: true
    })

    expect(normalized).toEqual({
      username: 'sam',
      volume: 1,
      mute: true,
      safeBrowseBehavior: 'disabled',
      adapterPreferences: {
        autoFullscreen: false,
        theaterMode: true
      }
    })
  })

  it('prefers nested adapter preferences when provided', () => {
    const normalized = normalizeMinimalSettings({
      autoFullscreen: false,
      theaterMode: true,
      adapterPreferences: {
        autoFullscreen: true,
        theaterMode: false
      }
    })

    expect(normalized.adapterPreferences).toEqual({
      autoFullscreen: true,
      theaterMode: false
    })
  })

  it('falls back to defaults for invalid values', () => {
    const normalized = normalizeMinimalSettings({
      username: 'x',
      volume: 'loud',
      mute: 'no',
      safeBrowseBehavior: 'unexpected',
      adapterPreferences: {
        autoFullscreen: 'yes',
        theaterMode: 'no'
      }
    })

    expect(normalized).toEqual(createDefaultMinimalSettings())
  })

  it('converts safe browse behavior and adapter settings to legacy patch fields', () => {
    const normalized = normalizeMinimalSettings({
      username: 'honey',
      volume: 0.4,
      mute: false,
      safeBrowseBehavior: 'disabled',
      adapterPreferences: {
        autoFullscreen: false,
        theaterMode: true
      }
    })

    expect(safeBrowseBehaviorToBoolean(normalized.safeBrowseBehavior)).toBe(false)
    expect(toLegacyMinimalSettingsPatch(normalized)).toEqual({
      username: 'honey',
      volume: 0.4,
      mute: false,
      safeBrowse: false,
      autoFullscreen: false,
      theaterMode: true
    })
  })
})

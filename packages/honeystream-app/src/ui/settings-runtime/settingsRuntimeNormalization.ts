import {
  createDefaultMinimalSettings,
  MinimalSettings,
  normalizeMinimalSettings
} from 'domain/settings/minimalSettings'

export type SettingsRuntimeNormalizationField =
  | 'settings'
  | 'username'
  | 'volume'
  | 'mute'
  | 'safeBrowseBehavior'
  | 'adapterPreferences'
  | 'adapterPreferences.autoFullscreen'
  | 'adapterPreferences.theaterMode'

export type SettingsRuntimeNormalizationCode =
  | 'invalid-type'
  | 'invalid-value'
  | 'out-of-range'
  | 'too-short'

export interface SettingsRuntimeNormalizationError {
  readonly field: SettingsRuntimeNormalizationField
  readonly code: SettingsRuntimeNormalizationCode
}

export interface SettingsRuntimeNormalizationResult {
  readonly settings: MinimalSettings
  readonly errors: readonly SettingsRuntimeNormalizationError[]
}

type UnknownRecord = Record<string, unknown>

const DEFAULT_SETTINGS = createDefaultMinimalSettings()

const isRecord = (value: unknown): value is UnknownRecord => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const isSafeBrowseValue = (value: unknown): boolean => {
  return value === true || value === false || value === 'prompt' || value === 'disabled'
}

const getUsernameError = (
  value: unknown
): SettingsRuntimeNormalizationError | undefined => {
  if (typeof value === 'undefined') return undefined
  if (typeof value !== 'string') {
    return {
      field: 'username',
      code: 'invalid-type'
    }
  }

  const normalizedUsername = normalizeMinimalSettings({ username: value }).username
  if (normalizedUsername === DEFAULT_SETTINGS.username && value.trim() !== DEFAULT_SETTINGS.username) {
    return {
      field: 'username',
      code: 'too-short'
    }
  }

  return undefined
}

const getVolumeError = (value: unknown): SettingsRuntimeNormalizationError | undefined => {
  if (typeof value === 'undefined') return undefined

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return {
      field: 'volume',
      code: 'invalid-type'
    }
  }

  if (value < 0 || value > 1) {
    return {
      field: 'volume',
      code: 'out-of-range'
    }
  }

  return undefined
}

const getMuteError = (value: unknown): SettingsRuntimeNormalizationError | undefined => {
  if (typeof value === 'undefined') return undefined
  if (typeof value === 'boolean') return undefined

  return {
    field: 'mute',
    code: 'invalid-type'
  }
}

const getSafeBrowseBehaviorError = (
  source: UnknownRecord
): SettingsRuntimeNormalizationError | undefined => {
  const safeBrowseValue =
    typeof source.safeBrowseBehavior === 'undefined' ? source.safeBrowse : source.safeBrowseBehavior

  if (typeof safeBrowseValue === 'undefined') return undefined
  if (isSafeBrowseValue(safeBrowseValue)) return undefined

  return {
    field: 'safeBrowseBehavior',
    code: 'invalid-value'
  }
}

export const normalizeSettingsRuntimeInput = (
  value: unknown
): SettingsRuntimeNormalizationResult => {
  const settings = normalizeMinimalSettings(value)

  if (!isRecord(value)) {
    return {
      settings,
      errors: [{ field: 'settings', code: 'invalid-type' }]
    }
  }

  const errors: SettingsRuntimeNormalizationError[] = []
  const usernameError = getUsernameError(value.username)
  const volumeError = getVolumeError(value.volume)
  const muteError = getMuteError(value.mute)
  const safeBrowseBehaviorError = getSafeBrowseBehaviorError(value)

  const adapterPreferencesValue = value.adapterPreferences
  let adapterPreferences: UnknownRecord | undefined
  if (typeof adapterPreferencesValue !== 'undefined') {
    if (!isRecord(adapterPreferencesValue)) {
      errors.push({
        field: 'adapterPreferences',
        code: 'invalid-type'
      })
    } else {
      adapterPreferences = adapterPreferencesValue
    }
  }

  if (usernameError) errors.push(usernameError)
  if (volumeError) errors.push(volumeError)
  if (muteError) errors.push(muteError)
  if (safeBrowseBehaviorError) errors.push(safeBrowseBehaviorError)

  const autoFullscreenValue =
    adapterPreferences && typeof adapterPreferences.autoFullscreen !== 'undefined'
      ? adapterPreferences.autoFullscreen
      : value.autoFullscreen
  if (typeof autoFullscreenValue !== 'undefined' && typeof autoFullscreenValue !== 'boolean') {
    errors.push({
      field: 'adapterPreferences.autoFullscreen',
      code: 'invalid-type'
    })
  }

  const theaterModeValue =
    adapterPreferences && typeof adapterPreferences.theaterMode !== 'undefined'
      ? adapterPreferences.theaterMode
      : value.theaterMode
  if (typeof theaterModeValue !== 'undefined' && typeof theaterModeValue !== 'boolean') {
    errors.push({
      field: 'adapterPreferences.theaterMode',
      code: 'invalid-type'
    })
  }

  return {
    settings,
    errors
  }
}

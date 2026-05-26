export type SafeBrowseBehavior = 'prompt' | 'disabled'

export interface AdapterPreferences {
  autoFullscreen: boolean
  theaterMode: boolean
}

export interface MinimalSettings {
  username: string
  volume: number
  mute: boolean
  safeBrowseBehavior: SafeBrowseBehavior
  adapterPreferences: AdapterPreferences
}

export interface LegacyMinimalSettingsPatch {
  username: string
  volume: number
  mute: boolean
  safeBrowse: boolean
  autoFullscreen: boolean
  theaterMode: boolean
}

const DEFAULT_VOLUME = 0.75
const DEFAULT_USERNAME = 'Unknown'
const USERNAME_MIN_LEN = 2
const USERNAME_MAX_LEN = 32

let EMOJI_REGEX: RegExp

try {
  // Keep domain username normalization compatible without importing legacy app modules.
  EMOJI_REGEX = new RegExp(
    '\\p{Emoji_Modifier_Base}\\p{Emoji_Modifier}?|\\p{Emoji_Presentation}|\\p{Emoji}\\uFE0F',
    'gu'
  )
} catch {
  EMOJI_REGEX = /([\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2694-\u2697]|\uD83E[\uDD10-\uDD5D])/g
}

const DEFAULT_ADAPTER_PREFERENCES: AdapterPreferences = {
  autoFullscreen: true,
  theaterMode: false
}

const DEFAULT_MINIMAL_SETTINGS: MinimalSettings = {
  username: DEFAULT_USERNAME,
  volume: DEFAULT_VOLUME,
  mute: false,
  safeBrowseBehavior: 'prompt',
  adapterPreferences: DEFAULT_ADAPTER_PREFERENCES
}

type UnknownRecord = Record<string, unknown>

const isRecord = (value: unknown): value is UnknownRecord => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const readBoolean = (value: unknown): boolean | undefined => {
  return typeof value === 'boolean' ? value : undefined
}

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max)
}

const normalizeUsername = (value: unknown): string => {
  if (typeof value !== 'string') return DEFAULT_MINIMAL_SETTINGS.username

  const normalizedUsername = value
    .trim()
    .replace(EMOJI_REGEX, '')
    .substring(0, USERNAME_MAX_LEN)
  return normalizedUsername.length >= USERNAME_MIN_LEN
    ? normalizedUsername
    : DEFAULT_MINIMAL_SETTINGS.username
}

const normalizeVolume = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_MINIMAL_SETTINGS.volume
  }
  return clamp(value, 0, 1)
}

const normalizeSafeBrowseBehavior = (value: unknown): SafeBrowseBehavior => {
  if (value === true || value === 'prompt') return 'prompt'
  if (value === false || value === 'disabled') return 'disabled'
  return DEFAULT_MINIMAL_SETTINGS.safeBrowseBehavior
}

const normalizeAdapterPreferences = (value: UnknownRecord): AdapterPreferences => {
  const nestedPreferences = isRecord(value.adapterPreferences) ? value.adapterPreferences : undefined

  const nestedAutoFullscreen = readBoolean(nestedPreferences && nestedPreferences.autoFullscreen)
  const legacyAutoFullscreen = readBoolean(value.autoFullscreen)
  const autoFullscreen =
    typeof nestedAutoFullscreen === 'undefined'
      ? typeof legacyAutoFullscreen === 'undefined'
        ? DEFAULT_MINIMAL_SETTINGS.adapterPreferences.autoFullscreen
        : legacyAutoFullscreen
      : nestedAutoFullscreen

  const nestedTheaterMode = readBoolean(nestedPreferences && nestedPreferences.theaterMode)
  const legacyTheaterMode = readBoolean(value.theaterMode)
  const theaterMode =
    typeof nestedTheaterMode === 'undefined'
      ? typeof legacyTheaterMode === 'undefined'
        ? DEFAULT_MINIMAL_SETTINGS.adapterPreferences.theaterMode
        : legacyTheaterMode
      : nestedTheaterMode

  return {
    autoFullscreen,
    theaterMode
  }
}

export const createDefaultMinimalSettings = (): MinimalSettings => {
  return {
    username: DEFAULT_MINIMAL_SETTINGS.username,
    volume: DEFAULT_MINIMAL_SETTINGS.volume,
    mute: DEFAULT_MINIMAL_SETTINGS.mute,
    safeBrowseBehavior: DEFAULT_MINIMAL_SETTINGS.safeBrowseBehavior,
    adapterPreferences: {
      autoFullscreen: DEFAULT_MINIMAL_SETTINGS.adapterPreferences.autoFullscreen,
      theaterMode: DEFAULT_MINIMAL_SETTINGS.adapterPreferences.theaterMode
    }
  }
}

export const normalizeMinimalSettings = (value: unknown): MinimalSettings => {
  if (!isRecord(value)) return createDefaultMinimalSettings()

  const mute = readBoolean(value.mute)
  const safeBrowseValue =
    typeof value.safeBrowseBehavior === 'undefined' ? value.safeBrowse : value.safeBrowseBehavior

  return {
    username: normalizeUsername(value.username),
    volume: normalizeVolume(value.volume),
    mute: typeof mute === 'undefined' ? DEFAULT_MINIMAL_SETTINGS.mute : mute,
    safeBrowseBehavior: normalizeSafeBrowseBehavior(safeBrowseValue),
    adapterPreferences: normalizeAdapterPreferences(value)
  }
}

export const safeBrowseBehaviorToBoolean = (behavior: SafeBrowseBehavior): boolean => {
  return behavior === 'prompt'
}

export const toLegacyMinimalSettingsPatch = (
  settings: MinimalSettings
): LegacyMinimalSettingsPatch => {
  return {
    username: settings.username,
    volume: settings.volume,
    mute: settings.mute,
    safeBrowse: safeBrowseBehaviorToBoolean(settings.safeBrowseBehavior),
    autoFullscreen: settings.adapterPreferences.autoFullscreen,
    theaterMode: settings.adapterPreferences.theaterMode
  }
}

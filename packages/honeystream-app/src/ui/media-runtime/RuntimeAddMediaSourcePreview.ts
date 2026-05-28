import { classifyMediaProvider, classifyMediaUrl, MediaProvider } from '../../protocol'

export type RuntimeAddMediaSourcePreviewKind = 'direct-media' | 'invalid' | 'website'
export type RuntimeAddMediaConfidenceState = 'idle' | 'ready' | 'warning'
type KnownRuntimeMediaProvider = Exclude<MediaProvider, 'unknown'>

export interface RuntimeAddMediaSourcePreview {
  readonly detail: string
  readonly kind: RuntimeAddMediaSourcePreviewKind
  readonly label: string
  readonly normalizedFromShorthand: boolean
  readonly normalizedUrl: string
  readonly provider?: MediaProvider
}

export interface RuntimeAddMediaConfidenceItem {
  readonly detail: string
  readonly id: string
  readonly label: string
  readonly state: RuntimeAddMediaConfidenceState
}

const PROVIDER_LABELS: Record<MediaProvider, string> = {
  youtube: 'YouTube',
  animepahe: 'AnimePahe',
  cineby: 'Cineby',
  miruro: 'Miruro',
  unknown: 'Website'
}

const URL_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i
const IPV4_HOST_PATTERN = /^\d{1,3}(?:\.\d{1,3}){3}$/
const WHITESPACE_PATTERN = /\s/

const parseHttpUrl = (value: string): URL | undefined => {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : undefined
  } catch {
    return undefined
  }
}

const hasLikelyHttpHost = (url: URL): boolean =>
  url.hostname === 'localhost' ||
  url.hostname.indexOf('.') !== -1 ||
  IPV4_HOST_PATTERN.test(url.hostname)

export const normalizeRuntimeAddMediaHttpUrl = (value: string): string | undefined => {
  const trimmedValue = value.trim()
  if (trimmedValue.length === 0) {
    return undefined
  }

  const parsedUrl = parseHttpUrl(trimmedValue)
  if (parsedUrl) {
    return parsedUrl.toString()
  }

  if (
    URL_SCHEME_PATTERN.test(trimmedValue) ||
    trimmedValue.startsWith('//') ||
    WHITESPACE_PATTERN.test(trimmedValue)
  ) {
    return undefined
  }

  const shorthandUrl = parseHttpUrl(`https://${trimmedValue}`)
  if (!shorthandUrl || !hasLikelyHttpHost(shorthandUrl)) {
    return undefined
  }

  return shorthandUrl.toString()
}

export const isRuntimeAddMediaHttpUrl = (value: string): boolean =>
  typeof normalizeRuntimeAddMediaHttpUrl(value) === 'string'

export const isRuntimeAddMediaShorthandHttpUrl = (value: string): boolean => {
  const trimmedValue = value.trim()
  if (trimmedValue.length === 0 || parseHttpUrl(trimmedValue)) {
    return false
  }

  return typeof normalizeRuntimeAddMediaHttpUrl(trimmedValue) === 'string'
}

const isKnownProvider = (
  provider: MediaProvider | undefined
): provider is KnownRuntimeMediaProvider => typeof provider === 'string' && provider !== 'unknown'

const getBuddyCheckDetail = (sourcePreview: RuntimeAddMediaSourcePreview | undefined): string => {
  if (!sourcePreview || sourcePreview.kind === 'invalid') {
    return 'Queue things both browsers can open, or use local files on both sides.'
  }

  if (sourcePreview.kind === 'website' && isKnownProvider(sourcePreview.provider)) {
    const providerLabel = PROVIDER_LABELS[sourcePreview.provider]
    return `${providerLabel} is covered by the low-latency streaming-site mock tests; still use pages both browsers can open.`
  }

  if (sourcePreview.kind === 'website') {
    return 'This website can work when both browsers can open it; test the exact page before movie time.'
  }

  return 'Direct media works best when both browsers can fetch the same clean URL.'
}

const getSyncBudgetDetail = (sourcePreview: RuntimeAddMediaSourcePreview | undefined): string => {
  if (!sourcePreview || sourcePreview.kind === 'invalid') {
    return 'Honeystream keeps video local and syncs only the tiny control stream.'
  }

  return 'Low-latency sync sends compact playback commands, not the video bytes, with the mock round trip budgeted under 32ms.'
}

export const createRuntimeAddMediaSourcePreview = (
  value: string
): RuntimeAddMediaSourcePreview | undefined => {
  const trimmedValue = value.trim()
  if (trimmedValue.length === 0) {
    return undefined
  }

  const normalizedUrl = normalizeRuntimeAddMediaHttpUrl(trimmedValue)
  if (!normalizedUrl) {
    return {
      kind: 'invalid',
      label: 'Needs a watch link',
      detail: 'Paste a site like youtube.com/watch or a complete http:// or https:// URL.',
      normalizedFromShorthand: false,
      normalizedUrl: ''
    }
  }

  const normalizedFromShorthand = isRuntimeAddMediaShorthandHttpUrl(trimmedValue)

  if (classifyMediaUrl(normalizedUrl) === 'website') {
    const provider = classifyMediaProvider(normalizedUrl)
    const providerLabel = PROVIDER_LABELS[provider]
    const normalizedDetail = normalizedFromShorthand
      ? ' Honeystream will add https:// automatically.'
      : ''

    return {
      kind: 'website',
      label: provider === 'unknown' ? 'Website lane' : `${providerLabel} lane`,
      detail:
        provider === 'unknown'
          ? `Each browser opens this page locally while controls stay synced.${normalizedDetail}`
          : `${providerLabel} page detected. Each browser opens it locally while controls stay synced.${normalizedDetail}`,
      normalizedFromShorthand,
      normalizedUrl,
      provider
    }
  }

  return {
    kind: 'direct-media',
    label: 'Direct media lane',
    detail: normalizedFromShorthand
      ? 'This looks like playable media. Honeystream will add https:// automatically.'
      : 'This looks like a playable media URL for the shared queue.',
    normalizedFromShorthand,
    normalizedUrl
  }
}

export const createRuntimeAddMediaConfidenceItems = (
  sourcePreview: RuntimeAddMediaSourcePreview | undefined
): readonly RuntimeAddMediaConfidenceItem[] => {
  const isInvalid = sourcePreview ? sourcePreview.kind === 'invalid' : false
  const isReady = sourcePreview ? sourcePreview.kind !== 'invalid' : false
  const laneLabel =
    sourcePreview && sourcePreview.kind !== 'invalid' ? sourcePreview.label : 'Lane preview'
  const laneDetail =
    sourcePreview && sourcePreview.kind !== 'invalid'
      ? sourcePreview.detail
      : 'Paste first, then Honeystream shows where it will play.'

  return [
    {
      id: 'full-link',
      label:
        sourcePreview && sourcePreview.normalizedFromShorthand
          ? 'HTTPS added'
          : isReady
          ? 'Full link ready'
          : isInvalid
          ? 'Link needs cleanup'
          : 'Paste watch link',
      detail: isReady
        ? sourcePreview && sourcePreview.normalizedFromShorthand
          ? 'Honeystream will add https:// automatically.'
          : 'http:// or https:// source is ready to queue.'
        : 'Use a site like youtube.com/watch or a complete watch URL.',
      state: isReady ? 'ready' : isInvalid ? 'warning' : 'idle'
    },
    {
      id: 'source-lane',
      label: laneLabel,
      detail: laneDetail,
      state: isReady ? 'ready' : isInvalid ? 'warning' : 'idle'
    },
    {
      id: 'buddy-check',
      label: isReady ? 'Buddy can test it' : 'Buddy check',
      detail: getBuddyCheckDetail(sourcePreview),
      state: isReady ? 'ready' : 'idle'
    },
    {
      id: 'sync-budget',
      label: isReady ? 'Low-latency sync path' : 'Sync check',
      detail: getSyncBudgetDetail(sourcePreview),
      state: isReady ? 'ready' : 'idle'
    }
  ]
}

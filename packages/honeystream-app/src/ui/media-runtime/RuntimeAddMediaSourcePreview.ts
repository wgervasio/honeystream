import { classifyMediaProvider, classifyMediaUrl, MediaProvider } from '../../protocol'

export type RuntimeAddMediaSourcePreviewKind = 'direct-media' | 'invalid' | 'website'
export type RuntimeAddMediaConfidenceState = 'idle' | 'ready' | 'warning'

export interface RuntimeAddMediaSourcePreview {
  readonly detail: string
  readonly kind: RuntimeAddMediaSourcePreviewKind
  readonly label: string
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

export const isRuntimeAddMediaHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export const createRuntimeAddMediaSourcePreview = (
  value: string
): RuntimeAddMediaSourcePreview | undefined => {
  const trimmedValue = value.trim()
  if (trimmedValue.length === 0) {
    return undefined
  }

  if (!isRuntimeAddMediaHttpUrl(trimmedValue)) {
    return {
      kind: 'invalid',
      label: 'Needs full link',
      detail: 'Paste the complete http:// or https:// watch page.'
    }
  }

  if (classifyMediaUrl(trimmedValue) === 'website') {
    const provider = classifyMediaProvider(trimmedValue)
    const providerLabel = PROVIDER_LABELS[provider]

    return {
      kind: 'website',
      label: provider === 'unknown' ? 'Website lane' : `${providerLabel} lane`,
      detail:
        provider === 'unknown'
          ? 'Each browser opens this page locally while controls stay synced.'
          : `${providerLabel} page detected. Each browser opens it locally while controls stay synced.`,
      provider
    }
  }

  return {
    kind: 'direct-media',
    label: 'Direct media lane',
    detail: 'This looks like a playable media URL for the shared queue.'
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
      label: isReady ? 'Full link ready' : isInvalid ? 'Full link needed' : 'Paste full link',
      detail: isReady
        ? 'http:// or https:// source is ready to queue.'
        : 'Use the complete watch URL.',
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
      detail: 'Queue things both browsers can open, or use local files on both sides.',
      state: isReady ? 'ready' : 'idle'
    },
    {
      id: 'sync-budget',
      label: isReady ? 'Low-latency sync path' : 'Sync check',
      detail: isReady
        ? 'Honeystream shares compact playback commands, not the video bytes.'
        : 'Honeystream keeps video local and syncs only the tiny control stream.',
      state: isReady ? 'ready' : 'idle'
    }
  ]
}

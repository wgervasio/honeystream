import { IMediaItem } from 'lobby/reducers/mediaPlayer'

export interface LocalFileMetadata {
  kind: 'local-file'
  key: string
  name: string
  size: number
  type?: string
  lastModified?: number
}

const localFileUrls = new Map<string, string>()

const encodeKeyPart = (value: string | number | undefined) =>
  encodeURIComponent(typeof value === 'undefined' ? '' : `${value}`)

export const createLocalFileKey = (file: File): string =>
  [file.name, file.size, file.type || 'video'].map(encodeKeyPart).join(':')

export const createLocalFileMetadata = (file: File): LocalFileMetadata => ({
  kind: 'local-file',
  key: createLocalFileKey(file),
  name: file.name,
  size: file.size,
  type: file.type || undefined,
  lastModified: file.lastModified || undefined
})

export const localFileToMediaUrl = (metadata: LocalFileMetadata) =>
  `metastream-local://${encodeURIComponent(metadata.key)}`

export const registerLocalFile = (file: File, key?: string): LocalFileMetadata => {
  if (typeof URL.createObjectURL !== 'function') {
    throw new Error('This browser does not support local file playback.')
  }

  const metadata = createLocalFileMetadata(file)
  const fileKey = key || metadata.key
  const previousUrl = localFileUrls.get(fileKey)

  if (previousUrl && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(previousUrl)
  }

  localFileUrls.set(fileKey, URL.createObjectURL(file))
  return { ...metadata, key: fileKey }
}

export const getLocalFileUrl = (metadata: LocalFileMetadata): string | undefined =>
  localFileUrls.get(metadata.key)

export const getLocalFileMetadata = (media?: IMediaItem): LocalFileMetadata | undefined => {
  const state = media && media.state
  if (!state || state.kind !== 'local-file') return
  if (typeof state.key !== 'string') return
  if (typeof state.name !== 'string') return
  if (typeof state.size !== 'number') return

  return {
    kind: 'local-file',
    key: state.key,
    name: state.name,
    size: state.size,
    type: typeof state.type === 'string' ? state.type : undefined,
    lastModified: typeof state.lastModified === 'number' ? state.lastModified : undefined
  }
}

export const isLocalFileMedia = (media?: IMediaItem): boolean =>
  Boolean(getLocalFileMetadata(media))

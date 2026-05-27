export interface LocalFileMetadata {
  readonly kind: 'local-file'
  readonly key: string
  readonly name: string
  readonly size: number
  readonly type?: string
  readonly lastModified?: number
}

export interface LocalFileObjectUrlApi {
  createObjectURL(file: File): string
  revokeObjectURL(objectUrl: string): void
}

const LOCAL_FILE_KIND = 'local-file'
const LOCAL_FILE_SCHEME = 'honeystream-local://'
const LOCAL_FILE_UNSUPPORTED_ERROR = 'This browser does not support local file playback.'

const encodeKeyPart = (value: string | number | undefined): string =>
  encodeURIComponent(typeof value === 'undefined' ? '' : `${value}`)

const toOptionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined

const toNonNegativeNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const browserObjectUrlApi: LocalFileObjectUrlApi = {
  createObjectURL(file: File): string {
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
      throw new Error(LOCAL_FILE_UNSUPPORTED_ERROR)
    }
    return URL.createObjectURL(file)
  },
  revokeObjectURL(objectUrl: string): void {
    if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(objectUrl)
    }
  }
}

export const createLocalFileKey = (file: File): string =>
  [file.name, file.size, file.type || 'video'].map(encodeKeyPart).join(':')

export const createLocalFileMetadata = (file: File): LocalFileMetadata => ({
  kind: LOCAL_FILE_KIND,
  key: createLocalFileKey(file),
  name: file.name,
  size: file.size,
  type: file.type || undefined,
  lastModified: file.lastModified || undefined
})

export const localFileToMediaUrl = (metadata: LocalFileMetadata): string =>
  `${LOCAL_FILE_SCHEME}${encodeURIComponent(metadata.key)}`

export const localFileMediaUrlToKey = (url: string): string | undefined => {
  if (url.indexOf(LOCAL_FILE_SCHEME) !== 0) return undefined

  const encodedKey = url.slice(LOCAL_FILE_SCHEME.length)
  try {
    const key = decodeURIComponent(encodedKey)
    return key.length > 0 ? key : undefined
  } catch {
    return undefined
  }
}

export const validateLocalFileMetadata = (value: unknown): LocalFileMetadata | undefined => {
  if (!isRecord(value)) return
  if (value.kind !== LOCAL_FILE_KIND) return

  const key = toOptionalString(value.key)
  const name = toOptionalString(value.name)
  const size = toNonNegativeNumber(value.size)

  if (!key || !name || typeof size === 'undefined') return

  return {
    kind: LOCAL_FILE_KIND,
    key,
    name,
    size,
    type: toOptionalString(value.type),
    lastModified: toNonNegativeNumber(value.lastModified)
  }
}

export class LocalFileAdapter {
  private readonly objectUrls = new Map<string, string>()
  private disposed = false

  constructor(private readonly objectUrlApi: LocalFileObjectUrlApi = browserObjectUrlApi) {}

  registerLocalFile(file: File, key?: string): LocalFileMetadata {
    this.assertNotDisposed()

    const metadata = createLocalFileMetadata(file)
    const fileKey = key || metadata.key
    const previousUrl = this.objectUrls.get(fileKey)

    if (previousUrl) {
      this.objectUrlApi.revokeObjectURL(previousUrl)
    }

    const objectUrl = this.objectUrlApi.createObjectURL(file)
    this.objectUrls.set(fileKey, objectUrl)

    return { ...metadata, key: fileKey }
  }

  getLocalFileUrl(metadata: LocalFileMetadata): string | undefined {
    this.assertNotDisposed()
    return this.objectUrls.get(metadata.key)
  }

  getLocalFileUrlByKey(key: string): string | undefined {
    this.assertNotDisposed()
    return this.objectUrls.get(key)
  }

  getLocalFileMetadata(value: unknown): LocalFileMetadata | undefined {
    return validateLocalFileMetadata(value)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true

    for (const objectUrl of this.objectUrls.values()) {
      this.objectUrlApi.revokeObjectURL(objectUrl)
    }

    this.objectUrls.clear()
  }

  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new Error('Local file adapter has been disposed.')
    }
  }
}

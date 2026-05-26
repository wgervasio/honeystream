import { IMediaItem } from 'lobby/reducers/mediaPlayer'
import {
  LocalFileAdapter,
  LocalFileMetadata,
  createLocalFileKey,
  createLocalFileMetadata,
  localFileToMediaUrl,
  validateLocalFileMetadata
} from 'playback/adapters/local-file'

const localFileAdapter = new LocalFileAdapter()

export {
  LocalFileMetadata,
  createLocalFileKey,
  createLocalFileMetadata,
  localFileToMediaUrl,
  validateLocalFileMetadata
}

export const registerLocalFile = (file: File, key?: string): LocalFileMetadata =>
  localFileAdapter.registerLocalFile(file, key)

export const getLocalFileUrl = (metadata: LocalFileMetadata): string | undefined =>
  localFileAdapter.getLocalFileUrl(metadata)

export const getLocalFileMetadata = (media?: IMediaItem): LocalFileMetadata | undefined =>
  localFileAdapter.getLocalFileMetadata(media && media.state)

export const isLocalFileMedia = (media?: IMediaItem): boolean =>
  Boolean(getLocalFileMetadata(media))

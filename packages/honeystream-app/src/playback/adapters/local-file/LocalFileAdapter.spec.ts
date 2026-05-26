import {
  LocalFileAdapter,
  localFileToMediaUrl,
  validateLocalFileMetadata
} from './LocalFileAdapter'
import { Buffer } from 'buffer'

class TestFile implements File {
  readonly lastModified: number
  readonly name: string
  readonly size: number
  readonly type = 'video/mp4'
  readonly webkitRelativePath = ''
  readonly [Symbol.toStringTag] = 'File'

  constructor(name: string, private readonly content: string) {
    this.name = name
    this.lastModified = 123
    this.size = content.length
  }

  arrayBuffer(): Promise<ArrayBuffer> {
    const buffer = Buffer.from(this.content, 'utf8')
    return Promise.resolve(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength))
  }

  slice(): Blob {
    throw new Error('TestFile.slice() is not used in this test suite.')
  }

  stream(): ReadableStream<Uint8Array> {
    throw new Error('TestFile.stream() is not used in this test suite.')
  }

  text(): Promise<string> {
    return Promise.resolve(this.content)
  }
}

const createFile = (name: string, content = 'video'): File => new TestFile(name, content)

describe('LocalFileAdapter', () => {
  it('replaces and revokes previous object URL by key', () => {
    const createdUrls = ['blob:first', 'blob:second']
    let createIndex = 0
    const revoked: string[] = []
    const adapter = new LocalFileAdapter({
      createObjectURL: () => createdUrls[createIndex++],
      revokeObjectURL: objectUrl => {
        revoked.push(objectUrl)
      }
    })

    const first = adapter.registerLocalFile(createFile('first.mp4'), 'shared-key')
    expect(adapter.getLocalFileUrl(first)).toBe('blob:first')

    const second = adapter.registerLocalFile(createFile('second.mp4'), 'shared-key')
    expect(second.key).toBe('shared-key')
    expect(adapter.getLocalFileUrl(second)).toBe('blob:second')
    expect(revoked).toEqual(['blob:first'])
  })

  it('revokes all object URLs on dispose and prevents reuse', () => {
    const createdUrls = ['blob:first', 'blob:second', 'blob:third']
    let createIndex = 0
    const revoked: string[] = []
    const adapter = new LocalFileAdapter({
      createObjectURL: () => createdUrls[createIndex++],
      revokeObjectURL: objectUrl => {
        revoked.push(objectUrl)
      }
    })

    adapter.registerLocalFile(createFile('first.mp4'), 'key-a')
    adapter.registerLocalFile(createFile('second.mp4'), 'key-b')

    adapter.dispose()
    adapter.dispose()

    expect(revoked).toEqual(['blob:first', 'blob:second'])
    expect(() => adapter.registerLocalFile(createFile('third.mp4'), 'key-c')).toThrow(
      'Local file adapter has been disposed.'
    )
  })
})

describe('validateLocalFileMetadata', () => {
  it('accepts valid local-file metadata', () => {
    const metadata = validateLocalFileMetadata({
      kind: 'local-file',
      key: 'my:key',
      name: 'my-file.mp4',
      size: 1234,
      type: '',
      lastModified: 0
    })

    expect(metadata).toEqual({
      kind: 'local-file',
      key: 'my:key',
      name: 'my-file.mp4',
      size: 1234,
      type: undefined,
      lastModified: 0
    })

    if (!metadata) {
      throw new Error('Expected metadata to be valid.')
    }

    expect(localFileToMediaUrl(metadata)).toBe('honeystream-local://my%3Akey')
  })

  it('rejects invalid metadata payloads', () => {
    expect(
      validateLocalFileMetadata({
        kind: 'local-file',
        key: '',
        name: 'video.mp4',
        size: 99
      })
    ).toBeUndefined()

    expect(
      validateLocalFileMetadata({
        kind: 'local-file',
        key: 'abc',
        name: 'video.mp4',
        size: -1
      })
    ).toBeUndefined()

    expect(
      validateLocalFileMetadata({
        kind: 'not-local-file',
        key: 'abc',
        name: 'video.mp4',
        size: 99
      })
    ).toBeUndefined()
  })
})

export const serializedByteLength = (value: unknown): number =>
  Buffer.byteLength(JSON.stringify(value), 'utf-8')

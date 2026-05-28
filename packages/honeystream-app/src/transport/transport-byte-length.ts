const utf8ByteLength = (value: string): number => {
  let bytes = 0

  for (let index = 0; index < value.length; index += 1) {
    const codePoint = value.codePointAt(index)
    if (typeof codePoint !== 'number') {
      continue
    }

    if (codePoint > 0xffff) {
      index += 1
    }

    if (codePoint <= 0x7f) {
      bytes += 1
    } else if (codePoint <= 0x7ff) {
      bytes += 2
    } else if (codePoint <= 0xffff) {
      bytes += 3
    } else {
      bytes += 4
    }
  }

  return bytes
}

export const serializedByteLength = (value: unknown): number => {
  const serialized = JSON.stringify(value)
  return typeof serialized === 'string' ? utf8ByteLength(serialized) : 0
}

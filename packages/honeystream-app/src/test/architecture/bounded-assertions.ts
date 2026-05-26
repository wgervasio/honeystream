function assertNonNegativeInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`)
  }
}

export function expectBoundedLength(
  length: number,
  max: number,
  label: string = 'collection'
): void {
  assertNonNegativeInteger(length, 'length')
  assertNonNegativeInteger(max, 'max')

  if (length > max) {
    throw new Error(`${label} exceeded max size ${max}; got ${length}`)
  }
}

export function expectBoundedArray<T>(
  values: readonly T[],
  max: number,
  label: string = 'array'
): void {
  expectBoundedLength(values.length, max, label)
}

export function expectBoundedMap<K, V>(
  values: ReadonlyMap<K, V>,
  max: number,
  label: string = 'map'
): void {
  expectBoundedLength(values.size, max, label)
}

export function expectBoundedSet<T>(
  values: ReadonlySet<T>,
  max: number,
  label: string = 'set'
): void {
  expectBoundedLength(values.size, max, label)
}

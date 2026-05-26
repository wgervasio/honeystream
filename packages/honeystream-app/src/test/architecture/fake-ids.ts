export type FakeIdGenerator = {
  readonly next: () => string
  readonly nextId: () => string
  readonly issuedIds: () => readonly string[]
}

export type FixedIdGenerator = {
  readonly next: () => string
  readonly nextId: () => string
  readonly remaining: () => number
}

function assertNonEmptyPrefix(prefix: string): void {
  if (prefix.length === 0) {
    throw new Error('prefix must not be empty')
  }
}

function assertNonNegativeInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`)
  }
}

export function createFakeIdGenerator(prefix: string = 'id', startAt: number = 0): FakeIdGenerator {
  assertNonEmptyPrefix(prefix)
  assertNonNegativeInteger(startAt, 'startAt')

  let nextValue = startAt
  const issued: string[] = []

  const next = (): string => {
    const id = `${prefix}-${nextValue}`
    nextValue += 1
    issued.push(id)
    return id
  }

  return {
    next,
    nextId: next,
    issuedIds: () => issued.slice()
  }
}

export function createFixedIdGenerator(ids: readonly string[]): FixedIdGenerator {
  if (ids.length === 0) {
    throw new Error('ids must contain at least one value')
  }

  let index = 0

  const next = (): string => {
    if (index >= ids.length) {
      throw new Error('no fake IDs remaining')
    }

    const id = ids[index]
    if (id.length === 0) {
      throw new Error('fake IDs must not contain empty values')
    }

    index += 1
    return id
  }

  return {
    next,
    nextId: next,
    remaining: () => ids.length - index
  }
}

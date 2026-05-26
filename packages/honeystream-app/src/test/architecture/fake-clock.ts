export type FakeClock = {
  readonly now: () => number
  readonly nowMs: () => number
  readonly set: (nextMs: number) => number
  readonly advanceBy: (deltaMs: number) => number
}

function assertFiniteNumber(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number`)
  }
}

export function createFakeClock(initialMs: number = 0): FakeClock {
  assertFiniteNumber(initialMs, 'initialMs')

  let currentMs = initialMs

  const read = (): number => currentMs

  const set = (nextMs: number): number => {
    assertFiniteNumber(nextMs, 'nextMs')
    currentMs = nextMs
    return currentMs
  }

  const advanceBy = (deltaMs: number): number => {
    assertFiniteNumber(deltaMs, 'deltaMs')
    currentMs += deltaMs
    return currentMs
  }

  return {
    now: read,
    nowMs: read,
    set,
    advanceBy
  }
}

export type CleanupCallTracker = {
  readonly mock: {
    readonly calls: ReadonlyArray<readonly unknown[]>
  }
}

function assertNonNegativeInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`)
  }
}

function cleanupCalls(cleanup: CleanupCallTracker): number {
  return cleanup.mock.calls.length
}

export function expectCleanupCalledTimes(
  cleanup: CleanupCallTracker,
  expectedCalls: number,
  label: string = 'cleanup'
): void {
  assertNonNegativeInteger(expectedCalls, 'expectedCalls')

  const actualCalls = cleanupCalls(cleanup)
  if (actualCalls !== expectedCalls) {
    throw new Error(`${label} cleanup called ${actualCalls} times; expected ${expectedCalls}`)
  }
}

export function expectCleanupCalledOnce(
  cleanup: CleanupCallTracker,
  label: string = 'cleanup'
): void {
  expectCleanupCalledTimes(cleanup, 1, label)
}

export function expectAllCleanupsCalledOnce(
  cleanups: Readonly<Record<string, CleanupCallTracker>>
): void {
  for (const label of Object.keys(cleanups)) {
    expectCleanupCalledOnce(cleanups[label], label)
  }
}

export const DEFAULT_QUEUE_CAP = 50

export interface QueueMutationResult<T> {
  readonly queue: readonly T[]
  readonly accepted: boolean
  readonly removed?: T
}

const normalizeQueueCap = (cap: number): number => {
  if (!Number.isFinite(cap) || !Number.isInteger(cap) || cap < 1) {
    return DEFAULT_QUEUE_CAP
  }
  return cap
}

const clampQueueIndex = (index: number, queueLength: number): number => {
  if (!Number.isFinite(index)) return queueLength
  if (index < 0) return 0
  if (index > queueLength) return queueLength
  return Math.floor(index)
}

export const isQueueFull = <T>(queue: readonly T[], cap: number = DEFAULT_QUEUE_CAP): boolean =>
  queue.length >= normalizeQueueCap(cap)

export const appendQueueItem = <T>(
  queue: readonly T[],
  item: T,
  cap: number = DEFAULT_QUEUE_CAP
): QueueMutationResult<T> => {
  if (isQueueFull(queue, cap)) {
    return { queue, accepted: false }
  }
  return {
    queue: [...queue, item],
    accepted: true
  }
}

export const insertQueueItem = <T>(
  queue: readonly T[],
  item: T,
  index: number,
  cap: number = DEFAULT_QUEUE_CAP
): QueueMutationResult<T> => {
  if (isQueueFull(queue, cap)) {
    return { queue, accepted: false }
  }

  const queueIndex = clampQueueIndex(index, queue.length)
  const nextQueue = [...queue]
  nextQueue.splice(queueIndex, 0, item)
  return { queue: nextQueue, accepted: true }
}

export const removeFirstQueueItem = <T>(
  queue: readonly T[],
  predicate: (item: T) => boolean
): QueueMutationResult<T> => {
  const index = queue.findIndex(predicate)
  if (index < 0) {
    return { queue, accepted: false }
  }

  const nextQueue = [...queue]
  const removed = nextQueue.splice(index, 1)[0]
  return { queue: nextQueue, accepted: true, removed }
}

export const takeNextQueueItem = <T>(queue: readonly T[]): QueueMutationResult<T> => {
  if (queue.length === 0) {
    return { queue, accepted: false }
  }

  const nextQueue = [...queue]
  const removed = nextQueue.shift()
  if (typeof removed === 'undefined') {
    return { queue, accepted: false }
  }

  return { queue: nextQueue, accepted: true, removed }
}

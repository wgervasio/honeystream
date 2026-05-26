import { Disposable, fromDispose } from './disposable'

export const startTimeout = <TArgs extends unknown[]>(
  callback: (...args: TArgs) => void,
  delayMs: number,
  ...args: TArgs
): Disposable => {
  const timerId = setTimeout(() => callback(...args), delayMs)
  return fromDispose(() => {
    clearTimeout(timerId)
  })
}

export const startInterval = <TArgs extends unknown[]>(
  callback: (...args: TArgs) => void,
  delayMs: number,
  ...args: TArgs
): Disposable => {
  const timerId = setInterval(() => callback(...args), delayMs)
  return fromDispose(() => {
    clearInterval(timerId)
  })
}

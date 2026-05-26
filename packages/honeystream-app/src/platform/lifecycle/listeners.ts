import { Disposable, fromDispose } from './disposable'

export interface ListenerTarget<TEventType extends string, TListener> {
  addEventListener(
    type: TEventType,
    listener: TListener,
    options?: boolean | AddEventListenerOptions
  ): void
  removeEventListener(
    type: TEventType,
    listener: TListener,
    options?: boolean | EventListenerOptions
  ): void
}

export const listen = <TEventType extends string, TListener>(
  target: ListenerTarget<TEventType, TListener>,
  type: TEventType,
  listener: TListener,
  options?: boolean | AddEventListenerOptions
): Disposable => {
  target.addEventListener(type, listener, options)
  return fromDispose(() => {
    target.removeEventListener(type, listener, options)
  })
}

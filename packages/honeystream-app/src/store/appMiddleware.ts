import { Middleware } from 'redux'

import { pwaMiddleware } from '../middleware/pwa'

export const configureAppMiddleware = () => {
  const list: (Middleware | undefined)[] = [
    pwaMiddleware()
  ]

  const middleware = list.filter(Boolean) as Middleware[]
  return middleware
}

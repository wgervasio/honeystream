import React, { memo } from 'react'
import { SessionSystemErrorViewModel } from './types'

interface SessionSystemErrorsProps {
  readonly className?: string
  readonly errors: readonly SessionSystemErrorViewModel[]
  readonly title?: string
}

export const SessionSystemErrors = memo(function SessionSystemErrors(props: SessionSystemErrorsProps) {
  if (props.errors.length === 0) {
    return null
  }

  return (
    <section className={props.className} role="alert" aria-live="polite">
      {props.title ? <p>{props.title}</p> : null}
      <ul>
        {props.errors.map(error => (
          <li key={error.id}>
            <strong>{error.code}</strong>: {error.message}
          </li>
        ))}
      </ul>
    </section>
  )
})

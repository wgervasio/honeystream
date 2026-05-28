import React, { memo } from 'react'

interface QueueNextButtonProps {
  readonly className?: string
  readonly disabled?: boolean
  readonly label?: string
  readonly onNext: () => void
}

export const QueueNextButton = memo(function QueueNextButton(props: QueueNextButtonProps) {
  return (
    <button
      className={props.className}
      type="button"
      onClick={props.onNext}
      disabled={Boolean(props.disabled)}
      aria-disabled={Boolean(props.disabled)}
      data-queue-action="next"
    >
      {props.label || 'Next'}
    </button>
  )
})

export type { QueueNextButtonProps }

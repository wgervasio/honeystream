import React, { DragEvent, memo, useState } from 'react'

export interface RuntimeAddLocalFileDropProps {
  readonly addFileLabel?: string
  readonly onAddLocalFile: (file: File) => void
}

export const RuntimeAddLocalFileDrop = memo(function RuntimeAddLocalFileDrop(
  props: RuntimeAddLocalFileDropProps
) {
  const [dropActive, setDropActive] = useState(false)

  const queueLocalFile = (file: File | undefined): void => {
    if (file) {
      props.onAddLocalFile(file)
    }
  }

  const activateDrop = (event: DragEvent<HTMLLabelElement>): void => {
    event.preventDefault()
    setDropActive(true)
  }

  const deactivateDrop = (event: DragEvent<HTMLLabelElement>): void => {
    event.preventDefault()
    setDropActive(false)
  }

  const dropFile = (event: DragEvent<HTMLLabelElement>): void => {
    event.preventDefault()
    setDropActive(false)
    queueLocalFile(event.dataTransfer.files && event.dataTransfer.files[0])
  }

  return (
    <label
      htmlFor="runtime-add-media-file"
      data-local-file-drop={dropActive ? 'active' : 'idle'}
      onDragEnter={activateDrop}
      onDragOver={activateDrop}
      onDragLeave={deactivateDrop}
      onDrop={dropFile}
    >
      {props.addFileLabel || 'Add local file'}
      <span data-local-file-drop-copy="true">
        Drop the matching local copy here, or click to browse.
      </span>
      <input
        id="runtime-add-media-file"
        type="file"
        accept="video/*,audio/*"
        onChange={event => {
          const file = event.currentTarget.files ? event.currentTarget.files[0] : undefined
          queueLocalFile(file)
          event.currentTarget.value = ''
        }}
      />
    </label>
  )
})

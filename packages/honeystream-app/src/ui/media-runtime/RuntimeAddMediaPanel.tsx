import React, { FormEvent, memo, useState } from 'react'

export interface RuntimeAddMediaPanelProps {
  readonly addFileLabel?: string
  readonly addUrlLabel?: string
  readonly className?: string
  readonly onAddLocalFile?: (file: File) => void
  readonly onAddUrl: (url: string) => void
  readonly placeholder?: string
  readonly title?: string
}

export const RuntimeAddMediaPanel = memo(function RuntimeAddMediaPanel(
  props: RuntimeAddMediaPanelProps
) {
  const [url, setUrl] = useState('')

  const submitUrl = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedUrl = url.trim()
    if (trimmedUrl.length === 0) {
      return
    }

    props.onAddUrl(trimmedUrl)
    setUrl('')
  }

  return (
    <section className={props.className}>
      <p>{props.title || 'Add media'}</p>
      <form onSubmit={submitUrl}>
        <label htmlFor="runtime-add-media-url">Media URL</label>
        <input
          id="runtime-add-media-url"
          type="url"
          value={url}
          placeholder={props.placeholder || 'https://example.com/video.mp4'}
          onChange={event => setUrl(event.currentTarget.value)}
        />
        <button type="submit">{props.addUrlLabel || 'Add URL'}</button>
      </form>
      {props.onAddLocalFile ? (
        <label htmlFor="runtime-add-media-file">
          {props.addFileLabel || 'Add local file'}
          <input
            id="runtime-add-media-file"
            type="file"
            accept="video/*,audio/*"
            onChange={event => {
              const file = event.currentTarget.files && event.currentTarget.files[0]
              if (file && props.onAddLocalFile) {
                props.onAddLocalFile(file)
              }
              event.currentTarget.value = ''
            }}
          />
        </label>
      ) : null}
    </section>
  )
})


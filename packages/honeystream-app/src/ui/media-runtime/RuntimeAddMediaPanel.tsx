import React, { FormEvent, memo, useState } from 'react'
import { classifyMediaUrl } from '../../protocol'

export interface RuntimeAddMediaSuggestion {
  readonly detail: string
  readonly id: string
  readonly label: string
  readonly url: string
}

type RuntimeAddMediaSourcePreviewKind = 'direct-media' | 'invalid' | 'website'

interface RuntimeAddMediaSourcePreview {
  readonly detail: string
  readonly kind: RuntimeAddMediaSourcePreviewKind
  readonly label: string
}

export interface RuntimeAddMediaPanelProps {
  readonly addFileLabel?: string
  readonly addUrlLabel?: string
  readonly className?: string
  readonly description?: string
  readonly invalidUrlLabel?: string
  readonly missingUrlLabel?: string
  readonly onAddLocalFile?: (file: File) => void
  readonly onAddUrl: (url: string) => void
  readonly placeholder?: string
  readonly sourceSuggestions?: readonly RuntimeAddMediaSuggestion[]
  readonly title?: string
}

const DEFAULT_MISSING_URL_LABEL = 'Paste a website or direct media URL first.'
const DEFAULT_INVALID_URL_LABEL = 'Use a full http:// or https:// link.'

const isHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

const createSourcePreview = (value: string): RuntimeAddMediaSourcePreview | undefined => {
  const trimmedValue = value.trim()
  if (trimmedValue.length === 0) {
    return undefined
  }

  if (!isHttpUrl(trimmedValue)) {
    return {
      kind: 'invalid',
      label: 'Needs full link',
      detail: 'Paste the complete http:// or https:// watch page.'
    }
  }

  if (classifyMediaUrl(trimmedValue) === 'website') {
    return {
      kind: 'website',
      label: 'Website lane',
      detail: 'Each browser opens this page locally while controls stay synced.'
    }
  }

  return {
    kind: 'direct-media',
    label: 'Direct media lane',
    detail: 'This looks like a playable media URL for the shared queue.'
  }
}

export const RuntimeAddMediaPanel = memo(function RuntimeAddMediaPanel(
  props: RuntimeAddMediaPanelProps
) {
  const [url, setUrl] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | undefined>()

  const sourceSuggestions = props.sourceSuggestions || []
  const sourcePreview = createSourcePreview(url)

  const submitUrl = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedUrl = url.trim()
    if (trimmedUrl.length === 0) {
      setErrorMessage(props.missingUrlLabel || DEFAULT_MISSING_URL_LABEL)
      return
    }

    if (!isHttpUrl(trimmedUrl)) {
      setErrorMessage(props.invalidUrlLabel || DEFAULT_INVALID_URL_LABEL)
      return
    }

    props.onAddUrl(trimmedUrl)
    setUrl('')
    setErrorMessage(undefined)
  }

  return (
    <section className={props.className}>
      <p>{props.title || 'Add media'}</p>
      {props.description ? <p data-add-media-description="true">{props.description}</p> : null}
      {sourceSuggestions.length > 0 ? (
        <div data-source-suggestions="true" aria-label="Quick source suggestions">
          {sourceSuggestions.map(suggestion => (
            <button
              key={suggestion.id}
              type="button"
              data-source-suggestion={suggestion.id}
              onClick={() => {
                setUrl(suggestion.url)
                setErrorMessage(undefined)
              }}
            >
              <strong>{suggestion.label}</strong>
              <span>{suggestion.detail}</span>
            </button>
          ))}
        </div>
      ) : null}
      <form onSubmit={submitUrl} noValidate>
        <label htmlFor="runtime-add-media-url">Media URL</label>
        <input
          id="runtime-add-media-url"
          type="url"
          value={url}
          placeholder={props.placeholder || 'https://example.com/video.mp4'}
          onChange={event => {
            setUrl(event.currentTarget.value)
            setErrorMessage(undefined)
          }}
          aria-invalid={errorMessage ? true : undefined}
          aria-describedby={errorMessage ? 'runtime-add-media-error' : undefined}
        />
        {sourcePreview ? (
          <div
            data-add-media-source-preview={sourcePreview.kind}
            aria-live="polite"
            aria-label="Media source preview"
          >
            <strong>{sourcePreview.label}</strong>
            <span>{sourcePreview.detail}</span>
          </div>
        ) : null}
        <button type="submit">{props.addUrlLabel || 'Add URL'}</button>
      </form>
      {errorMessage ? (
        <p id="runtime-add-media-error" data-add-media-error="true" role="alert">
          {errorMessage}
        </p>
      ) : null}
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

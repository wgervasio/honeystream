import React, { FormEvent, memo, useState } from 'react'
import {
  createRuntimeAddMediaConfidenceItems,
  createRuntimeAddMediaSourcePreview,
  isRuntimeAddMediaHttpUrl
} from './RuntimeAddMediaSourcePreview'

export interface RuntimeAddMediaSuggestion {
  readonly detail: string
  readonly id: string
  readonly label: string
  readonly url: string
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
const SOURCE_CONFIDENCE_TITLE = 'Source confidence'

export const RuntimeAddMediaPanel = memo(function RuntimeAddMediaPanel(
  props: RuntimeAddMediaPanelProps
) {
  const [url, setUrl] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | undefined>()

  const sourceSuggestions = props.sourceSuggestions || []
  const sourcePreview = createRuntimeAddMediaSourcePreview(url)
  const sourceConfidenceItems = createRuntimeAddMediaConfidenceItems(sourcePreview)

  const submitUrl = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedUrl = url.trim()
    if (trimmedUrl.length === 0) {
      setErrorMessage(props.missingUrlLabel || DEFAULT_MISSING_URL_LABEL)
      return
    }

    if (!isRuntimeAddMediaHttpUrl(trimmedUrl)) {
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
      <div data-source-confidence="true" aria-label={SOURCE_CONFIDENCE_TITLE}>
        <strong>{SOURCE_CONFIDENCE_TITLE}</strong>
        {sourceConfidenceItems.map(item => (
          <span key={item.id} data-source-confidence-state={item.state}>
            <b>{item.label}</b>
            <small>{item.detail}</small>
          </span>
        ))}
      </div>
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
            data-add-media-provider={sourcePreview.provider}
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

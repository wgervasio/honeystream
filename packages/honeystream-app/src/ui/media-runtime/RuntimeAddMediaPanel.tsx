import React, { FormEvent, memo, useRef, useState } from 'react'
import {
  createRuntimeAddMediaConfidenceItems,
  createRuntimeAddMediaSourcePreview,
  isRuntimeAddMediaShorthandHttpUrl,
  normalizeRuntimeAddMediaHttpUrl
} from './RuntimeAddMediaSourcePreview'
import { RuntimeAddLocalFileDrop } from './RuntimeAddLocalFileDrop'

export interface RuntimeAddMediaSuggestion {
  readonly detail: string
  readonly guidance: string
  readonly id: string
  readonly label: string
  readonly placeholder: string
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
const DEFAULT_INVALID_URL_LABEL =
  'Paste a website link like youtube.com/watch or a full http:// or https:// URL.'
const SOURCE_CONFIDENCE_TITLE = 'Source confidence'
const URL_SAFETY_TITLE = 'URL Safety Results'

export const RuntimeAddMediaPanel = memo(function RuntimeAddMediaPanel(
  props: RuntimeAddMediaPanelProps
) {
  const urlInputRef = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | undefined>()
  const [statusMessage, setStatusMessage] = useState<string | undefined>()
  const [selectedSuggestionId, setSelectedSuggestionId] = useState<string | undefined>()

  const sourceSuggestions = props.sourceSuggestions || []
  const selectedSuggestion = sourceSuggestions.find(
    suggestion => suggestion.id === selectedSuggestionId
  )
  const sourcePreview = createRuntimeAddMediaSourcePreview(url)
  const sourceConfidenceItems = createRuntimeAddMediaConfidenceItems(sourcePreview)
  const inputDescriptionId = errorMessage
    ? 'runtime-add-media-error'
    : statusMessage
    ? 'runtime-add-media-status'
    : undefined

  const focusUrlInput = (): void => {
    if (urlInputRef.current) {
      urlInputRef.current.focus()
    }
  }

  const submitUrl = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedUrl = url.trim()
    if (trimmedUrl.length === 0) {
      setErrorMessage(props.missingUrlLabel || DEFAULT_MISSING_URL_LABEL)
      setStatusMessage(undefined)
      focusUrlInput()
      return
    }

    const normalizedUrl = normalizeRuntimeAddMediaHttpUrl(trimmedUrl)
    const queuedWithHttpsAdded = isRuntimeAddMediaShorthandHttpUrl(trimmedUrl)
    if (!normalizedUrl) {
      setErrorMessage(props.invalidUrlLabel || DEFAULT_INVALID_URL_LABEL)
      setStatusMessage(undefined)
      focusUrlInput()
      return
    }

    props.onAddUrl(normalizedUrl)
    setUrl('')
    setErrorMessage(undefined)
    setSelectedSuggestionId(undefined)
    setStatusMessage(
      queuedWithHttpsAdded
        ? 'Source queued with https:// added. Copy the invite or press play when your buddy lands.'
        : 'Source queued. Copy the invite or press play when your buddy lands.'
    )
  }

  const queueLocalFile = (file: File): void => {
    if (!props.onAddLocalFile) {
      return
    }

    props.onAddLocalFile(file)
    setErrorMessage(undefined)
    setSelectedSuggestionId(undefined)
    setStatusMessage(`${file.name} queued locally. Rabbit-side should pick their copy too.`)
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
      <div data-url-safety-results="true" aria-label={URL_SAFETY_TITLE}>
        <strong>{URL_SAFETY_TITLE}</strong>
        <span>
          Use exact watch pages both browsers can open: YouTube, AnimePahe, Cineby, Miruro, or any
          site you can test together. The streaming connection lab feeds the optimizer, picks the
          lowest-loss lane first, prefers clean zero-retry lanes before faster repaired lanes,
          then latency-tunes it with a zero-loss, under-10ms mock round trip, visible recovered
          retries for transient control drops, and no skipped controls. Honeystream keeps media
          bytes local and syncs only the typed control stream.
        </span>
      </div>
      {sourceSuggestions.length > 0 ? (
        <div data-source-suggestions="true" aria-label="Quick source suggestions">
          {sourceSuggestions.map(suggestion => (
            <button
              key={suggestion.id}
              type="button"
              data-source-suggestion={suggestion.id}
              data-source-suggestion-state={
                selectedSuggestionId === suggestion.id ? 'selected' : 'idle'
              }
              aria-pressed={selectedSuggestionId === suggestion.id}
              onClick={() => {
                setUrl('')
                setSelectedSuggestionId(suggestion.id)
                setErrorMessage(undefined)
                setStatusMessage(`${suggestion.label} lane selected. ${suggestion.guidance}`)
                focusUrlInput()
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
          ref={urlInputRef}
          id="runtime-add-media-url"
          type="url"
          value={url}
          placeholder={
            selectedSuggestion
              ? selectedSuggestion.placeholder
              : props.placeholder || 'https://example.com/video.mp4'
          }
          onChange={event => {
            setUrl(event.currentTarget.value)
            setErrorMessage(undefined)
            setStatusMessage(undefined)
          }}
          aria-invalid={errorMessage ? true : undefined}
          aria-describedby={inputDescriptionId}
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
      {statusMessage ? (
        <p id="runtime-add-media-status" data-add-media-status="true" role="status">
          {statusMessage}
        </p>
      ) : null}
      {props.onAddLocalFile ? (
        <RuntimeAddLocalFileDrop
          addFileLabel={props.addFileLabel}
          onAddLocalFile={queueLocalFile}
        />
      ) : null}
    </section>
  )
})

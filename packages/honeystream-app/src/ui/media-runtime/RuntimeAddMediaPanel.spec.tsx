/** @jest-environment jsdom */

import React from 'react'
import * as ReactDOM from 'react-dom'
import { renderToStaticMarkup } from 'react-dom/server'
import { Simulate } from 'react-dom/test-utils'
import { RuntimeAddMediaPanel } from './RuntimeAddMediaPanel'

describe('RuntimeAddMediaPanel', () => {
  it('renders URL add controls without local-file controls by default', () => {
    const html = renderToStaticMarkup(
      <RuntimeAddMediaPanel
        description="Paste a supported website, direct media URL, or local file."
        onAddUrl={jest.fn()}
      />
    )

    expect(html).toContain('Media URL')
    expect(html).toContain('Add URL')
    expect(html).toContain('Paste a supported website')
    expect(html).toContain('Source confidence')
    expect(html).toContain('Paste watch link')
    expect(html).toContain('Buddy check')
    expect(html).toContain('Sync check')
    expect(html).toContain('reliable retry for transient control drops')
    expect(html).toContain('syncs only the tiny control stream')
    expect(html).not.toContain('Add local file')
  })

  it('renders local-file controls when a local file callback is provided', () => {
    const html = renderToStaticMarkup(
      <RuntimeAddMediaPanel onAddUrl={jest.fn()} onAddLocalFile={jest.fn()} />
    )

    expect(html).toContain('Add local file')
    expect(html).toContain('Drop the matching local copy here')
  })

  it('queues local files from the cozy drop lane input', () => {
    const onAddLocalFile = jest.fn()
    const container = document.createElement('div')
    document.body.appendChild(container)

    try {
      ReactDOM.render(
        <RuntimeAddMediaPanel onAddUrl={jest.fn()} onAddLocalFile={onAddLocalFile} />,
        container
      )

      const file = new File(['honeystream'], 'watch-night.mp4', { type: 'video/mp4' })
      const input = container.querySelector('#runtime-add-media-file') as HTMLInputElement
      Object.defineProperty(input, 'files', { value: [file], configurable: true })

      Simulate.change(input)

      expect(onAddLocalFile).toHaveBeenCalledWith(file)
      expect(container.textContent).toContain('watch-night.mp4 queued locally')
      expect(container.textContent).toContain('Rabbit-side should pick their copy')
    } finally {
      ReactDOM.unmountComponentAtNode(container)
      container.remove()
    }
  })

  it('renders custom happy-path title and placeholder copy', () => {
    const html = renderToStaticMarkup(
      <RuntimeAddMediaPanel
        onAddUrl={jest.fn()}
        title="Pick the next cozy stream"
        placeholder="Paste YouTube, AnimePahe, Cineby, Miruro, or direct media"
      />
    )

    expect(html).toContain('Pick the next cozy stream')
    expect(html).toContain('Paste YouTube, AnimePahe, Cineby, Miruro, or direct media')
  })

  it('renders quick source suggestions for low-friction website picking', () => {
    const html = renderToStaticMarkup(
      <RuntimeAddMediaPanel
        onAddUrl={jest.fn()}
        sourceSuggestions={[
          {
            id: 'youtube',
            label: 'YouTube',
            detail: 'Video page',
            placeholder: 'Paste the exact YouTube watch page...',
            guidance: 'Paste the real video page you both can open.'
          },
          {
            id: 'direct',
            label: 'Direct MP4',
            detail: 'Clean media URL',
            placeholder: 'Paste a direct MP4, WebM, audio, or stream URL...',
            guidance: 'Use a clean media URL when the source already points at playable media.'
          }
        ]}
      />
    )

    expect(html).toContain('data-source-suggestions="true"')
    expect(html).toContain('data-source-suggestion="youtube"')
    expect(html).toContain('YouTube')
    expect(html).toContain('Video page')
    expect(html).toContain('Direct MP4')
  })

  it('selects source lanes without queueing fake URLs', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    try {
      ReactDOM.render(
        <RuntimeAddMediaPanel
          onAddUrl={jest.fn()}
          sourceSuggestions={[
            {
              id: 'youtube',
              label: 'YouTube',
              detail: 'Video page',
              placeholder: 'Paste the exact YouTube watch page...',
              guidance:
                'YouTube is covered by the low-latency streaming-site mock tests; paste the real video page you both can open.'
            }
          ]}
        />,
        container
      )

      const suggestion = container.querySelector(
        '[data-source-suggestion="youtube"]'
      ) as HTMLButtonElement
      Simulate.click(suggestion)

      const input = container.querySelector('#runtime-add-media-url') as HTMLInputElement
      expect(input.value).toBe('')
      expect(input.placeholder).toBe('Paste the exact YouTube watch page...')
      expect(document.activeElement).toBe(input)
      expect(container.querySelector('[data-add-media-status="true"]')).not.toBeNull()
      expect(suggestion.getAttribute('aria-pressed')).toBe('true')
      expect(suggestion.getAttribute('data-source-suggestion-state')).toBe('selected')
      expect(container.textContent).toContain('YouTube lane selected')
      expect(container.textContent).toContain(
        'YouTube is covered by the low-latency streaming-site mock tests'
      )
      expect(container.textContent).toContain('paste the real video page')

      input.value = 'https://www.youtube.com/watch?v=honeystream-demo'
      Simulate.change(input)
      expect(container.textContent).toContain('Low-latency sync path')
      expect(container.textContent).toContain('not the video bytes')
      expect(container.textContent).toContain('mock round trip budgeted under 32ms')
      expect(container.textContent).toContain('max control-frame size')

      input.value = 'https://youtube.com.evil/watch?v=honeystream-demo'
      Simulate.change(input)
      expect(container.querySelector('[data-add-media-source-preview="website"]')).not.toBeNull()
      expect(container.querySelector('[data-add-media-provider="unknown"]')).not.toBeNull()
      expect(container.textContent).toContain('Website lane')
      expect(container.textContent).not.toContain('YouTube page detected')

      input.value = 'https://cdn.example.com/watch-night.mp4'
      Simulate.change(input)
      expect(
        container.querySelector('[data-add-media-source-preview="direct-media"]')
      ).not.toBeNull()
      expect(container.textContent).toContain('Direct media lane')

      input.value = 'not a valid watch link'
      Simulate.change(input)
      expect(container.querySelector('[data-add-media-source-preview="invalid"]')).not.toBeNull()
      expect(container.querySelector('[data-source-confidence-state="warning"]')).not.toBeNull()
      expect(container.textContent).toContain('Needs a watch link')
    } finally {
      ReactDOM.unmountComponentAtNode(container)
      container.remove()
    }
  })
})

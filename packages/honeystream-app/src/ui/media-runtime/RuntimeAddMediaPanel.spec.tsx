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
    expect(html).not.toContain('Add local file')
  })

  it('renders local-file controls when a local file callback is provided', () => {
    const html = renderToStaticMarkup(
      <RuntimeAddMediaPanel onAddUrl={jest.fn()} onAddLocalFile={jest.fn()} />
    )

    expect(html).toContain('Add local file')
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
            url: 'https://www.youtube.com/watch?v=honeystream-demo'
          },
          {
            id: 'direct',
            label: 'Direct MP4',
            detail: 'Clean media URL',
            url: 'https://example.com/watch-night.mp4'
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

  it('clears URL validation feedback when the user edits the input', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    try {
      ReactDOM.render(<RuntimeAddMediaPanel onAddUrl={jest.fn()} />, container)

      const form = container.querySelector('form') as HTMLFormElement
      Simulate.submit(form)
      expect(container.querySelector('[data-add-media-error="true"]')).not.toBeNull()

      const input = container.querySelector('#runtime-add-media-url') as HTMLInputElement
      input.value = 'https://example.com/watch-night.mp4'
      Simulate.change(input)

      expect(container.querySelector('[data-add-media-error="true"]')).toBeNull()
    } finally {
      ReactDOM.unmountComponentAtNode(container)
      container.remove()
    }
  })

  it('previews whether a typed source will use the website or direct-media lane', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    try {
      ReactDOM.render(<RuntimeAddMediaPanel onAddUrl={jest.fn()} />, container)

      const input = container.querySelector('#runtime-add-media-url') as HTMLInputElement

      input.value = 'https://www.youtube.com/watch?v=honeystream-demo'
      Simulate.change(input)
      expect(container.querySelector('[data-add-media-source-preview="website"]')).not.toBeNull()
      expect(container.querySelector('[data-add-media-provider="youtube"]')).not.toBeNull()
      expect(container.textContent).toContain('YouTube lane')

      input.value = 'https://cdn.example.com/watch-night.mp4'
      Simulate.change(input)
      expect(
        container.querySelector('[data-add-media-source-preview="direct-media"]')
      ).not.toBeNull()
      expect(container.textContent).toContain('Direct media lane')

      input.value = 'example.com/watch-night'
      Simulate.change(input)
      expect(container.querySelector('[data-add-media-source-preview="invalid"]')).not.toBeNull()
      expect(container.textContent).toContain('Needs full link')
    } finally {
      ReactDOM.unmountComponentAtNode(container)
      container.remove()
    }
  })
})

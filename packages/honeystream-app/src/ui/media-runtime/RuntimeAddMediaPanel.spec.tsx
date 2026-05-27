import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
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
})

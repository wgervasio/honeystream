import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { RuntimeAddMediaPanel } from './RuntimeAddMediaPanel'

describe('RuntimeAddMediaPanel', () => {
  it('renders URL add controls without local-file controls by default', () => {
    const html = renderToStaticMarkup(
      <RuntimeAddMediaPanel onAddUrl={jest.fn()} />
    )

    expect(html).toContain('Media URL')
    expect(html).toContain('Add URL')
    expect(html).not.toContain('Add local file')
  })

  it('renders local-file controls when a local file callback is provided', () => {
    const html = renderToStaticMarkup(
      <RuntimeAddMediaPanel onAddUrl={jest.fn()} onAddLocalFile={jest.fn()} />
    )

    expect(html).toContain('Add local file')
  })
})

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

jest.mock('./HomeScreen.css', () => ({
  button: 'button',
  column: 'column',
  container: 'container',
  directLink: 'directLink',
  divider: 'divider',
  fileInput: 'fileInput',
  hero: 'hero',
  inputContainer: 'inputContainer',
  kicker: 'kicker',
  localFile: 'localFile',
  main: 'main',
  panel: 'panel',
  primaryButton: 'primaryButton',
  siteChip: 'siteChip',
  siteChips: 'siteChips',
  uppercase: 'uppercase'
}))

const { HomeScreen } = require('./HomeScreen') as typeof import('./HomeScreen')

describe('browser/HomeScreen', () => {
  it('renders happy add-media guidance and deterministic site examples', () => {
    const html = renderToStaticMarkup(
      <HomeScreen onRequestUrl={() => undefined} onRequestLocalFile={() => undefined} />
    )

    expect(html).toContain('Pick a local file or paste a site')
    expect(html).toContain('compact playback commands')
    expect(html).toContain('YouTube')
    expect(html).toContain('Anime page')
    expect(html).toContain('Movie page')
    expect(html).toContain('Direct video')
  })
})

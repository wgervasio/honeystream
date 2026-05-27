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
  helpLine: 'helpLine',
  invalidInput: 'invalidInput',
  inputContainer: 'inputContainer',
  kicker: 'kicker',
  localFile: 'localFile',
  main: 'main',
  mediaPath: 'mediaPath',
  panel: 'panel',
  panelHeader: 'panelHeader',
  pairPreview: 'pairPreview',
  primaryButton: 'primaryButton',
  rabbitCard: 'rabbitCard',
  siteChip: 'siteChip',
  siteChips: 'siteChips',
  sourceTips: 'sourceTips',
  catCard: 'catCard',
  comfortNotes: 'comfortNotes',
  syncBadge: 'syncBadge',
  urlInput: 'urlInput',
  uppercase: 'uppercase'
}))

const { HomeScreen } = require('./HomeScreen') as typeof import('./HomeScreen')

describe('browser/HomeScreen', () => {
  it('renders happy add-media guidance and deterministic site examples', () => {
    const html = renderToStaticMarkup(
      <HomeScreen onRequestUrl={() => undefined} onRequestLocalFile={() => undefined} />
    )

    expect(html).toContain('Paste a site, pick a file')
    expect(html).toContain('Website nights without the scramble')
    expect(html).toContain('compact playback commands')
    expect(html).toContain('Press play once and keep the room synced')
    expect(html).toContain('Cat-side')
    expect(html).toContain('Tiny sync commands')
    expect(html).toContain('Rabbit-side')
    expect(html).toContain('Website tab')
    expect(html).toContain('Local copy')
    expect(html).toContain('Direct media')
    expect(html).toContain('One invite')
    expect(html).toContain('Clear next step')
    expect(html).toContain('Choose the easiest source for tonight')
    expect(html).toContain('YouTube')
    expect(html).toContain('Anime night')
    expect(html).toContain('Movie night')
    expect(html).toContain('Direct video')
  })
})

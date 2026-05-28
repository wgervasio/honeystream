/** @jest-environment jsdom */

import React from 'react'
import * as ReactDOM from 'react-dom'
import { renderToStaticMarkup } from 'react-dom/server'
import { Simulate } from 'react-dom/test-utils'

jest.mock('./HomeScreen.css', () => ({
  button: 'button',
  column: 'column',
  container: 'container',
  decisionFlow: 'decisionFlow',
  directLink: 'directLink',
  divider: 'divider',
  fileInput: 'fileInput',
  hero: 'hero',
  helpLine: 'helpLine',
  confidenceRail: 'confidenceRail',
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
  roomDock: 'roomDock',
  siteChip: 'siteChip',
  siteChips: 'siteChips',
  sourceHelper: 'sourceHelper',
  sourceTips: 'sourceTips',
  catCard: 'catCard',
  syncBadge: 'syncBadge',
  trustBadges: 'trustBadges',
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
    expect(html).toContain('Same page on both browsers')
    expect(html).toContain('One host-owned queue')
    expect(html).toContain('Full watch-page URLs work best')
    expect(html).toContain('Direct media links skip extra clutter')
    expect(html).toContain('Website opens for both')
    expect(html).toContain('You both downloaded it')
    expect(html).toContain('URL is already media')
    expect(html).toContain('Choose the easiest source for tonight')
    expect(html).toContain('paste the exact watch page')
    expect(html).toContain('Known-site chips')
    expect(html).toContain('Zero media bytes shared')
    expect(html).toContain('Tiny host-led commands')
    expect(html).toContain('YouTube')
    expect(html).toContain('AnimePahe')
    expect(html).toContain('Cineby')
    expect(html).toContain('Miruro')
  })

  it('selects a site lane without inserting a fake URL', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    try {
      ReactDOM.render(
        <HomeScreen onRequestUrl={() => undefined} onRequestLocalFile={() => undefined} />,
        container
      )

      const youtubeChip = Array.from(container.querySelectorAll('button')).find(
        button => button.textContent === 'YouTube'
      ) as HTMLButtonElement | undefined
      expect(youtubeChip).toBeDefined()

      Simulate.click(youtubeChip!)

      const input = container.querySelector('#urlinput') as HTMLInputElement
      expect(input.value).toBe('')
      expect(input.placeholder).toBe('Paste the exact YouTube watch page...')
      expect(document.activeElement).toBe(input)
      expect(youtubeChip!.getAttribute('aria-pressed')).toBe('true')
      expect(container.textContent).toContain('YouTube lane selected')
      expect(container.textContent).toContain('Paste the real video page')
    } finally {
      ReactDOM.unmountComponentAtNode(container)
      container.remove()
    }
  })
})

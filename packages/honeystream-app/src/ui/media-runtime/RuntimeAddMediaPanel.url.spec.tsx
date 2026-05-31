/** @jest-environment jsdom */

import React from 'react'
import * as ReactDOM from 'react-dom'
import { Simulate } from 'react-dom/test-utils'
import { RuntimeAddMediaPanel } from './RuntimeAddMediaPanel'

describe('RuntimeAddMediaPanel URL handling', () => {
  it('shows the next cozy action after queueing a valid URL', () => {
    const onAddUrl = jest.fn()
    const container = document.createElement('div')
    document.body.appendChild(container)

    try {
      ReactDOM.render(<RuntimeAddMediaPanel onAddUrl={onAddUrl} />, container)

      const input = container.querySelector('#runtime-add-media-url') as HTMLInputElement
      input.value = 'https://example.com/watch-night.mp4'
      Simulate.change(input)

      const form = container.querySelector('form') as HTMLFormElement
      Simulate.submit(form)

      expect(onAddUrl).toHaveBeenCalledWith('https://example.com/watch-night.mp4')
      expect(input.value).toBe('')
      expect(container.querySelector('[data-add-media-error="true"]')).toBeNull()
      expect(container.querySelector('[data-add-media-status="true"]')).not.toBeNull()
      expect(container.textContent).toContain('Media added')
      expect(container.textContent).toContain('URL Safety Results')
      expect(container.textContent).toContain('YouTube, AnimePahe, Cineby, Miruro')
      expect(container.textContent).toContain('any site you can test together')
      expect(container.textContent).toContain('streaming connection lab')
      expect(container.textContent).toContain('picks the lowest-loss lane first')
      expect(container.textContent).toContain('zero-loss, under-10ms mock round trip')
      expect(container.textContent).toContain('visible recovered retries')
      expect(container.textContent).toContain('byte-pressure queue guards')
      expect(container.textContent).toContain('no skipped controls')
      expect(container.textContent).toContain('tiny control stream of typed commands')
    } finally {
      ReactDOM.unmountComponentAtNode(container)
      container.remove()
    }
  })

  it('normalizes shorthand watch links before queueing them', () => {
    const onAddUrl = jest.fn()
    const container = document.createElement('div')
    document.body.appendChild(container)

    try {
      ReactDOM.render(<RuntimeAddMediaPanel onAddUrl={onAddUrl} />, container)

      const input = container.querySelector('#runtime-add-media-url') as HTMLInputElement
      input.value = 'youtube.com/watch?v=honeystream-demo'
      Simulate.change(input)

      expect(container.querySelector('[data-add-media-source-preview="website"]')).not.toBeNull()
      expect(container.textContent).toContain('HTTPS added')
      expect(container.textContent).toContain('Honeystream will add https:// automatically')

      const form = container.querySelector('form') as HTMLFormElement
      Simulate.submit(form)

      expect(onAddUrl).toHaveBeenCalledWith('https://youtube.com/watch?v=honeystream-demo')
      expect(input.value).toBe('')
      expect(container.querySelector('[data-add-media-error="true"]')).toBeNull()
      expect(container.querySelector('[data-add-media-status="true"]')).not.toBeNull()
      expect(container.textContent).toContain('Media added with https:// filled in')
    } finally {
      ReactDOM.unmountComponentAtNode(container)
      container.remove()
    }
  })

  it('normalizes shorthand watch links that include an explicit port', () => {
    const onAddUrl = jest.fn()
    const container = document.createElement('div')
    document.body.appendChild(container)

    try {
      ReactDOM.render(<RuntimeAddMediaPanel onAddUrl={onAddUrl} />, container)

      const input = container.querySelector('#runtime-add-media-url') as HTMLInputElement
      input.value = 'youtube.com:443/watch?v=honeystream-demo'
      Simulate.change(input)

      expect(container.querySelector('[data-add-media-source-preview="website"]')).not.toBeNull()
      expect(container.querySelector('[data-add-media-provider="youtube"]')).not.toBeNull()
      expect(container.textContent).toContain('HTTPS added')

      const form = container.querySelector('form') as HTMLFormElement
      Simulate.submit(form)

      expect(onAddUrl).toHaveBeenCalledWith('https://youtube.com/watch?v=honeystream-demo')
      expect(container.querySelector('[data-add-media-error="true"]')).toBeNull()
      expect(container.textContent).toContain('Media added with https:// filled in')
    } finally {
      ReactDOM.unmountComponentAtNode(container)
      container.remove()
    }
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
      expect(container.textContent).toContain('Buddy can test it')
      expect(container.textContent).toContain(
        'YouTube is covered by the low-latency streaming-site mock tests'
      )
      expect(container.textContent).toContain('peak queues')
      expect(container.textContent).toContain('no skipped controls')
      expect(container.textContent).toContain('max control-frame size')

      input.value = 'https://youtube.com.evil/watch?v=honeystream-demo'
      Simulate.change(input)
      expect(container.querySelector('[data-add-media-provider="unknown"]')).not.toBeNull()
      expect(container.textContent).not.toContain('YouTube page detected')

      input.value = 'https://cdn.example.com/watch-night.mp4'
      Simulate.change(input)
      expect(
        container.querySelector('[data-add-media-source-preview="direct-media"]')
      ).not.toBeNull()
      expect(container.textContent).toContain('Direct media lane')

      input.value = 'example.com/watch-night'
      Simulate.change(input)
      expect(container.querySelector('[data-add-media-source-preview="website"]')).not.toBeNull()
      expect(container.textContent).toContain('HTTPS added')

      input.value = 'not a link'
      Simulate.change(input)
      expect(container.querySelector('[data-add-media-source-preview="invalid"]')).not.toBeNull()
      expect(container.querySelector('[data-source-confidence-state="warning"]')).not.toBeNull()
      expect(container.textContent).toContain('Needs a watch link')
    } finally {
      ReactDOM.unmountComponentAtNode(container)
      container.remove()
    }
  })

  it('previews the named streaming-site lanes used by runtime mock tests', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    try {
      ReactDOM.render(<RuntimeAddMediaPanel onAddUrl={jest.fn()} />, container)

      const input = container.querySelector('#runtime-add-media-url') as HTMLInputElement
      const sites = [
        { provider: 'youtube', source: 'youtube.com/watch?v=honeystream-demo', label: 'YouTube' },
        { provider: 'animepahe', source: 'animepahe.ru/play/honeystream-demo', label: 'AnimePahe' },
        { provider: 'cineby', source: 'cineby.app/movie/honeystream-demo', label: 'Cineby' },
        { provider: 'miruro', source: 'miruro.to/watch/honeystream-demo', label: 'Miruro' }
      ]

      for (const site of sites) {
        input.value = site.source
        Simulate.change(input)
        expect(container.querySelector('[data-add-media-source-preview="website"]')).not.toBeNull()
        expect(
          container.querySelector(`[data-add-media-provider="${site.provider}"]`)
        ).not.toBeNull()
        expect(container.textContent).toContain(`${site.label} lane`)
        expect(container.textContent).toContain(
          `${site.label} is covered by the low-latency streaming-site mock tests`
        )
      }
    } finally {
      ReactDOM.unmountComponentAtNode(container)
      container.remove()
    }
  })
})

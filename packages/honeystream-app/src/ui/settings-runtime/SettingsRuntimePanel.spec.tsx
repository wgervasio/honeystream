import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createDefaultMinimalSettings } from 'domain/settings/minimalSettings'
import { SettingsRuntimePanel } from './SettingsRuntimePanel'

describe('SettingsRuntimePanel', () => {
  it('renders minimal settings controls and normalization errors', () => {
    const html = renderToStaticMarkup(
      <SettingsRuntimePanel
        settings={createDefaultMinimalSettings()}
        onSettingsChange={() => {}}
        normalizationErrors={[
          { field: 'username', code: 'too-short' },
          { field: 'volume', code: 'out-of-range' }
        ]}
      />
    )

    expect(html).toContain('settings-runtime-username')
    expect(html).toContain('settings-runtime-volume')
    expect(html).toContain('settings-runtime-safe-browse')
    expect(html).toContain('settings-runtime-auto-fullscreen')
    expect(html).toContain('settings-runtime-theater-mode')
    expect(html).toContain('Normalization errors')
    expect(html).toContain('username: too-short')
    expect(html).toContain('volume: out-of-range')
  })
})

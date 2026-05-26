import { listOwnershipForOwner, playbackResourceOwnership } from './resourceOwnership'

describe('playback resource ownership contract', () => {
  it('covers core resource classes used by playback adapters', () => {
    const resources = playbackResourceOwnership.map(record => record.resource)

    expect(resources).toEqual(
      expect.arrayContaining([
        'adapter-instance',
        'object-url',
        'dom-listener',
        'timer',
        'iframe',
        'popup-window'
      ])
    )
  })

  it('requires every record to include cleanup and release phase', () => {
    for (const record of playbackResourceOwnership) {
      expect(record.cleanup.length).toBeGreaterThan(0)
      expect(record.releasePhase.length).toBeGreaterThan(0)
    }
  })

  it('keeps each owner/resource/release phase unique', () => {
    const keys = playbackResourceOwnership.map(
      record => `${record.owner}:${record.resource}:${record.releasePhase}`
    )
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('documents engine ownership for adapter instances', () => {
    const engineOwnership = listOwnershipForOwner('PlaybackEngine')
    expect(engineOwnership.map(record => record.resource)).toContain('adapter-instance')
  })
})

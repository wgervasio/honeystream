import { formatSessionPath } from './network'
import { APP_WEBSITE } from 'constants/http'

const SESSION_HASH = 'a'.repeat(64)

describe('utils/network', () => {
  it('keeps raw p2p session hashes unchanged', () => {
    expect(formatSessionPath(SESSION_HASH)).toBe(SESSION_HASH)
  })

  it('preserves invite query parameters from join links', () => {
    const inviteUrl = `${APP_WEBSITE}/join/${SESSION_HASH}?secret=invite-secret`

    expect(formatSessionPath(inviteUrl)).toBe(`${SESSION_HASH}?secret=invite-secret`)
  })
})

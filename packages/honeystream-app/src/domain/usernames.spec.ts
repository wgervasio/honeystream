import { sanitizeUsername, validateUsername } from './usernames'

describe('domain/usernames', () => {
  it('normalizes whitespace and validates bounds', () => {
    expect(validateUsername('  Alice   Host ').normalized).toBe('Alice Host')
    expect(validateUsername(' a ').issue).toBe('too-short')
    expect(validateUsername(new Array(40).join('x')).issue).toBe('too-long')
  })

  it('falls back for invalid values', () => {
    expect(sanitizeUsername('   ')).toBe('Unknown')
    expect(sanitizeUsername(42)).toBe('Unknown')
  })
})

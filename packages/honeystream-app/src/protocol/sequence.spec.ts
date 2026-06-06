import { validateInboundSequence } from './sequence'

describe('protocol sequence validation', () => {
  it('validates contiguous inbound sequences and holds position after a gap', () => {
    expect(validateInboundSequence(undefined, 10)).toEqual({
      ok: true,
      nextExpectedSeq: 11
    })
    expect(validateInboundSequence(11, 11)).toEqual({
      ok: true,
      nextExpectedSeq: 12
    })

    const gap = validateInboundSequence(12, 14)
    expect(gap.ok).toBe(false)
    expect(gap.nextExpectedSeq).toBe(12)
    if (!gap.ok) {
      expect(gap.error.code).toBe('invalidSequence')
      expect(gap.error.message).toBe('Unexpected message sequence 14. Expected 12.')
    }

    const duplicate = validateInboundSequence(12, 11)
    expect(duplicate.ok).toBe(false)
    expect(duplicate.nextExpectedSeq).toBe(12)
  })
})

export interface UsernameRules {
  readonly minLength: number
  readonly maxLength: number
  readonly fallback: string
}

export type UsernameValidationIssue = 'not-string' | 'too-short' | 'too-long'

export interface UsernameValidationResult {
  readonly ok: boolean
  readonly normalized: string
  readonly issue?: UsernameValidationIssue
}

export const DEFAULT_USERNAME_RULES: UsernameRules = {
  minLength: 2,
  maxLength: 32,
  fallback: 'Unknown'
}

const normalizeWhitespace = (value: string): string => value.trim().replace(/\s+/g, ' ')

export const normalizeUsername = (value: string): string => normalizeWhitespace(value)

export const validateUsername = (
  value: unknown,
  rules: UsernameRules = DEFAULT_USERNAME_RULES
): UsernameValidationResult => {
  if (typeof value !== 'string') {
    return { ok: false, normalized: '', issue: 'not-string' }
  }

  const normalized = normalizeUsername(value)
  if (normalized.length < rules.minLength) {
    return { ok: false, normalized, issue: 'too-short' }
  }
  if (normalized.length > rules.maxLength) {
    return { ok: false, normalized, issue: 'too-long' }
  }

  return { ok: true, normalized }
}

export const isValidUsername = (
  value: unknown,
  rules: UsernameRules = DEFAULT_USERNAME_RULES
): value is string => validateUsername(value, rules).ok

export const sanitizeUsername = (
  value: unknown,
  rules: UsernameRules = DEFAULT_USERNAME_RULES
): string => {
  const result = validateUsername(value, rules)
  return result.ok ? result.normalized : rules.fallback
}

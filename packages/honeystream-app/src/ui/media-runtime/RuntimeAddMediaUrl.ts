const URL_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i
const IPV4_HOST_PATTERN = /^\d{1,3}(?:\.\d{1,3}){3}$/
const PORT_PATTERN = /^\d{1,5}$/
const WHITESPACE_PATTERN = /\s/

const parseHttpUrl = (value: string): URL | undefined => {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : undefined
  } catch {
    return undefined
  }
}

const hasLikelyHttpHost = (url: URL): boolean =>
  url.hostname === 'localhost' ||
  url.hostname.indexOf('.') !== -1 ||
  IPV4_HOST_PATTERN.test(url.hostname)

const isLikelyHostPortShorthand = (value: string): boolean => {
  const authority = value.split(/[/?#]/, 1)[0]
  const portSeparatorIndex = authority.lastIndexOf(':')
  if (portSeparatorIndex <= 0) return false

  const host = authority.slice(0, portSeparatorIndex)
  const port = authority.slice(portSeparatorIndex + 1)
  return (
    PORT_PATTERN.test(port) &&
    (host === 'localhost' || host.indexOf('.') !== -1 || IPV4_HOST_PATTERN.test(host))
  )
}

export const normalizeRuntimeAddMediaHttpUrl = (value: string): string | undefined => {
  const trimmedValue = value.trim()
  if (trimmedValue.length === 0) return undefined

  const parsedUrl = parseHttpUrl(trimmedValue)
  if (parsedUrl) return parsedUrl.toString()

  if (
    (URL_SCHEME_PATTERN.test(trimmedValue) && !isLikelyHostPortShorthand(trimmedValue)) ||
    trimmedValue.startsWith('//') ||
    WHITESPACE_PATTERN.test(trimmedValue)
  ) {
    return undefined
  }

  const shorthandUrl = parseHttpUrl(`https://${trimmedValue}`)
  if (!shorthandUrl || !hasLikelyHttpHost(shorthandUrl)) return undefined

  return shorthandUrl.toString()
}

export const isRuntimeAddMediaHttpUrl = (value: string): boolean =>
  typeof normalizeRuntimeAddMediaHttpUrl(value) === 'string'

export const isRuntimeAddMediaShorthandHttpUrl = (value: string): boolean => {
  const trimmedValue = value.trim()
  if (trimmedValue.length === 0 || parseHttpUrl(trimmedValue)) return false

  return typeof normalizeRuntimeAddMediaHttpUrl(trimmedValue) === 'string'
}

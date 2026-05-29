import isIp from 'is-ip'
import { APP_WEBSITE } from 'constants/http'

const P2P_HASH_REGEX = /^[a-fA-F0-9]{64}$/i

export const isP2PHash = (hash: string) => P2P_HASH_REGEX.test(hash)
export const isIP = (ip: string): boolean => isIp(ip)

export const isUrlDomain = (urlStr: string) => {
  let url: URL
  try {
    url = urlStr.indexOf('://') > -1 ? new URL(urlStr) : new URL(`http://${urlStr}`)
  } catch {
    return false
  }
  return url.host === urlStr
}

const formatJoinPath = (pathname: string, search: string): string | undefined => {
  const hash = pathname.startsWith('/join/') && pathname.split('/').pop()
  if (hash && isP2PHash(hash)) {
    return `${hash}${search}`
  }

  return undefined
}

const formatHashJoinPath = (url: URL): string | undefined => {
  const hashPath = url.hash.charAt(0) === '#' ? url.hash.slice(1) : url.hash
  if (hashPath.charAt(0) !== '/') {
    return undefined
  }

  let hashUrl: URL
  try {
    hashUrl = new URL(hashPath, url.origin)
  } catch {
    return undefined
  }

  return formatJoinPath(hashUrl.pathname, hashUrl.search)
}

const getCurrentOrigin = (): string | undefined =>
  typeof location === 'undefined' ? undefined : location.origin

export const formatSessionPath = (uri: string): string => {
  if (isP2PHash(uri)) return uri

  let url: URL
  try {
    url = new URL(uri)
  } catch {
    return uri
  }

  // Get session hash from /join url
  const currentOrigin = getCurrentOrigin()
  if (url.origin === APP_WEBSITE || url.origin === currentOrigin) {
    const pathSession = formatJoinPath(url.pathname, url.search)
    if (pathSession) return pathSession

    const hashSession = formatHashJoinPath(url)
    if (hashSession) return hashSession
  }

  return uri
}

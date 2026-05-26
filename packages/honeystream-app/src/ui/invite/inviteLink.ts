import {
  FormatPrivateInviteLinkInput,
  ParsePrivateInviteLinkInput,
  PrivateInviteParseResult
} from './types'

export const DEFAULT_INVITE_JOIN_PATH = '/join'
const DEFAULT_PARSE_BASE_URL = 'https://invite.honeystream.invalid'

const normalizeJoinPath = (joinPath: string): string | null => {
  const trimmedPath = joinPath.trim()
  if (trimmedPath.length === 0) {
    return null
  }

  const pathWithLeadingSlash = trimmedPath.charAt(0) === '/' ? trimmedPath : `/${trimmedPath}`
  const normalizedPath = pathWithLeadingSlash.replace(/\/+$/, '')
  return normalizedPath.length > 0 ? normalizedPath : null
}

const normalizePathname = (pathname: string): string => pathname.replace(/\/+$/, '')

const decodeRoomId = (encodedRoomId: string): string | null => {
  try {
    return decodeURIComponent(encodedRoomId)
  } catch {
    return null
  }
}

const parseRoomIdFromPath = (pathname: string, joinPath: string): string | null => {
  const normalizedPathname = normalizePathname(pathname)
  const pathPrefix = `${joinPath}/`

  if (normalizedPathname.indexOf(pathPrefix) !== 0) {
    return null
  }

  const encodedRoomId = normalizedPathname.slice(pathPrefix.length)
  if (encodedRoomId.length === 0 || encodedRoomId.indexOf('/') >= 0) {
    return null
  }

  const decodedRoomId = decodeRoomId(encodedRoomId)
  if (!decodedRoomId || decodedRoomId.indexOf('/') >= 0) {
    return null
  }

  const roomId = decodedRoomId.trim()
  return roomId.length > 0 ? roomId : null
}

const trimRequired = (value: string, fieldName: string): string => {
  const trimmedValue = value.trim()
  if (trimmedValue.length === 0) {
    throw new Error(`Invite ${fieldName} must be a non-empty string.`)
  }

  return trimmedValue
}

export const formatPrivateInviteLink = (input: FormatPrivateInviteLinkInput): string => {
  const roomId = trimRequired(input.roomId, 'room ID')
  const secret = trimRequired(input.secret, 'secret')
  const baseUrl = trimRequired(input.baseUrl, 'base URL')
  const joinPath = normalizeJoinPath(input.joinPath || DEFAULT_INVITE_JOIN_PATH)
  if (!joinPath) {
    throw new Error('Invite join path must include at least one path segment.')
  }

  let inviteUrl: URL
  try {
    inviteUrl = new URL(baseUrl)
  } catch {
    throw new Error(`Invite base URL "${baseUrl}" must be an absolute URL.`)
  }

  inviteUrl.pathname = `${joinPath}/${encodeURIComponent(roomId)}`
  inviteUrl.search = ''
  inviteUrl.searchParams.set('secret', secret)
  inviteUrl.hash = ''

  return inviteUrl.toString()
}

export const parsePrivateInviteLink = (
  input: ParsePrivateInviteLinkInput
): PrivateInviteParseResult => {
  const joinPath = normalizeJoinPath(input.joinPath || DEFAULT_INVITE_JOIN_PATH)
  if (!joinPath) {
    return {
      ok: false,
      error: {
        code: 'invalid-join-path',
        message: 'Invite join path must include at least one path segment.'
      }
    }
  }

  const inviteLink = input.inviteLink.trim()
  if (inviteLink.length === 0) {
    return {
      ok: false,
      error: {
        code: 'invalid-url',
        message: 'Invite link must be a non-empty URL string.'
      }
    }
  }

  const baseUrl = input.baseUrl ? input.baseUrl.trim() : DEFAULT_PARSE_BASE_URL

  let inviteUrl: URL
  try {
    inviteUrl = new URL(inviteLink, baseUrl || DEFAULT_PARSE_BASE_URL)
  } catch {
    return {
      ok: false,
      error: {
        code: 'invalid-url',
        message: 'Invite link must be a valid URL or absolute path.'
      }
    }
  }

  const roomId = parseRoomIdFromPath(inviteUrl.pathname, joinPath)
  if (!roomId) {
    return {
      ok: false,
      error: {
        code: 'missing-room-id',
        message: `Invite link path must match "${joinPath}/:roomId".`
      }
    }
  }

  const secretCandidate = inviteUrl.searchParams.get('secret')
  const secret = secretCandidate ? secretCandidate.trim() : ''
  if (secret.length === 0) {
    return {
      ok: false,
      error: {
        code: 'missing-secret',
        message: 'Invite link is missing the "secret" query parameter.'
      }
    }
  }

  return {
    ok: true,
    value: {
      roomId,
      secret
    }
  }
}

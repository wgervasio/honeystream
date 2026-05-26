import {
  SessionParticipantUsernamesModel,
  SessionShellProps,
  SessionSystemErrorCode,
  SessionSystemErrorViewModel,
  SessionViewState
} from '../session'
import {
  SessionRuntimeIntentCallbacks,
  SessionRuntimeProjectionSnapshot,
  SessionRuntimeSystemErrorSnapshot
} from './types'

const KNOWN_SYSTEM_ERROR_CODES: Readonly<Record<SessionSystemErrorCode, true>> = Object.freeze({
  'invite-invalid': true,
  'join-rejected': true,
  'transport-disconnected': true,
  'transport-timeout': true,
  'protocol-rejected': true,
  unknown: true
})

const mapSessionViewState = (
  state: SessionRuntimeProjectionSnapshot['session']['status']
): SessionViewState => state

const mapSessionSystemErrorCode = (code: string): SessionSystemErrorCode => {
  if (code in KNOWN_SYSTEM_ERROR_CODES) {
    switch (code) {
      case 'invite-invalid':
      case 'join-rejected':
      case 'transport-disconnected':
      case 'transport-timeout':
      case 'protocol-rejected':
      case 'unknown':
        return code
    }
  }

  return 'unknown'
}

const mapSessionSystemError = (
  error: SessionRuntimeSystemErrorSnapshot
): SessionSystemErrorViewModel => ({
  id: error.id,
  code: mapSessionSystemErrorCode(error.code),
  message: error.message
})

const mapParticipantUsernames = (
  snapshot: SessionRuntimeProjectionSnapshot
): SessionParticipantUsernamesModel => {
  const guest = snapshot.session.participants.guest

  return {
    hostUsername: snapshot.session.participants.host.username,
    guestUsername: guest ? guest.username : undefined
  }
}

export const mapProjectionSnapshotToSessionShellProps = (
  snapshot: SessionRuntimeProjectionSnapshot
): SessionShellProps => ({
  state: mapSessionViewState(snapshot.session.status),
  participantUsernames: mapParticipantUsernames(snapshot),
  errors: snapshot.systemErrors.map(mapSessionSystemError)
})

export interface SessionRuntimeShellViewModel {
  readonly sessionShellProps: SessionShellProps
  readonly snapshot: SessionRuntimeProjectionSnapshot
  readonly intents: SessionRuntimeIntentCallbacks
}

export const createSessionRuntimeShellViewModel = (
  snapshot: SessionRuntimeProjectionSnapshot,
  intents: SessionRuntimeIntentCallbacks
): SessionRuntimeShellViewModel => ({
  sessionShellProps: mapProjectionSnapshotToSessionShellProps(snapshot),
  snapshot,
  intents
})

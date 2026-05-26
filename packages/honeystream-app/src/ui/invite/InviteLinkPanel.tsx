import React, { memo } from 'react'
import { formatPrivateInviteLink } from './inviteLink'
import { PrivateInviteCredentials } from './types'

interface InviteFieldProps {
  readonly copyLabel: string
  readonly fieldId: string
  readonly label: string
  readonly onCopy?: (value: string) => void
  readonly value: string
}

const InviteField = memo(function InviteField(props: InviteFieldProps) {
  return (
    <div data-invite-field={props.fieldId}>
      <span>{`${props.label}: `}</span>
      <code>{props.value}</code>
      {props.onCopy ? (
        <>
          {' '}
          <button type="button" onClick={() => props.onCopy && props.onCopy(props.value)}>
            {props.copyLabel}
          </button>
        </>
      ) : null}
    </div>
  )
})

export interface InviteLinkPanelProps {
  readonly baseUrl: string
  readonly className?: string
  readonly copyLabel?: string
  readonly invite: PrivateInviteCredentials
  readonly inviteLinkLabel?: string
  readonly joinPath?: string
  readonly onCopyInviteLink?: (inviteLink: string) => void
  readonly onCopyRoomId?: (roomId: string) => void
  readonly onCopySecret?: (secret: string) => void
  readonly roomIdLabel?: string
  readonly secretLabel?: string
  readonly title?: string
}

export const InviteLinkPanel = memo(function InviteLinkPanel(props: InviteLinkPanelProps) {
  const inviteLink = formatPrivateInviteLink({
    baseUrl: props.baseUrl,
    joinPath: props.joinPath,
    roomId: props.invite.roomId,
    secret: props.invite.secret
  })

  const copyLabel = props.copyLabel || 'Copy'

  return (
    <section className={props.className}>
      {props.title ? <p>{props.title}</p> : null}
      <InviteField
        fieldId="invite-link"
        label={props.inviteLinkLabel || 'Invite link'}
        value={inviteLink}
        copyLabel={copyLabel}
        onCopy={props.onCopyInviteLink}
      />
      <InviteField
        fieldId="room-id"
        label={props.roomIdLabel || 'Room ID'}
        value={props.invite.roomId}
        copyLabel={copyLabel}
        onCopy={props.onCopyRoomId}
      />
      <InviteField
        fieldId="secret"
        label={props.secretLabel || 'Secret'}
        value={props.invite.secret}
        copyLabel={copyLabel}
        onCopy={props.onCopySecret}
      />
    </section>
  )
})

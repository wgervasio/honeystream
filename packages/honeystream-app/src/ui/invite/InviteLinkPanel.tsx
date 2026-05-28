import React, { memo, useEffect, useRef, useState } from 'react'
import { formatPrivateInviteLink } from './inviteLink'
import { PrivateInviteCredentials } from './types'

interface InviteFieldProps {
  readonly copiedLabel: string
  readonly copyLabel: string
  readonly fieldId: string
  readonly isCopied: boolean
  readonly label: string
  readonly onCopy?: (fieldId: string, value: string) => void
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
          <button
            type="button"
            data-copy-state={props.isCopied ? 'copied' : 'idle'}
            onClick={() => props.onCopy && props.onCopy(props.fieldId, props.value)}
          >
            {props.isCopied ? props.copiedLabel : props.copyLabel}
          </button>
        </>
      ) : null}
    </div>
  )
})

export interface InviteLinkPanelProps {
  readonly baseUrl: string
  readonly className?: string
  readonly copiedLabel?: string
  readonly copyLabel?: string
  readonly description?: string
  readonly id?: string
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
  const [copiedField, setCopiedField] = useState<string | undefined>()
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const inviteLink = formatPrivateInviteLink({
    baseUrl: props.baseUrl,
    joinPath: props.joinPath,
    roomId: props.invite.roomId,
    secret: props.invite.secret
  })

  const copyLabel = props.copyLabel || 'Copy'
  const copiedLabel = props.copiedLabel || 'Copied'

  useEffect(
    () => () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current)
      }
    },
    []
  )

  const handleCopy = (fieldId: string, value: string, onCopy?: (value: string) => void): void => {
    if (!onCopy) {
      return
    }

    onCopy(value)
    setCopiedField(fieldId)

    if (copyTimerRef.current) {
      clearTimeout(copyTimerRef.current)
    }

    copyTimerRef.current = setTimeout(() => {
      setCopiedField(undefined)
      copyTimerRef.current = undefined
    }, 1600)
  }

  return (
    <section id={props.id} className={props.className}>
      {props.title ? <p>{props.title}</p> : null}
      {props.description ? <p data-invite-description="true">{props.description}</p> : null}
      <InviteField
        copiedLabel={copiedLabel}
        fieldId="invite-link"
        label={props.inviteLinkLabel || 'Invite link'}
        value={inviteLink}
        copyLabel={copyLabel}
        isCopied={copiedField === 'invite-link'}
        onCopy={
          props.onCopyInviteLink
            ? (fieldId, value) => handleCopy(fieldId, value, props.onCopyInviteLink)
            : undefined
        }
      />
      <InviteField
        copiedLabel={copiedLabel}
        fieldId="room-id"
        label={props.roomIdLabel || 'Room ID'}
        value={props.invite.roomId}
        copyLabel={copyLabel}
        isCopied={copiedField === 'room-id'}
        onCopy={
          props.onCopyRoomId
            ? (fieldId, value) => handleCopy(fieldId, value, props.onCopyRoomId)
            : undefined
        }
      />
      <InviteField
        copiedLabel={copiedLabel}
        fieldId="secret"
        label={props.secretLabel || 'Secret'}
        value={props.invite.secret}
        copyLabel={copyLabel}
        isCopied={copiedField === 'secret'}
        onCopy={
          props.onCopySecret
            ? (fieldId, value) => handleCopy(fieldId, value, props.onCopySecret)
            : undefined
        }
      />
    </section>
  )
})

import React, { Component } from 'react'
import styles from './SessionJoin.css'
import LayoutMain from 'components/layout/Main'
import { MenuButton } from 'components/menu/MenuButton'
import { TextInput, InputGroup } from './common/input'
import { MenuHeader } from './menu/MenuHeader'
import { t } from 'locale'
import { parsePrivateInviteLink } from '../ui/invite'
import { isP2PHash } from '../utils/network'

interface IProps {
  connect: (sessionId: string) => void
}

type JoinInvitePreviewState = 'complete' | 'partial' | 'manual'

interface JoinInvitePreview {
  readonly detail: string
  readonly roomLabel: string
  readonly secretLabel: string
  readonly state: JoinInvitePreviewState
  readonly title: string
}

interface IState {
  readonly invitePreview?: JoinInvitePreview
}

const readPreviousFriendCode = (): string => {
  if (typeof localStorage === 'undefined') {
    return ''
  }

  return localStorage.getItem('prevFriendCode') || ''
}

const shortenRoomCode = (roomId: string): string => {
  if (roomId.length <= 18) {
    return roomId
  }

  return `${roomId.slice(0, 10)}...${roomId.slice(-6)}`
}

const createInvitePreview = (value: string): JoinInvitePreview | undefined => {
  const invite = value.trim()
  if (invite.length === 0) {
    return undefined
  }

  const parsedInvite = parsePrivateInviteLink({ inviteLink: invite })
  if (parsedInvite.ok) {
    return {
      detail: 'Full invite detected. You can hop straight into the private rabbit-side seat.',
      roomLabel: `Room ${shortenRoomCode(parsedInvite.value.roomId)}`,
      secretLabel: 'Secret included',
      state: 'complete',
      title: 'Invite ready'
    }
  }

  if (isP2PHash(invite)) {
    return {
      detail:
        'Room code detected. A full invite link is still best when the room expects a secret.',
      roomLabel: `Room ${shortenRoomCode(invite)}`,
      secretLabel: 'Secret not included',
      state: 'partial',
      title: 'Room code ready'
    }
  }

  if (parsedInvite.error.code === 'missing-secret') {
    return {
      detail: 'This looks like a room link, but it is missing the private invite secret.',
      roomLabel: 'Room link detected',
      secretLabel: 'Secret missing',
      state: 'partial',
      title: 'Almost ready'
    }
  }

  return {
    detail: 'Paste the full invite link from cat-side or a 64-character room code.',
    roomLabel: 'Waiting for room',
    secretLabel: 'Waiting for secret',
    state: 'manual',
    title: 'Checking invite'
  }
}

export class SessionJoin extends Component<IProps, IState> {
  private sessionInput: HTMLInputElement | null = null
  readonly state: IState = {
    invitePreview: createInvitePreview(readPreviousFriendCode())
  }

  render(): JSX.Element | null {
    const previousFriendCode = readPreviousFriendCode()
    const inviteDescriptionId = this.state.invitePreview
      ? 'join_invite_hint join_invite_preview'
      : 'join_invite_hint'
    const linkBreakdown = [
      {
        label: 'Invite link',
        detail: 'Brings you to the private room'
      },
      {
        label: 'Room ID',
        detail: 'Finds the cat-side host'
      },
      {
        label: 'Secret',
        detail: 'Keeps the rabbit-side seat private'
      }
    ]
    const readyStack = [
      {
        step: '01',
        title: 'Paste the whole invite',
        detail: 'Full links carry the room code and secret together.'
      },
      {
        step: '02',
        title: 'Land in one seat',
        detail: 'Rabbit-side gets the guest spot without public room clutter.'
      },
      {
        step: '03',
        title: 'Watch the same source',
        detail: 'The room opens to the host-led website, direct link, or local-file flow.'
      }
    ]

    return (
      <LayoutMain className={styles.container}>
        <section className={styles.card} aria-labelledby="join_headline">
          <p className={styles.kicker}>Joining a cozy stream?</p>
          <MenuHeader text={t('joinSession')} />
          <h2 id="join_headline">Paste the invite link and hop into sync.</h2>
          <p className={styles.lede}>
            Honeystream keeps the shared connection small: one host, one guest, compact playback
            commands, and media loaded locally by each browser.
          </p>
          <div id="join_comfort_checks" className={styles.comfortChecks}>
            <span>Cat-side host sends one invite</span>
            <span>Rabbit-side guest lands here</span>
            <span>Controls sync after approval</span>
          </div>
          <div className={styles.joinPreview} aria-label="Join preview">
            <span className={styles.joinBubbleCat}>Cat-side is hosting</span>
            <strong>one private hop</strong>
            <span className={styles.joinBubbleRabbit}>Rabbit-side joins</span>
          </div>
          <div id="join_invite_ribbon" className={styles.inviteRibbon} aria-label="Invite flow">
            <span>Paste invite</span>
            <span>Confirm your name</span>
            <span>Hop into the room</span>
          </div>
          <div className={styles.inviteIllustration} aria-label="Cat and rabbit invite handoff">
            <span className={styles.catPocket}>
              <strong>Cat-side</strong>
              Sends the room
            </span>
            <span className={styles.hopTrail}>sync</span>
            <span className={styles.rabbitPocket}>
              <strong>Rabbit-side</strong>
              Lands together
            </span>
          </div>
          <div
            id="join_link_breakdown"
            className={styles.linkBreakdown}
            aria-label="Invite link breakdown"
          >
            {linkBreakdown.map(item => (
              <span key={item.label}>
                <strong>{item.label}</strong>
                {item.detail}
              </span>
            ))}
          </div>
          <div id="join_ready_stack" className={styles.readyStack} aria-label="Join ready stack">
            {readyStack.map(card => (
              <article key={card.step}>
                <span>{card.step}</span>
                <strong>{card.title}</strong>
                <p>{card.detail}</p>
              </article>
            ))}
          </div>
          <form
            onSubmit={e => {
              e.preventDefault()
              this.submit()
            }}
          >
            <label className={styles.label} htmlFor="join_invite_input">
              {t('enterJoinDest')}
            </label>
            <InputGroup>
              <TextInput
                id="join_invite_input"
                theRef={el => (this.sessionInput = el)}
                className={styles.peerId}
                placeholder="e.g. https://app.gethoneystream.com/join/abcd123…"
                defaultValue={previousFriendCode || undefined}
                spellCheck={false}
                aria-describedby={inviteDescriptionId}
                onChange={event => {
                  const input = event.currentTarget as HTMLInputElement
                  if (this.sessionInput) {
                    this.sessionInput.classList.remove('invalid')
                  }
                  this.setState({
                    invitePreview: createInvitePreview(input.value)
                  })
                }}
                autoFocus
                required
              />
              <MenuButton
                icon="globe"
                size="medium"
                className={styles.joinButton}
                onClick={this.submit}
              >
                {t('join')}
              </MenuButton>
            </InputGroup>
            <p id="join_invite_hint" className={styles.inputHint}>
              Full invite links are best: they carry the room ID and secret together so the
              rabbit-side seat stays private.
            </p>
            {this.state.invitePreview ? (
              <div
                id="join_invite_preview"
                className={styles.invitePreview}
                data-invite-preview-state={this.state.invitePreview.state}
                aria-live="polite"
              >
                <span>{this.state.invitePreview.title}</span>
                <strong>{this.state.invitePreview.roomLabel}</strong>
                <b>{this.state.invitePreview.secretLabel}</b>
                <p>{this.state.invitePreview.detail}</p>
              </div>
            ) : null}
          </form>
          <div className={styles.hintGrid} aria-hidden="true">
            <span>Private invite</span>
            <span>One guest</span>
            <span>Synced controls</span>
          </div>
        </section>
      </LayoutMain>
    )
  }

  private submit = () => {
    if (!this.sessionInput) {
      return
    }

    const valid = this.sessionInput.checkValidity()
    if (valid) {
      const value = this.sessionInput.value.trim()
      localStorage.setItem('prevFriendCode', value)
      this.props.connect(value)
    } else {
      this.sessionInput.classList.add('invalid')
      this.sessionInput.focus()
    }
  }
}

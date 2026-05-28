import React, { Component } from 'react'
import styles from './SessionJoin.css'
import LayoutMain from 'components/layout/Main'
import { MenuButton } from 'components/menu/MenuButton'
import { TextInput, InputGroup } from './common/input'
import { MenuHeader } from './menu/MenuHeader'
import { t } from 'locale'

interface IProps {
  connect: (sessionId: string) => void
}

export class SessionJoin extends Component<IProps> {
  private sessionInput: HTMLInputElement | null = null

  render(): JSX.Element | null {
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
                defaultValue={localStorage.getItem('prevFriendCode') || undefined}
                spellCheck={false}
                aria-describedby="join_invite_hint"
                onChange={() => {
                  if (this.sessionInput) {
                    this.sessionInput.classList.remove('invalid')
                  }
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

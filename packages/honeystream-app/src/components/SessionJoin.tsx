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
          <form onSubmit={e => e.preventDefault()}>
            <p className={styles.label}>{t('enterJoinDest')}</p>
            <InputGroup>
              <TextInput
                theRef={el => (this.sessionInput = el)}
                className={styles.peerId}
                placeholder="e.g. https://app.gethoneystream.com/join/abcd123…"
                defaultValue={localStorage.getItem('prevFriendCode') || undefined}
                spellCheck={false}
                autoFocus
                required
              />
              <MenuButton
                icon="globe"
                size="medium"
                className={styles.joinButton}
                onClick={() => {
                  const valid = Boolean(this.sessionInput && this.sessionInput.checkValidity())
                  if (valid) {
                    const value = this.sessionInput!.value.trim()
                    localStorage.setItem('prevFriendCode', value)
                    this.props.connect(value)
                  } else {
                    this.sessionInput!.classList.add('invalid')
                  }
                }}
              >
                {t('join')}
              </MenuButton>
            </InputGroup>
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
}

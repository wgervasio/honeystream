import React, { Component } from 'react'

import { PRODUCT_NAME, VERSION } from 'constants/app'

import styles from './Home.css'
import LayoutMain from 'components/layout/Main'
import { MenuButton } from 'components/menu/MenuButton'
import { MenuHeader } from './menu/MenuHeader'
import { assetUrl } from 'utils/appUrl'
import { withNamespaces, WithNamespaces } from 'react-i18next'
import { localUserId } from '../network/index'

interface IProps extends WithNamespaces {
  installable: boolean
  install?: () => void
}

class Home extends Component<IProps> {
  render() {
    const { t } = this.props

    const DEV = process.env.NODE_ENV === 'development'
    const gitv = `${process.env.GIT_BRANCH}@${process.env.GIT_COMMIT}`
    const featureCards = [
      {
        id: 'private',
        label: 'Private 1:1 rooms',
        title: 'One host, one guest, no noisy room drama.',
        body:
          'Send one invite link, keep playback host-authoritative, and stay focused on the watch night.'
      },
      {
        id: 'sync',
        label: 'Low-latency sync',
        title: 'Play, pause, seek, and speed changes travel light.',
        body:
          'Honeystream shares compact playback commands instead of constantly streaming timeline ticks.'
      },
      {
        id: 'sites',
        label: 'Files + websites',
        title: 'Bring local files, YouTube, direct links, or sites both browsers can open.',
        body:
          'Each person loads the media locally, which keeps shared bytes small and playback responsive.'
      }
    ]

    return (
      <LayoutMain className={styles.container} showBackButton={false}>
        <MenuHeader
          className={styles.header}
          text={
            <>
              <img
                src={assetUrl('icons/honeystream-icon.svg')}
                className={styles.logo}
                width="48"
                alt=""
              />
              {PRODUCT_NAME}

              <div className={styles.buildInfo}>
                <h3>
                  Beta {VERSION}
                  {DEV && ` (${gitv})`}
                </h3>
                {DEV && <h3>Development build</h3>}
              </div>
            </>
          }
        />
        <section className={styles.nav}>
          <ul>
            <li>
              <MenuButton
                id="startsession"
                to={`/join/${localUserId()}`}
                className={styles.btn}
                icon="play"
              >
                {t('startSession')}
              </MenuButton>
            </li>
            <li>
              <MenuButton id="joinsession" to="/join" className={styles.btn} icon="globe">
                {t('joinSession')}
              </MenuButton>
            </li>
            <li>
              <MenuButton id="settings" to="/settings" className={styles.btn} icon="settings">
                {t('settings')}
              </MenuButton>
            </li>
            {this.props.installable && (
              <li>
                <MenuButton icon="download" onClick={this.props.install}>
                  {t('installToDesktop')}
                </MenuButton>
              </li>
            )}
          </ul>
        </section>

        <section className={styles.intro} aria-labelledby="home_headline">
          <p className={styles.kicker}>Cozy private watch nights</p>
          <h2 id="home_headline">
            Happy streams, tiny sync messages, and fewer "are you ahead?" moments.
          </h2>
          <p>
            Start a session, invite your person, then add a downloaded video, website video, or
            direct media URL. Honeystream keeps the shared state small and lets both browsers load
            the media they can access.
          </p>
          <div id="home_site_examples" className={styles.siteExamples} aria-label="Site examples">
            <span>Good test paths:</span>
            <strong>YouTube</strong>
            <strong>direct MP4</strong>
            <strong>anime pages</strong>
            <strong>movie pages</strong>
          </div>
          <div className={styles.featureGrid} aria-label="Honeystream focus areas">
            {featureCards.map(card => (
              <article key={card.id} id={`home_feature_${card.id}`} className={styles.featureCard}>
                <span>{card.label}</span>
                <h3>{card.title}</h3>
                <p>{card.body}</p>
              </article>
            ))}
          </div>
        </section>
      </LayoutMain>
    )
  }
}

export default withNamespaces()(Home)

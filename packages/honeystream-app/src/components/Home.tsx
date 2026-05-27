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
    const watchFlowCards = [
      {
        id: 'pick',
        eyebrow: 'Pick the vibe',
        title: 'Drop in a link, local file, or supported site.',
        body:
          'The room treats everything like one simple queue, so the next thing to watch is never buried.'
      },
      {
        id: 'sync',
        eyebrow: 'Stay together',
        title: 'Host-side controls keep both browsers aligned.',
        body:
          'Play, pause, seek, and speed changes stay obvious without turning the night into tech support.'
      },
      {
        id: 'settle',
        eyebrow: 'Settle in',
        title: 'A tiny two-person room leaves space for the actual hang.',
        body: 'No public lobby clutter, no random audience, just one invite and one shared stream.'
      }
    ]

    return (
      <LayoutMain className={styles.container} showBackButton={false}>
        <div className={styles.shell}>
          <MenuHeader
            className={styles.header}
            text={
              <>
                <span className={styles.brandMark}>
                  <img
                    src={assetUrl('icons/honeystream-icon.svg')}
                    className={styles.logo}
                    width="48"
                    alt=""
                  />
                </span>
                <span>{PRODUCT_NAME}</span>

                <div className={styles.buildInfo}>
                  <h3>
                    Beta {VERSION}
                    {DEV && ` (${gitv})`}
                  </h3>
                  {DEV && <h3>Development build</h3>}
                </div>
              </>
            }
          >
            <span className={styles.headerPill}>Cat-side + rabbit-side watch room</span>
          </MenuHeader>

          <section className={styles.hero} data-home-hero="cozy">
            <div className={styles.heroCopy}>
              <p className={styles.kicker}>Private synced playback for two</p>
              <h2 id="home_headline">
                Happy streams, soft vibes, and fewer "are you ahead?" moments.
              </h2>
              <p>
                Start a room, share one invite, and keep files, direct media links, and supported
                websites moving in lockstep. The host keeps things tidy while both sides get an
                easy, low-drama watch flow.
              </p>

              <nav className={styles.actionGrid} aria-label="Primary actions">
                <MenuButton
                  id="startsession"
                  to={`/join/${localUserId()}`}
                  className={`${styles.btn} ${styles.primaryAction}`}
                  icon="play"
                >
                  Start cozy room
                </MenuButton>
                <MenuButton
                  id="joinsession"
                  to="/join"
                  className={`${styles.btn} ${styles.secondaryAction}`}
                  icon="globe"
                >
                  Join with invite
                </MenuButton>
                <MenuButton
                  id="settings"
                  to="/settings"
                  className={`${styles.btn} ${styles.ghostAction}`}
                  icon="settings"
                >
                  {t('settings')}
                </MenuButton>
                {this.props.installable && (
                  <MenuButton
                    icon="download"
                    onClick={this.props.install}
                    className={`${styles.btn} ${styles.ghostAction}`}
                  >
                    {t('installToDesktop')}
                  </MenuButton>
                )}
              </nav>
            </div>

            <aside className={styles.companionCard} aria-label="Cozy room motif">
              <div className={styles.petPair}>
                <span className={`${styles.petOrb} ${styles.catOrb}`} />
                <span className={`${styles.petOrb} ${styles.rabbitOrb}`} />
              </div>
              <p className={styles.companionTitle}>One cat person. One bunny person.</p>
              <p className={styles.companionText}>
                A soft command center for deciding what to watch, adding it fast, and staying in
                sync without digging through menus.
              </p>
              <div className={styles.comfortGrid} aria-label="Room promises">
                <span>
                  <strong>2</strong>
                  people max
                </span>
                <span>
                  <strong>1</strong>
                  invite link
                </span>
                <span>
                  <strong>0</strong>
                  public chaos
                </span>
              </div>
            </aside>
          </section>

          <section
            id="home_watch_flow"
            className={styles.watchFlow}
            aria-labelledby="home_watch_flow_title"
          >
            <div className={styles.flowIntro}>
              <p className={styles.kicker}>Made for the two of you</p>
              <h3 id="home_watch_flow_title">
                Cat-side picks the vibe, Rabbit-side hops in, and the room keeps watch night moving.
              </h3>
              <p>
                Honeystream should feel like a cozy little control booth: quick to start, clear
                about who is connected, and relaxed enough for websites, direct links, and files.
              </p>
            </div>
            <div className={styles.flowRail} aria-label="Watch flow">
              {watchFlowCards.map(card => (
                <article key={card.id} className={styles.flowCard}>
                  <span>{card.eyebrow}</span>
                  <h4>{card.title}</h4>
                  <p>{card.body}</p>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.steps} aria-label="How Honeystream works">
            <article className={styles.step}>
              <strong>1. Open a private room</strong>
              <span>Honeystream creates one host-owned room for you and one guest.</span>
            </article>
            <article className={styles.step}>
              <strong>2. Share the invite</strong>
              <span>Paste the link once, then approve the person joining your room.</span>
            </article>
            <article className={styles.step}>
              <strong>3. Add what you want</strong>
              <span>
                Use local files, website videos, or direct media URLs from one clean panel.
              </span>
            </article>
          </section>

          <div id="home_site_examples" className={styles.siteExamples} aria-label="Site examples">
            <span>Good test paths:</span>
            <strong>YouTube</strong>
            <strong>direct MP4</strong>
            <strong>anime pages</strong>
            <strong>movie pages</strong>
          </div>

          <section className={styles.featureGrid} aria-label="Honeystream focus areas">
            {featureCards.map(card => (
              <article key={card.id} id={`home_feature_${card.id}`} className={styles.featureCard}>
                <span>{card.label}</span>
                <h3>{card.title}</h3>
                <p>{card.body}</p>
              </article>
            ))}
          </section>
        </div>
      </LayoutMain>
    )
  }
}

export default withNamespaces()(Home)

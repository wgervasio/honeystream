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

        <section className={styles.intro}>
          <h2>Private synced playback for files and sites.</h2>
          <p>
            Start a session, send the link to one other person, then add a downloaded video,
            website video, or direct media URL. Play, pause, seek, and speed changes stay synced
            through the session.
          </p>
        </section>
      </LayoutMain>
    )
  }
}

export default withNamespaces()(Home)

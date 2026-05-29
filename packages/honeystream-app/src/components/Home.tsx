import React, { ChangeEvent, Component, FormEvent } from 'react'

import { PRODUCT_NAME, VERSION } from 'constants/app'

import styles from './Home.css'
import LayoutMain from 'components/layout/Main'
import { MenuButton } from 'components/menu/MenuButton'
import { MenuHeader } from './menu/MenuHeader'
import { assetUrl } from 'utils/appUrl'
import { withNamespaces, WithNamespaces } from 'react-i18next'
import { localUserId } from '../network/index'
import {
  createRuntimeAddMediaSourcePreview,
  normalizeRuntimeAddMediaHttpUrl
} from '../ui/media-runtime/RuntimeAddMediaSourcePreview'
import {
  STREAMING_SITE_CONNECTION_FIXTURES,
  STREAMING_SITE_CONNECTION_P95_ROUND_TRIP_BUDGET_MS
} from '../transport/streaming-site-connection-defaults'

interface IProps extends WithNamespaces {
  installable: boolean
  install?: () => void
  startWithUrl: (url: string) => void
}

interface IState {
  selectedStarterId?: string
  starterInvalid: boolean
  starterStatus?: string
  starterUrl: string
}

const starterSiteExamples = [
  {
    id: 'youtube',
    label: 'YouTube',
    detail: 'Video page',
    placeholder: 'Paste the exact YouTube watch page...',
    guidance: 'Use the real watch page once both browsers can open it.'
  },
  {
    id: 'animepahe',
    label: 'AnimePahe',
    detail: 'Episode page',
    placeholder: 'Paste the exact AnimePahe play page...',
    guidance: 'Pick the episode page after both sides can access it.'
  },
  {
    id: 'cineby',
    label: 'Cineby',
    detail: 'Movie page',
    placeholder: 'Paste the exact Cineby watch page...',
    guidance: 'Use the real movie or show page so rabbit-side lands with you.'
  },
  {
    id: 'miruro',
    label: 'Miruro',
    detail: 'Anime page',
    placeholder: 'Paste the exact Miruro watch page...',
    guidance: 'Use the real watch page you want both sides to open together.'
  },
  {
    id: 'direct',
    label: 'Direct MP4',
    detail: 'Clean media',
    placeholder: 'Paste a direct MP4, WebM, audio, or stream URL...',
    guidance: 'Use this when the URL already points at playable media.'
  }
] as const

class Home extends Component<IProps, IState> {
  private starterInputRef = React.createRef<HTMLInputElement>()

  constructor(props: IProps) {
    super(props)

    this.state = {
      starterInvalid: false,
      starterUrl: ''
    }
  }

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
    const quickPathCards = [
      {
        id: 'paste',
        label: 'Paste a site',
        detail: 'YouTube, anime pages, movie pages, or a direct MP4.'
      },
      {
        id: 'queue',
        label: 'Queue it once',
        detail: 'The host keeps the source of truth small and clear.'
      },
      {
        id: 'sync',
        label: 'Watch together',
        detail: 'Play, pause, seek, and speed changes stay obvious.'
      }
    ]
    const sourceLaneCards = [
      {
        id: 'websites',
        label: 'Website lane',
        title: 'Paste the page you already want to watch.',
        body:
          'Best for YouTube, anime sites, movie pages, and anything both browsers can open with the same login.'
      },
      {
        id: 'files',
        label: 'Local lane',
        title: 'Pick a local file when you both have the download.',
        body:
          'The room shares the title and playback commands while each side keeps private files on-device.'
      },
      {
        id: 'direct',
        label: 'Direct lane',
        title: 'Use clean media URLs when the source is simple.',
        body:
          'A direct MP4, WebM, or audio link goes straight into the queue without making the UI feel busy.'
      }
    ]
    const vibeDockItems = [
      'One invite link',
      'Two comfy seats',
      'Website-ready queue',
      'Host-led controls'
    ]
    const heroMetrics = [
      {
        id: 'invite',
        value: '1 link',
        label: 'private invite'
      },
      {
        id: 'seats',
        value: '2 seats',
        label: 'cat + rabbit'
      },
      {
        id: 'sync',
        value: 'Host-led',
        label: 'simple controls'
      }
    ]
    const connectionLabCards = [
      {
        id: 'latency',
        value: `<=${STREAMING_SITE_CONNECTION_P95_ROUND_TRIP_BUDGET_MS}ms`,
        label: 'mock P95 budget',
        detail: 'Default streaming-site trials keep the clean lane under the visible drift gate.'
      },
      {
        id: 'loss',
        value: '0 bytes',
        label: 'selected-lane loss',
        detail: 'Lossy lanes stay out of the happy path; retry lanes must recover before selection.'
      },
      {
        id: 'coverage',
        value: `${STREAMING_SITE_CONNECTION_FIXTURES.length} paths`,
        label: 'site fixtures',
        detail: 'YouTube, AnimePahe, Cineby, Miruro, and a generic watch page.'
      }
    ]
    const dateNightRail = [
      'Pick the exact site',
      'Share the room once',
      'Keep snacks first, tech second'
    ]
    const cozyPactCards = [
      {
        id: 'cat-side',
        label: 'Cat-side',
        title: 'Keeps the queue tidy',
        body: 'Paste the site, line up the next pick, and steer playback without clutter.'
      },
      {
        id: 'rabbit-side',
        label: 'Rabbit-side',
        title: 'Hops in from the invite',
        body: 'Join the exact room, see what is queued, and stay synced without guessing.'
      },
      {
        id: 'together',
        label: 'Together',
        title: 'One warm control booth',
        body: 'Websites, direct links, and local files live in the same simple watch flow.'
      }
    ]
    const commandCenterCards = [
      {
        id: 'source',
        label: 'Source',
        value: 'Exact watch page',
        detail: 'Paste the real page first so both browsers know what to open.'
      },
      {
        id: 'invite',
        label: 'Invite',
        value: 'One private hop',
        detail: 'Room code plus secret keeps the rabbit-side seat clear.'
      },
      {
        id: 'sync',
        label: 'Sync',
        value: 'Host presses play',
        detail: 'Cat-side controls keep play, pause, seek, and speed changes obvious.'
      }
    ]
    const launcherCards = [
      {
        id: 'source',
        step: '01',
        title: 'Paste the real page',
        detail: 'Start with the exact website, direct media URL, or local file name.'
      },
      {
        id: 'seat',
        step: '02',
        title: 'Save the rabbit seat',
        detail: 'Copy one private invite so the room never feels like a public lobby.'
      },
      {
        id: 'play',
        step: '03',
        title: 'Press play once',
        detail: 'Host-side playback keeps both browsers in the same cozy moment.'
      }
    ]
    const moodChips = ['soft lights', 'snacks close', 'site ready', 'no chaos']
    const selectedStarter = starterSiteExamples.find(
      example => example.id === this.state.selectedStarterId
    )
    const starterPreview = createRuntimeAddMediaSourcePreview(this.state.starterUrl)
    const starterDescriptionIds = [
      this.state.starterInvalid ? 'home_starter_error' : undefined,
      !this.state.starterInvalid && this.state.starterStatus ? 'home_starter_status' : undefined,
      starterPreview ? 'home_starter_preview' : undefined,
      'home_starter_hint'
    ]
      .filter((id): id is string => typeof id === 'string')
      .join(' ')

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

              <form
                id="home_watch_launcher"
                className={styles.watchLauncher}
                aria-label="Watch-night launcher preview"
                onSubmit={this.submitStarterUrl}
                noValidate
              >
                <div className={styles.launcherHeader}>
                  <span>Tonight starter</span>
                  <strong>paste once, start cozy</strong>
                </div>
                <label className={styles.starterLabel} htmlFor="home_starter_url">
                  Website, direct media link, or watch page
                </label>
                <div className={styles.launcherInput}>
                  <input
                    ref={this.starterInputRef}
                    id="home_starter_url"
                    type="url"
                    value={this.state.starterUrl}
                    placeholder={
                      selectedStarter
                        ? selectedStarter.placeholder
                        : 'youtube.com/watch or https://example.com/video.mp4'
                    }
                    autoComplete="url"
                    spellCheck={false}
                    aria-invalid={this.state.starterInvalid || undefined}
                    aria-describedby={starterDescriptionIds}
                    onChange={this.onStarterUrlChange}
                  />
                  <button id="home_start_with_url" type="submit">
                    Start with link
                  </button>
                </div>
                {this.state.starterInvalid && (
                  <p id="home_starter_error" className={styles.starterError} role="alert">
                    Paste a site like youtube.com/watch or a full http:// or https:// watch link.
                  </p>
                )}
                {this.state.starterStatus && !this.state.starterInvalid && (
                  <p id="home_starter_status" className={styles.starterStatus} role="status">
                    {this.state.starterStatus}
                  </p>
                )}
                {starterPreview ? (
                  <div
                    id="home_starter_preview"
                    className={styles.starterPreview}
                    data-starter-preview-kind={starterPreview.kind}
                    data-starter-preview-provider={starterPreview.provider || 'unknown'}
                    aria-live="polite"
                    aria-label="Starter source preview"
                  >
                    <span>{starterPreview.label}</span>
                    <strong>
                      {starterPreview.kind === 'invalid'
                        ? 'Needs cleanup'
                        : starterPreview.normalizedFromShorthand
                        ? 'HTTPS added'
                        : 'Ready to queue'}
                    </strong>
                    <p>{starterPreview.detail}</p>
                  </div>
                ) : null}
                <p id="home_starter_hint" className={styles.starterHint}>
                  Quick chips choose the lane; paste the real page when you are ready. Start with
                  link opens a room with the source already queued.
                </p>
                <div
                  id="home_starter_chips"
                  className={styles.starterChips}
                  aria-label="Starter examples"
                >
                  {starterSiteExamples.map(example => (
                    <button
                      key={example.id}
                      type="button"
                      data-starter-chip-state={
                        this.state.selectedStarterId === example.id ? 'selected' : 'idle'
                      }
                      aria-pressed={this.state.selectedStarterId === example.id}
                      onClick={() => this.selectStarterExample(example)}
                    >
                      <strong>{example.label}</strong>
                      <span>{example.detail}</span>
                    </button>
                  ))}
                </div>
                <div
                  id="home_first_action_path"
                  className={styles.launcherActions}
                  aria-label="First action path"
                >
                  <span>
                    <strong>01</strong>
                    Queue source
                  </span>
                  <span>
                    <strong>02</strong>
                    Copy invite
                  </span>
                  <span>
                    <strong>03</strong>
                    Start together
                  </span>
                </div>
                <div id="home_watch_nudge" className={styles.watchNudge}>
                  <strong>Best path</strong>
                  <span>Paste the exact page first, then send the invite when the room opens.</span>
                </div>
              </form>

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

              <div id="home_easy_path" className={styles.easyPath} aria-label="Easy watch path">
                {quickPathCards.map(card => (
                  <article key={card.id}>
                    <strong>{card.label}</strong>
                    <span>{card.detail}</span>
                  </article>
                ))}
              </div>

              <div className={styles.heroMetrics} aria-label="Room basics">
                {heroMetrics.map(metric => (
                  <article key={metric.id}>
                    <strong>{metric.value}</strong>
                    <span>{metric.label}</span>
                  </article>
                ))}
              </div>

              <div
                id="home_connection_lab"
                className={styles.connectionLab}
                aria-label="Connection lab highlights"
              >
                <div className={styles.connectionLabHeader}>
                  <span>Connection lab</span>
                  <strong>Mocked sites stay quick before you invite.</strong>
                </div>
                <div className={styles.connectionLabCards}>
                  {connectionLabCards.map(card => (
                    <article key={card.id}>
                      <strong>{card.value}</strong>
                      <span>{card.label}</span>
                      <p>{card.detail}</p>
                    </article>
                  ))}
                </div>
              </div>
            </div>

            <aside className={styles.companionCard} aria-label="Cozy room motif">
              <div className={styles.petPair}>
                <span className={`${styles.petOrb} ${styles.catOrb}`}>
                  <span className={styles.petFace}>
                    <i />
                    <i />
                    <b />
                  </span>
                </span>
                <span className={`${styles.petOrb} ${styles.rabbitOrb}`}>
                  <span className={styles.petFace}>
                    <i />
                    <i />
                    <b />
                  </span>
                </span>
                <span className={styles.syncBeam} />
              </div>
              <p className={styles.companionTitle}>One cat person. One bunny person.</p>
              <p className={styles.companionText}>
                A soft command center for deciding what to watch, adding it fast, and staying in
                sync without digging through menus.
              </p>
              <div id="home_room_preview" className={styles.roomPreview} aria-label="Room preview">
                <div className={styles.previewBar}>
                  <span>Now setting up</span>
                  <strong>Cozy room</strong>
                </div>
                <div className={styles.previewPeople}>
                  <span className={styles.catBadge}>Cat-side host</span>
                  <span className={styles.previewPulse}>sync</span>
                  <span className={styles.rabbitBadge}>Rabbit-side guest</span>
                </div>
                <div className={styles.previewQueue}>
                  <span>Website queued</span>
                  <span>Invite copied</span>
                  <span>Controls ready</span>
                </div>
              </div>
              <div
                id="home_command_center"
                className={styles.commandCenter}
                aria-label="Cozy command center"
              >
                <div className={styles.commandCenterHeader}>
                  <span>Tiny command center</span>
                  <strong>Ready in 3 taps</strong>
                </div>
                {commandCenterCards.map(card => (
                  <article key={card.id}>
                    <span>{card.label}</span>
                    <strong>{card.value}</strong>
                    <p>{card.detail}</p>
                  </article>
                ))}
              </div>
              <div className={styles.dateNightRail} aria-label="Date night rail">
                <strong>Tonight flow</strong>
                {dateNightRail.map(item => (
                  <span key={item}>{item}</span>
                ))}
              </div>
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
            id="home_source_board"
            className={styles.sourceBoard}
            aria-labelledby="home_source_board_title"
          >
            <div className={styles.sourceBoardIntro}>
              <p className={styles.kicker}>No-fuss watch setup</p>
              <h3 id="home_source_board_title">
                Websites first, files when they are yours, direct links when the URL is clean.
              </h3>
              <p>
                The UX should feel like a tiny shared booth: choose the source, share the invite,
                then let the cat-side host keep the room in sync for the rabbit-side guest.
              </p>
            </div>
            <div className={styles.sourceLanes} aria-label="Source lanes">
              {sourceLaneCards.map(card => (
                <article key={card.id} id={`home_source_${card.id}`} className={styles.sourceLane}>
                  <span>{card.label}</span>
                  <h4>{card.title}</h4>
                  <p>{card.body}</p>
                </article>
              ))}
            </div>
            <div id="home_vibe_dock" className={styles.vibeDock} aria-label="Room vibe dock">
              <strong>Tonight's happy path</strong>
              {vibeDockItems.map(item => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </section>

          <section
            id="home_cozy_pact"
            className={styles.cozyPact}
            aria-labelledby="home_cozy_pact_title"
          >
            <div className={styles.cozyPactIntro}>
              <p className={styles.kicker}>Couple-mode UX</p>
              <h3 id="home_cozy_pact_title">
                Cute enough to feel personal, clear enough to start watching fast.
              </h3>
            </div>
            {cozyPactCards.map(card => (
              <article key={card.id}>
                <span>{card.label}</span>
                <strong>{card.title}</strong>
                <p>{card.body}</p>
              </article>
            ))}
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

          <section
            id="home_pocket_planner"
            className={styles.pocketPlanner}
            aria-labelledby="home_pocket_planner_title"
          >
            <div className={styles.plannerIntro}>
              <p className={styles.kicker}>Pocket watch planner</p>
              <h3 id="home_pocket_planner_title">
                The whole date-night UX should read at a glance.
              </h3>
              <p>
                Honeystream stays cute, but the first action is never hidden: choose the source,
                protect the two seats, then watch with host-led controls.
              </p>
            </div>
            <div className={styles.launcherCards} aria-label="Three-step room launcher">
              {launcherCards.map(card => (
                <article key={card.id} data-launcher-card={card.id}>
                  <span>{card.step}</span>
                  <strong>{card.title}</strong>
                  <p>{card.detail}</p>
                </article>
              ))}
            </div>
            <div className={styles.moodChips} aria-label="Happy room mood">
              {moodChips.map(chip => (
                <span key={chip}>{chip}</span>
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
            <strong>AnimePahe</strong>
            <strong>Cineby</strong>
            <strong>Miruro</strong>
            <strong>direct MP4</strong>
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

  private onStarterUrlChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({
      starterInvalid: false,
      starterStatus: undefined,
      starterUrl: event.currentTarget.value
    })
  }

  private selectStarterExample = (example: typeof starterSiteExamples[number]) => {
    this.setState(
      {
        selectedStarterId: example.id,
        starterInvalid: false,
        starterStatus: `${example.label} lane selected. ${example.guidance}`,
        starterUrl: ''
      },
      () => {
        if (this.starterInputRef.current) {
          this.starterInputRef.current.focus()
        }
      }
    )
  }

  private submitStarterUrl = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const normalizedUrl = normalizeRuntimeAddMediaHttpUrl(this.state.starterUrl)
    if (!normalizedUrl) {
      this.setState({ starterInvalid: true, starterStatus: undefined })
      return
    }

    this.props.startWithUrl(normalizedUrl)
  }
}

export default withNamespaces()(Home)

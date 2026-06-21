import React, { DragEvent, FormEvent, useRef, useState } from 'react'
import cx from 'classnames'

import {
  createRuntimeAddMediaSourcePreview,
  normalizeRuntimeAddMediaHttpUrl
} from '../../ui/media-runtime/RuntimeAddMediaSourcePreview'
import styles from './HomeScreen.css'

interface Props {
  onRequestUrl: (url: string) => void
  onRequestLocalFile: (file: File) => void
}

const siteExamples = [
  {
    label: 'YouTube',
    placeholder: 'Paste the exact YouTube watch page...',
    helper: 'YouTube lane selected. Paste the real video page you both can open.'
  },
  {
    label: 'AnimePahe',
    placeholder: 'Paste the exact AnimePahe play page...',
    helper: 'AnimePahe lane selected. Use the real episode page after both sides can access it.'
  },
  {
    label: 'Cineby',
    placeholder: 'Paste the exact Cineby watch page...',
    helper:
      'Cineby lane selected. Paste the real movie or show page so both browsers land together.'
  },
  {
    label: 'Miruro',
    placeholder: 'Paste the exact Miruro watch page...',
    helper: 'Miruro lane selected. Use the real watch page you want rabbit-side to load.'
  },
  {
    label: 'Vimeo',
    placeholder: 'Paste the exact Vimeo page...',
    helper: 'Vimeo lane selected. Keep it generic and test the exact page in both browsers.'
  },
  {
    label: 'Twitch',
    placeholder: 'Paste the exact Twitch page...',
    helper: 'Twitch lane selected. Keep it generic and test the exact page in both browsers.'
  },
  {
    label: 'Netflix-style pages',
    placeholder: 'Paste the exact watch page...',
    helper:
      'Generic site lane selected. Use the exact page both signed-in browsers can open locally.'
  },
  {
    label: 'Hulu',
    placeholder: 'Paste the exact Hulu watch page...',
    helper: 'Hulu lane selected. Keep it generic and test the exact page in both browsers.'
  },
  {
    label: 'Prime Video',
    placeholder: 'Paste the exact Prime Video page...',
    helper: 'Prime Video lane selected. Keep it generic and test the exact page in both browsers.'
  },
  {
    label: 'Tubi',
    placeholder: 'Paste the exact Tubi movie page...',
    helper: 'Tubi lane selected. Keep it generic and test the exact page in both browsers.'
  },
  {
    label: 'Dailymotion',
    placeholder: 'Paste the exact Dailymotion video page...',
    helper: 'Dailymotion lane selected. Keep it generic and test the exact page in both browsers.'
  },
  {
    label: 'Plex-style pages',
    placeholder: 'Paste the exact Plex watch page...',
    helper: 'Plex lane selected. Keep it generic and test the exact page in both browsers.'
  },
  {
    label: 'Disney+',
    placeholder: 'Paste the exact Disney+ movie page...',
    helper: 'Disney+ lane selected. Keep it generic and test the exact page in both browsers.'
  },
  {
    label: 'Crunchyroll',
    placeholder: 'Paste the exact Crunchyroll episode page...',
    helper: 'Crunchyroll lane selected. Keep it generic and test the exact page in both browsers.'
  },
  {
    label: 'Apple TV+',
    placeholder: 'Paste the exact Apple TV+ movie page...',
    helper: 'Apple TV+ lane selected. Keep it generic and test the exact page in both browsers.'
  },
  {
    label: 'Peacock',
    placeholder: 'Paste the exact Peacock watch page...',
    helper: 'Peacock lane selected. Keep it generic and test the exact page in both browsers.'
  }
]

const addSteps = [
  'Paste a website both browsers can open',
  'Queue a local file when you both have it',
  'Press play once and keep the room synced'
]

const sourceTips = [
  {
    label: 'Website tab',
    detail: 'Best when both browsers can sign in and open the same page.'
  },
  {
    label: 'Local copy',
    detail: 'Best for downloaded files you both already have.'
  },
  {
    label: 'Direct media',
    detail: 'Best when the URL ends in a playable video or audio file.'
  }
]

const readinessItems = [
  'Same page on both browsers',
  'One host-owned queue',
  'Guest sees what changed',
  'Controls stay obvious'
]
const sourceConfidenceItems = [
  'Full watch-page URLs work best',
  'Local files stay on each device',
  'Direct media links skip extra clutter'
]
const trustBadges = ['Known-site chips', 'Zero media bytes shared', 'Tiny host-led commands']
const prepDeckCards = [
  {
    label: 'Exact page',
    detail: 'Paste the page you would open yourself, not a search result.'
  },
  {
    label: 'Invite next',
    detail: 'Once the source is queued, send the room link before pressing play.'
  },
  {
    label: 'Controls only',
    detail: 'Honeystream syncs play, pause, seek, speed, and next.'
  }
]
const decisionFlowCards = [
  {
    label: 'Website opens for both',
    detail: 'Paste the exact page and let each browser load it locally.'
  },
  {
    label: 'You both downloaded it',
    detail: 'Choose the local file lane and keep the video private.'
  },
  {
    label: 'URL is already media',
    detail: 'Drop the direct MP4, WebM, audio, or stream link.'
  }
]

export const HomeScreen = (props: Props) => {
  const urlInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [localDropActive, setLocalDropActive] = useState(false)
  const [urlInputValue, setUrlInputValue] = useState('')
  const [urlInputInvalid, setUrlInputInvalid] = useState(false)
  const [selectedSiteLabel, setSelectedSiteLabel] = useState<string | undefined>()
  const selectedSite = siteExamples.find(example => example.label === selectedSiteLabel)
  const sourcePreview = createRuntimeAddMediaSourcePreview(urlInputValue)

  const queueLocalFile = (file: File | undefined) => {
    if (file) {
      props.onRequestLocalFile(file)
    }
  }

  const requestLocalFile = () => {
    const file =
      fileInputRef.current && fileInputRef.current.files ? fileInputRef.current.files[0] : undefined
    queueLocalFile(file)
  }

  const activateLocalDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault()
    setLocalDropActive(true)
  }

  const deactivateLocalDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault()
    setLocalDropActive(false)
  }

  const dropLocalFile = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault()
    setLocalDropActive(false)
    queueLocalFile(event.dataTransfer.files && event.dataTransfer.files[0])
  }

  const requestUrl = () => {
    const urlInput = urlInputRef.current
    if (!urlInput) {
      return
    }

    const url = urlInputValue.trim()
    if (!url) {
      setUrlInputInvalid(true)
      urlInput.focus()
      return
    }

    const normalizedUrl = normalizeRuntimeAddMediaHttpUrl(url)
    if (!normalizedUrl) {
      setUrlInputInvalid(true)
      urlInput.focus()
      return
    }

    props.onRequestUrl(normalizedUrl)
  }

  const submitUrl = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    requestUrl()
  }

  return (
    <div className={styles.container}>
      <header className={cx(styles.column, styles.hero)}>
        <p className={styles.kicker}>Website nights without the scramble</p>
        <h1>Paste a site, pick a file, and keep the two-person room flowing.</h1>
        <p>
          Honeystream shares compact playback commands while each side loads the actual media
          locally, so cat-side and rabbit-side stay focused on the watch.
        </p>
        <div id="media_easy_path" className={styles.mediaPath} aria-label="Easy media path">
          {addSteps.map((step, index) => (
            <span key={step}>
              <strong>{index + 1}</strong>
              {step}
            </span>
          ))}
        </div>
        <div
          id="media_pair_preview"
          className={styles.pairPreview}
          aria-label="Two-person media flow"
        >
          <span className={styles.catCard}>
            <strong>Cat-side</strong>
            Picks the source
          </span>
          <span className={styles.syncBadge}>Tiny sync commands</span>
          <span className={styles.rabbitCard}>
            <strong>Rabbit-side</strong>
            Loads it locally
          </span>
        </div>
        <div className={styles.sourceTips} aria-label="Source picking tips">
          {sourceTips.map(tip => (
            <article key={tip.label}>
              <strong>{tip.label}</strong>
              <span>{tip.detail}</span>
            </article>
          ))}
        </div>
        <div id="media_room_dock" className={styles.roomDock} aria-label="Room readiness">
          <strong>Ready when</strong>
          {readinessItems.map(item => (
            <span key={item}>{item}</span>
          ))}
        </div>
        <div className={styles.confidenceRail} aria-label="Source confidence tips">
          {sourceConfidenceItems.map(item => (
            <span key={item}>{item}</span>
          ))}
        </div>
        <div
          id="media_decision_flow"
          className={styles.decisionFlow}
          aria-label="Media source decision flow"
        >
          {decisionFlowCards.map(card => (
            <article key={card.label}>
              <strong>{card.label}</strong>
              <span>{card.detail}</span>
            </article>
          ))}
        </div>
      </header>
      <main className={styles.main}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.cardTag}>Quick add</span>
            <h2>Choose the easiest source for tonight.</h2>
            <p>
              Websites first, local files when you both have copies, direct URLs when it is clean.
            </p>
          </div>
          <div
            className={styles.localFile}
            data-local-file-drop={localDropActive ? 'active' : 'idle'}
            onDragEnter={activateLocalDrop}
            onDragOver={activateLocalDrop}
            onDragLeave={deactivateLocalDrop}
            onDrop={dropLocalFile}
          >
            <span className={styles.cardTag}>Cat-side stash</span>
            <h2>Downloaded video</h2>
            <p>Best for private watch sessions: both people keep the same file locally.</p>
            <span className={styles.dropCue}>Drop a matching local copy here</span>
            <button
              className={cx(styles.button, styles.primaryButton)}
              type="button"
              onClick={() => {
                if (fileInputRef.current) fileInputRef.current.click()
              }}
            >
              Choose video file
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*,audio/*"
              className={styles.fileInput}
              onChange={requestLocalFile}
            />
          </div>
          <div className={styles.divider}>or</div>
          <div className={styles.directLink}>
            <span className={styles.cardTag}>Rabbit hop</span>
            <h2>Website or direct link</h2>
            <p>Paste a video page or media URL that both browsers can access.</p>
            <div className={styles.siteChips} aria-label="Site examples">
              {siteExamples.map(example => (
                <button
                  key={example.label}
                  type="button"
                  className={styles.siteChip}
                  aria-pressed={selectedSiteLabel === example.label}
                  onClick={() => {
                    setSelectedSiteLabel(example.label)
                    setUrlInputValue('')
                    setUrlInputInvalid(false)
                    if (urlInputRef.current) {
                      urlInputRef.current.focus()
                    }
                  }}
                >
                  {example.label}
                </button>
              ))}
            </div>
            <div className={styles.trustBadges} aria-label="Streaming safety notes">
              {trustBadges.map(badge => (
                <span key={badge}>{badge}</span>
              ))}
            </div>
          </div>
          <div id="media_source_helper" className={styles.sourceHelper}>
            <strong>URL Safety Results</strong>
            <span>
              Best UX: paste the exact watch page, test it once in both browsers, then press play
              from host-side. You can skip https:// on common sites.
            </span>
          </div>
          <div id="media_prep_deck" className={styles.prepDeck} aria-label="Media prep deck">
            {prepDeckCards.map(card => (
              <article key={card.label}>
                <strong>{card.label}</strong>
                <span>{card.detail}</span>
              </article>
            ))}
          </div>
          <form className={styles.inputContainer} onSubmit={submitUrl} noValidate>
            <input
              ref={urlInputRef}
              id="urlinput"
              type="url"
              className={cx(styles.urlInput, {
                [styles.invalidInput]: urlInputInvalid
              })}
              placeholder={
                selectedSite
                  ? selectedSite.placeholder
                  : 'youtube.com/watch or https://example.com/video.mp4'
              }
              value={urlInputValue}
              autoComplete="url"
              aria-invalid={urlInputInvalid || undefined}
              spellCheck={false}
              onChange={event => {
                setUrlInputValue(event.currentTarget.value)
                setUrlInputInvalid(false)
              }}
            />
            <button id="addbtn" className={cx(styles.button, styles.uppercase)} type="submit">
              Add to room
            </button>
          </form>
          {sourcePreview && (
            <div
              id="media_source_preview"
              className={styles.sourcePreview}
              data-source-preview-kind={sourcePreview.kind}
              data-source-preview-provider={sourcePreview.provider || 'unknown'}
              aria-live="polite"
              aria-label="Media source preview"
            >
              <strong>{sourcePreview.label}</strong>
              <span>{sourcePreview.detail}</span>
            </div>
          )}
          {urlInputInvalid && (
            <p className={styles.helpLine}>
              Paste a site like youtube.com/watch or a full http:// or https:// watch link first.
            </p>
          )}
          {!urlInputInvalid && selectedSite && (
            <p className={styles.helpLine}>{selectedSite.helper}</p>
          )}
        </section>
      </main>
    </div>
  )
}

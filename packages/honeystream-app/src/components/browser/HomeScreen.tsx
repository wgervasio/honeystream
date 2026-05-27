import React, { FormEvent, useRef, useState } from 'react'
import cx from 'classnames'

import styles from './HomeScreen.css'

interface Props {
  onRequestUrl: (url: string) => void
  onRequestLocalFile: (file: File) => void
}

const siteExamples = [
  { label: 'YouTube', url: 'https://www.youtube.com/watch?v=honeystream-demo' },
  { label: 'AnimePahe', url: 'https://animepahe.ru/play/example' },
  { label: 'Cineby', url: 'https://cineby.app/movie/example' },
  { label: 'Miruro', url: 'https://www.miruro.tv/watch/example' }
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

const isHttpUrl = (value: string): boolean => {
  try {
    const parsedUrl = new URL(value)
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:'
  } catch {
    return false
  }
}

export const HomeScreen = (props: Props) => {
  const urlInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [urlInputInvalid, setUrlInputInvalid] = useState(false)

  const requestLocalFile = () => {
    const file = fileInputRef.current && fileInputRef.current.files && fileInputRef.current.files[0]
    if (file) {
      props.onRequestLocalFile(file)
    }
  }

  const requestUrl = () => {
    const urlInput = urlInputRef.current
    if (!urlInput) {
      return
    }

    const url = urlInput.value.trim()
    if (!url) {
      setUrlInputInvalid(true)
      urlInput.focus()
      return
    }

    if (!isHttpUrl(url)) {
      setUrlInputInvalid(true)
      urlInput.focus()
      return
    }

    props.onRequestUrl(url)
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
          <div className={styles.localFile}>
            <span className={styles.cardTag}>Cat-side stash</span>
            <h2>Downloaded video</h2>
            <p>Best for private watch sessions: both people keep the same file locally.</p>
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
                  onClick={() => {
                    if (urlInputRef.current) {
                      urlInputRef.current.value = example.url
                      urlInputRef.current.focus()
                    }
                  }}
                >
                  {example.label}
                </button>
              ))}
            </div>
          </div>
          <div id="media_source_helper" className={styles.sourceHelper}>
            <span>
              Best UX: paste the exact watch page, test it once, then press play from host-side.
            </span>
          </div>
          <form className={styles.inputContainer} onSubmit={submitUrl} noValidate>
            <input
              ref={urlInputRef}
              id="urlinput"
              type="url"
              className={cx(styles.urlInput, {
                [styles.invalidInput]: urlInputInvalid
              })}
              placeholder="https://example.com/watch-or-video.mp4"
              autoComplete="url"
              aria-invalid={urlInputInvalid || undefined}
              spellCheck={false}
              onChange={() => setUrlInputInvalid(false)}
            />
            <button id="addbtn" className={cx(styles.button, styles.uppercase)} type="submit">
              Add to room
            </button>
          </form>
          {urlInputInvalid && (
            <p className={styles.helpLine}>Paste a full http:// or https:// watch link first.</p>
          )}
        </section>
      </main>
    </div>
  )
}

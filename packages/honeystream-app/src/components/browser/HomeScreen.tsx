import React, { useRef } from 'react'
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

export const HomeScreen = (props: Props) => {
  const urlInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const requestLocalFile = () => {
    const file = fileInputRef.current && fileInputRef.current.files && fileInputRef.current.files[0]
    if (file) {
      props.onRequestLocalFile(file)
    }
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
          <div className={styles.inputContainer}>
            <input
              ref={urlInputRef}
              id="urlinput"
              placeholder="https://example.com/watch-or-video.mp4"
              autoComplete="url"
              spellCheck={false}
            />
            <button
              id="addbtn"
              className={cx(styles.button, styles.uppercase)}
              onClick={() => {
                if (urlInputRef.current) {
                  props.onRequestUrl(urlInputRef.current.value)
                }
              }}
            >
              Add to Session
            </button>
          </div>
        </section>
      </main>
    </div>
  )
}

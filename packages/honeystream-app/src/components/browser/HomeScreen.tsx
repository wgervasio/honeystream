import React, { useRef } from 'react'
import cx from 'classnames'

import styles from './HomeScreen.css'

interface Props {
  onRequestUrl: (url: string) => void
  onRequestLocalFile: (file: File) => void
}

const siteExamples = [
  { label: 'YouTube', url: 'https://youtube.com' },
  { label: 'Anime page', url: 'https://example.com/anime-watch' },
  { label: 'Movie page', url: 'https://example.com/movie-watch' },
  { label: 'Direct video', url: 'https://example.com/video.mp4' }
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
        <p className={styles.kicker}>Add the next cozy thing without wasting shared bytes</p>
        <h1>Pick a local file or paste a site, then keep the room flowing.</h1>
        <p>
          Honeystream sends compact playback commands while each side loads the actual media
          locally.
        </p>
      </header>
      <main className={styles.main}>
        <section className={styles.panel}>
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

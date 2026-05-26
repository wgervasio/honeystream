import React, { useRef } from 'react'
import cx from 'classnames'

import styles from './HomeScreen.css'

interface Props {
  onRequestUrl: (url: string) => void
  onRequestLocalFile: (file: File) => void
}

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
        <h1>Watch videos in sync.</h1>
        <p>
          Start a session, send the invite link, then add a local file, website video, or direct
          video URL.
        </p>
      </header>
      <main className={styles.main}>
        <section className={styles.panel}>
          <div className={styles.localFile}>
            <h2>Downloaded video</h2>
            <p>Best for private watch sessions: both people keep the file locally.</p>
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
            <h2>Website or direct link</h2>
            <p>Paste a video page or media URL that both browsers can access.</p>
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

import React, { Component } from 'react'
import { connect } from 'react-redux'
import { throttle } from 'lodash-es'
import cx from 'classnames'

import { addChat } from 'lobby/actions/chat'
import {
  server_requestPlayPause,
  server_requestSeek,
  server_requestSetPlaybackRate,
  updateMedia
} from 'lobby/actions/mediaPlayer'
import { IMediaPlayerState, PlaybackState } from 'lobby/reducers/mediaPlayer'
import {
  getPlaybackTime2,
  hasPlaybackPermissions
} from 'lobby/reducers/mediaPlayer.helpers'
import { isHost } from 'lobby/reducers/users.helpers'
import { getLocalFileMetadata, getLocalFileUrl, registerLocalFile } from 'media/localFile'
import { IAppState } from 'reducers'
import { IReactReduxProps } from 'types/redux-thunk'

import styles from './VideoPlayer.css'

interface OwnProps {
  className?: string
}

interface ConnectedProps extends IMediaPlayerState {
  mute: boolean
  volume: number
  host: boolean
  canControl: boolean
}

interface State {
  objectUrl?: string
  objectUrlKey?: string
  error?: string
}

type Props = OwnProps & ConnectedProps & IReactReduxProps

class _LocalVideoPlayer extends Component<Props, State> {
  state: State = {}

  private video: HTMLVideoElement | null = null
  private ignoreEventsUntil = 0
  private reportedPlayError = false

  componentDidMount() {
    this.refreshObjectUrl()
  }

  componentDidUpdate(prevProps: Props) {
    const prevLocalFile = getLocalFileMetadata(prevProps.current)
    const localFile = getLocalFileMetadata(this.props.current)

    if (!prevLocalFile || !localFile || prevLocalFile.key !== localFile.key) {
      this.refreshObjectUrl()
      return
    }

    const shouldSync =
      prevProps.playback !== this.props.playback ||
      prevProps.startTime !== this.props.startTime ||
      prevProps.pauseTime !== this.props.pauseTime ||
      prevProps.playbackRate !== this.props.playbackRate ||
      prevProps.volume !== this.props.volume ||
      prevProps.mute !== this.props.mute

    if (shouldSync) {
      this.syncVideo()
    }
  }

  componentWillUnmount() {
    this.requestSeek.cancel()
    this.requestPlaybackRate.cancel()
  }

  private refreshObjectUrl() {
    const metadata = getLocalFileMetadata(this.props.current)
    const objectUrl = metadata ? getLocalFileUrl(metadata) : undefined
    const objectUrlKey = metadata && objectUrl ? metadata.key : undefined

    if (objectUrl !== this.state.objectUrl || objectUrlKey !== this.state.objectUrlKey) {
      this.setState({ objectUrl, objectUrlKey, error: undefined }, () => this.syncVideo())
    }
  }

  private setIgnoredMediaEvents(duration = 500) {
    this.ignoreEventsUntil = Math.max(this.ignoreEventsUntil, Date.now() + duration)
  }

  private get shouldIgnoreMediaEvents() {
    return Date.now() < this.ignoreEventsUntil
  }

  private syncVideo() {
    if (!this.video || !this.state.objectUrl) return

    this.setIgnoredMediaEvents()

    this.video.muted = this.props.mute
    this.video.volume = this.props.mute ? 0 : this.props.volume

    if (this.video.playbackRate !== this.props.playbackRate) {
      this.video.playbackRate = this.props.playbackRate
    }

    const time = getPlaybackTime2(this.props)
    if (time >= 0) {
      const targetTime = time / 1000
      const duration = this.video.duration
      const canSeek =
        Number.isFinite(targetTime) &&
        (!Number.isFinite(duration) || targetTime <= Math.max(duration, 0) + 1)

      if (canSeek && Math.abs(this.video.currentTime - targetTime) > 0.75) {
        this.video.currentTime = Math.max(targetTime, 0)
      }
    }

    if (this.props.playback === PlaybackState.Playing && this.video.paused) {
      const playPromise = this.video.play()
      if (playPromise) {
        playPromise.catch(this.onPlayRejected)
      }
    } else if (this.props.playback === PlaybackState.Paused && !this.video.paused) {
      this.video.pause()
    }
  }

  private onPlayRejected = (error: Error) => {
    const message = `Autoplay was blocked. Click the video once to continue synced playback.`
    this.setState({ error: message })

    if (!this.reportedPlayError) {
      this.reportedPlayError = true
      this.props.dispatch(addChat({ content: message, timestamp: Date.now() }))
    }

    console.warn(error)
  }

  private onLoadedMetadata = () => {
    const media = this.props.current
    if (!this.video || !media || !this.props.host) {
      this.syncVideo()
      return
    }

    const duration = this.video.duration
    if (Number.isFinite(duration) && duration > 0) {
      const durationMs = Math.round(duration * 1000)
      const previousDuration = media.duration || 0

      if (Math.abs(previousDuration - durationMs) > 1000) {
        this.props.dispatch(updateMedia({ duration: durationMs }))
      }
    }

    this.syncVideo()
  }

  private onPlay = () => {
    if (this.shouldIgnoreMediaEvents) return
    if (!this.props.canControl) {
      this.syncVideo()
      return
    }
    if (this.props.playback === PlaybackState.Paused) {
      this.props.dispatch(server_requestPlayPause())
    }
  }

  private onPause = () => {
    if (this.shouldIgnoreMediaEvents) return
    if (!this.props.canControl) {
      this.syncVideo()
      return
    }
    if (this.props.playback === PlaybackState.Playing) {
      this.props.dispatch(server_requestPlayPause())
    }
  }

  private onSeeked = () => {
    if (this.shouldIgnoreMediaEvents || !this.video) return
    if (!this.props.canControl) {
      this.syncVideo()
      return
    }
    this.requestSeek(this.video.currentTime * 1000)
  }

  private onRateChange = () => {
    if (this.shouldIgnoreMediaEvents || !this.video) return
    if (!this.props.canControl) {
      this.syncVideo()
      return
    }
    this.requestPlaybackRate(this.video.playbackRate)
  }

  private requestSeek = throttle(
    (time: number) => {
      this.props.dispatch(server_requestSeek(time))
    },
    500,
    { leading: true, trailing: true }
  )

  private requestPlaybackRate = throttle(
    (playbackRate: number) => {
      this.props.dispatch(server_requestSetPlaybackRate(playbackRate))
    },
    500,
    { leading: true, trailing: true }
  )

  private onSelectMatchingFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files && event.currentTarget.files[0]
    const metadata = getLocalFileMetadata(this.props.current)
    if (!file || !metadata) return

    try {
      registerLocalFile(file, metadata.key)
      this.refreshObjectUrl()
    } catch (e) {
      this.setState({ error: e.message })
    }

    event.currentTarget.value = ''
  }

  render(): JSX.Element | null {
    const metadata = getLocalFileMetadata(this.props.current)
    if (!metadata) return null

    if (!this.state.objectUrl) {
      return (
        <div className={cx(styles.localFilePrompt, this.props.className)}>
          <div className={styles.localFileCard}>
            <h2>Choose your downloaded video</h2>
            <p className={styles.localFileTitle}>{metadata.name}</p>
            <p>
              Each person picks their own local copy. The session link still syncs play, pause,
              seeking, and playback speed.
            </p>
            <label className={styles.localFileButton}>
              Choose video
              <input type="file" accept="video/*,audio/*" onChange={this.onSelectMatchingFile} />
            </label>
            {this.state.error && <p className={styles.localFileError}>{this.state.error}</p>}
          </div>
        </div>
      )
    }

    return (
      <div className={cx(styles.localVideoContainer, this.props.className)}>
        <video
          ref={video => {
            this.video = video
          }}
          className={styles.localVideo}
          src={this.state.objectUrl}
          controls
          playsInline
          preload="metadata"
          onLoadedMetadata={this.onLoadedMetadata}
          onPlay={this.onPlay}
          onPause={this.onPause}
          onSeeked={this.onSeeked}
          onRateChange={this.onRateChange}
        />
        {this.state.error && <p className={styles.localVideoError}>{this.state.error}</p>}
      </div>
    )
  }
}

export const LocalVideoPlayer = connect(
  (state: IAppState): ConnectedProps => ({
    ...state.mediaPlayer,
    mute: state.settings.mute,
    volume: state.settings.volume,
    host: isHost(state),
    canControl: hasPlaybackPermissions(state)
  })
)(_LocalVideoPlayer)

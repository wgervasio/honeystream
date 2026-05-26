import React, { Component, ErrorInfo } from 'react'
import styles from './ErrorBoundary.css'
import { HighlightButton } from './common/button'
import { copyToClipboard } from 'utils/clipboard'
import { VERSION } from 'constants/app'

interface Props {}

interface State {
  error?: Error
  errorInfo?: ErrorInfo
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {}

  private get errorText() {
    const { error, errorInfo } = this.state
    return `Version: ${VERSION}
URL: ${location.href}
User-Agent: ${navigator.userAgent}

Stack trace:
${error ? error.stack : ''}

Component stack:
${errorInfo ? errorInfo.componentStack : ''}
`
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ error, errorInfo })
    try {
      ga('send', 'exception', {
        exDescription: error.message,
        exFatal: true
      })
    } catch {}
  }

  render() {
    const { error } = this.state

    if (error) {
      return (
        <div className={styles.container}>
          <div>
            <p>😱 An error occured in Honeystream.</p>
            <p>
              Reload the app to continue. If the problem persists, copy the error details for
              debugging.
            </p>
            <pre>{this.errorText}</pre>
            <p>
              <HighlightButton
                icon="refresh-cw"
                size="medium"
                highlight
                onClick={() => location.reload(true)}
              >
                Reload
              </HighlightButton>
              &nbsp;
              <HighlightButton
                icon="clipboard"
                size="medium"
                onClick={() => {
                  copyToClipboard(this.errorText)
                }}
              >
                Copy error
              </HighlightButton>
            </p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

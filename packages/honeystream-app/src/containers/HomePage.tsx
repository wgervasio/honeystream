import React, { Component } from 'react'
import Home from 'components/Home'
import { RouteComponentProps } from 'react-router'
import { connect } from 'react-redux'
import { IAppState } from '../reducers/index'
import { IReactReduxProps } from '../types/redux-thunk'
import { SHOW_INSTALL_PROMPT } from '../middleware/pwa'
import { Dispatch } from 'redux'
import { replace } from 'connected-react-router'
import { localUserId } from 'network'

interface IProps extends RouteComponentProps<any> {}

interface IConnectedProps {
  pwaInstallReady?: boolean
  search?: string
}

interface DispatchProps {
  showInstallPrompt(): void
  startWithUrl(url: string): void
}

function mapStateToProps(state: IAppState): IConnectedProps {
  const { location } = state.router
  return {
    pwaInstallReady: state.ui.pwaInstallReady,
    search: location ? location.search : ''
  }
}

const mapDispatchToProps = (dispatch: Dispatch): DispatchProps => ({
  showInstallPrompt() {
    dispatch({ type: SHOW_INSTALL_PROMPT })
  },
  startWithUrl(url: string) {
    dispatch(
      replace({
        pathname: `/join/${localUserId()}`,
        search: `?url=${encodeURIComponent(url)}`
      })
    )
  }
})

type PrivateProps = IProps & IConnectedProps & DispatchProps & IReactReduxProps

class _HomePage extends Component<PrivateProps> {
  componentDidMount() {
    const params = new URLSearchParams(this.props.search)
    const url = params.get('url')

    if (url) {
      this.props.startWithUrl(url)
    }
  }

  render() {
    return (
      <Home
        installable={!!this.props.pwaInstallReady}
        install={this.props.showInstallPrompt}
        startWithUrl={this.props.startWithUrl}
      />
    )
  }
}

export const HomePage = connect(
  mapStateToProps,
  mapDispatchToProps
)(_HomePage)

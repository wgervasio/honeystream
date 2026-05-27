import React from 'react'
import { Switch, Route, RouteProps } from 'react-router'

import App from './containers/App'
import { HomePage } from './containers/HomePage'
import { RuntimeSessionShellPage } from './containers/RuntimeSessionShellPage'
import { SessionJoinPage } from './containers/SessionJoinPage'
import { SettingsPage } from './containers/SettingsPage'
import WelcomePage from './containers/WelcomePage'

export const getLobbyRouteComponent = (): React.ComponentType<any> =>
  RuntimeSessionShellPage

export default () => (
  <App>
    <Switch>
      <WelcomeRoute exact path="/" component={HomePage} />
      <WelcomeRoute exact path="/join" component={SessionJoinPage} />
      <WelcomeRoute path="/join/:lobbyId" component={getLobbyRouteComponent()} />
      <WelcomeRoute path="/settings" component={SettingsPage} />
    </Switch>
  </App>
)

interface PrivateRouteProps extends RouteProps {
  component: React.ComponentType<any>
}

// prettier-ignore
const WelcomeRoute = ({ component: Component, ...rest }: PrivateRouteProps) => (
  <Route
    {...rest}
    render={props =>
      localStorage.getItem('welcomed') ? <Component {...props} /> : <WelcomePage {...props} />
    }
  />
)

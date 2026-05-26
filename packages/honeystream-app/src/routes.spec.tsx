import React from 'react'

type RouteComponent = React.ComponentType<unknown>

interface RoutesModule {
  getLobbyRouteComponent(): RouteComponent
}

function resolveLobbyRouteComponentName(featureEnabled: boolean): string {
  FEATURE_RUNTIME_SESSION_SHELL = featureEnabled
  let componentName = ''

  jest.isolateModules(() => {
    function App(props: { readonly children?: React.ReactNode }) {
      return <>{props.children}</>
    }
    function HomePage() {
      return null
    }
    function SessionJoinPage() {
      return null
    }
    function SettingsPage() {
      return null
    }
    function WelcomePage() {
      return null
    }
    function LegacyLobbyPage() {
      return null
    }
    function RuntimeSessionShellPage() {
      return null
    }

    jest.doMock('./containers/App', () => ({
      __esModule: true,
      default: App
    }))
    jest.doMock('./containers/HomePage', () => ({ HomePage }))
    jest.doMock('./containers/SessionJoinPage', () => ({ SessionJoinPage }))
    jest.doMock('./containers/SettingsPage', () => ({ SettingsPage }))
    jest.doMock('./containers/WelcomePage', () => ({
      __esModule: true,
      default: WelcomePage
    }))
    jest.doMock('./containers/LobbyPage', () => ({ LobbyPage: LegacyLobbyPage }))
    jest.doMock('./containers/RuntimeSessionShellPage', () => ({
      RuntimeSessionShellPage
    }))

    const routes = require('./routes') as RoutesModule
    componentName = routes.getLobbyRouteComponent().name
  })

  return componentName
}

describe('routes feature flag selection', () => {
  afterEach(() => {
    jest.resetModules()
  })

  it('uses legacy lobby route when runtime session shell flag is disabled', () => {
    expect(resolveLobbyRouteComponentName(false)).toBe('LegacyLobbyPage')
  })

  it('uses runtime session shell route when flag is enabled', () => {
    expect(resolveLobbyRouteComponentName(true)).toBe('RuntimeSessionShellPage')
  })
})

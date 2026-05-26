import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { RouteComponentProps } from 'react-router'
import { RuntimeSessionShellPage } from './RuntimeSessionShellPage'

interface RouteParams {
  lobbyId: string
}

function createRouteProps(lobbyId: string): RouteComponentProps<RouteParams> {
  return {
    history: {} as RouteComponentProps<RouteParams>['history'],
    location: {} as RouteComponentProps<RouteParams>['location'],
    match: {
      isExact: true,
      params: { lobbyId },
      path: '/join/:lobbyId',
      url: `/join/${lobbyId}`
    },
    staticContext: undefined
  }
}

describe('RuntimeSessionShellPage', () => {
  it('renders runtime session shell details for the lobby route', () => {
    const html = renderToStaticMarkup(
      <RuntimeSessionShellPage {...createRouteProps('room-123')} />
    )

    expect(html).toContain('Runtime session shell')
    expect(html).toContain('Lobby: room-123')
    expect(html).toContain('Joining')
    expect(html).toContain('Host: Host')
    expect(html).toContain('Guest: Waiting for guest')
  })
})

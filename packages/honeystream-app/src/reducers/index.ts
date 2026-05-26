import { combineReducers } from 'redux'
import { connectRouter, RouterState } from 'connected-react-router'

import { settings, ISettingsState } from './settings'
import { ui, IUIState } from './ui'

import { ILobbyNetState, lobbyReducers } from '../lobby/reducers'
import { ReplicatedState } from 'network/types'
import { mediaPlayerReplicatedState } from '../lobby/reducers/mediaPlayer'
import { usersReplicatedState } from '../lobby/reducers/users'
import { sessionReplicatedState } from 'lobby/reducers/session'
import { History } from 'history'

export interface IAppState extends ILobbyNetState {
  settings: ISettingsState
  ui: IUIState
  router: RouterState
}

export const AppReplicatedState: ReplicatedState<IAppState> = {
  mediaPlayer: mediaPlayerReplicatedState,
  session: sessionReplicatedState,
  users: usersReplicatedState
}

export const createReducer = (history: History) => {
  const rootReducer = combineReducers<IAppState>({
    router: connectRouter(history),
    ...lobbyReducers,
    settings,
    ui
  })

  return rootReducer
}

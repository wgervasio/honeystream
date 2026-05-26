import { AnyAction } from 'redux'
import { ThunkAction, ThunkDispatch } from 'redux-thunk'
import { IAppState } from 'reducers'

export type AppThunkAction = ThunkAction<void, IAppState, any, AnyAction>

type HoneystreamThunkDispatch = ThunkDispatch<IAppState, any, AnyAction>

export interface IReactReduxProps {
  dispatch: HoneystreamThunkDispatch
}

interface MiddlewareAPI<D = HoneystreamThunkDispatch, S = IAppState> {
  dispatch: D
  getState(): S
}

export interface HoneystreamMiddleware<
  DispatchExt = {},
  S = IAppState,
  D = HoneystreamThunkDispatch
> {
  (api: MiddlewareAPI<D, S>): (next: HoneystreamThunkDispatch) => (action: any) => any
}

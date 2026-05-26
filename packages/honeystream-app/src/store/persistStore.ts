import { IAppState } from '../reducers'
import storage from 'redux-persist/lib/storage'
import autoMergeLevel2 from 'redux-persist/es/stateReconciler/autoMergeLevel2'
import { createMigrate, PersistedState } from 'redux-persist'
import {
  normalizeMinimalSettings,
  toLegacyMinimalSettingsPatch
} from 'domain/settings/minimalSettings'

const whitelist: (keyof IAppState)[] = ['mediaPlayer', 'settings']

const migrations: { [version: number]: (state: any) => any } = {
  2: function removeDefaultAvatarMigration(state) {
    const avatar = state.settings && state.settings.avatar
    return {
      ...state,
      settings: {
        ...state.settings,
        avatar: avatar === 'asset:default.svg' ? undefined : avatar
      }
    }
  },
  3: function normalizeMinimalSettingsMigration(state) {
    const minimalSettings = normalizeMinimalSettings(state && state.settings)
    return {
      ...state,
      settings: {
        ...state.settings,
        ...toLegacyMinimalSettingsPatch(minimalSettings)
      }
    }
  }
}

export default {
  key: 'honeystream-state',
  storage,
  whitelist,
  stateReconciler: autoMergeLevel2,
  migrate: createMigrate(migrations, { debug: process.env.NODE_ENV === 'development' }),
  version: 3
}

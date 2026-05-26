import { Reducer } from 'redux'
import { isType } from 'utils/redux'
import { addChat, recordTyping, clearTyping } from 'lobby/actions/chat'
import { resetLobby } from '../actions/common'
import { SystemEventLog } from 'domain/events'
import {
  appendLegacySystemNoticeEvent,
  createLegacySystemEventLog,
  LegacySystemNotice
} from 'lobby/legacy/systemEventLogAdapter'

let CHAT_MESSAGE_COUNTER = 0

export interface IMessageAuthor {
  id: string
  avatar?: string
  username: string
}

export interface IMessage {
  /** Unique ID of message. */
  id: string

  author?: IMessageAuthor

  /** Raw markdown content. */
  content: string

  /** Whether content contains HTML markup to be parsed. */
  html?: boolean

  /** Unix timestamp */
  timestamp: number

  legacySystemNotice?: LegacySystemNotice
}

export interface Typing {
  userId: string

  /** Unix timestamp */
  date: number
}

export interface IChatState {
  messages: IMessage[]
  /** List of typing users by ID. */
  typing: string[]
  systemEventLog: SystemEventLog
}

const initialState: IChatState = {
  messages: [],
  typing: [],
  systemEventLog: createLegacySystemEventLog()
}

export const chat: Reducer<IChatState> = (state: IChatState = initialState, action: any) => {
  if (isType(action, addChat)) {
    const message: IMessage = {
      ...action.payload,
      id: `${++CHAT_MESSAGE_COUNTER}`
    }

    return {
      ...state,
      messages: [...state.messages, message],
      systemEventLog: appendLegacySystemNoticeEvent(state.systemEventLog, message)
    }
  } else if (isType(action, recordTyping)) {
    const userId = action.payload
    // add user to list of typing users if they're not already typing (FIFO)
    const isUserAlreadyTyping = state.typing.some(typingUserId => typingUserId === userId)
    return isUserAlreadyTyping ? state : { ...state, typing: [...state.typing, userId] }
  } else if (isType(action, clearTyping)) {
    return {
      ...state,
      typing: state.typing.filter(typingUserId => typingUserId !== action.payload)
    }
  }

  if (isType(action, resetLobby)) {
    return initialState
  }

  return state
}

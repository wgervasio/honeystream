import { MessageType } from './protocol/message-types'
import { ClientID, RoomID, SignalPayload } from './protocol/wire-types'

export { MessageType, ClientID, RoomID, SignalPayload }

export type Request =
  | {
      t: MessageType.CreateRoom
      id: RoomID
    }
  | { t: MessageType.CreateRoomSuccess }
  | {
      t: MessageType.JoinRoom
      id: RoomID
      /** Offer */
      o: SignalPayload
    }
  | {
      t: MessageType.AuthResponse
      /** Challenge */
      c: string
    }
  | {
      t: MessageType.AuthChallenge
      /** Challenge */
      c: string
    }
  | {
      t: MessageType.CandidateOffer
      /** Offer */
      o: SignalPayload
      /** From */
      f?: ClientID
      to?: ClientID
    }
  | { t: MessageType.Ping }
  | { t: MessageType.Pong }
  | { t: MessageType.RoomNotFound }

export enum SignalErrorCode {
  RoomNotFound = 'roomnotfound'
}

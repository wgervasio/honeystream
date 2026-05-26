export enum MessageType {
  CreateRoom = 0,
  CreateRoomSuccess = 1,
  JoinRoom = 2,
  AuthChallenge = 3,
  AuthResponse = 4,
  CandidateOffer = 5,
  Ping = 6,
  Pong = 7,
  RoomNotFound = 8
}

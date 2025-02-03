import { GameRoom } from "../../../sockets/GameRoom";

export interface IRooms {
    [roomName: string]: GameRoom
}
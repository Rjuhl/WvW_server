import { IPlayerTurn } from "../game/IPlayerTurn";

export interface ITurn {
    [key: string] : IPlayerTurn
}
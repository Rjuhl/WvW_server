import { GameEndTypes } from "../../types/GameEndTypes";
import { IGameState } from "./IGameState";

export interface ICompleteTurnResponse {
    gameState: IGameState
    gamePhase: GameEndTypes
}
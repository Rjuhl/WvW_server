import { GameFactory } from "../factories/GameFactory";
import { Game } from "../game/Game";
import { IGameState } from "../resources/interfaces/game/IGameState";
import { IPLayerState } from "../resources/interfaces/game/IPlayerState";
import { IPlayerTurn } from "../resources/interfaces/game/IPlayerTurn";
import { IPlayerTurnResponse } from "../resources/interfaces/sockets/IPlayerTurnResponse";
import { ITurn } from "../resources/interfaces/sockets/ITurn";
import { GameEndTypes } from "../resources/types/GameEndTypes";
import cloneDeep from "lodash/cloneDeep";

export class GameRoom {
    private player1: string; 
    private player1Password: string;
    private player2: string;
    private player2Password: string;
    private gameLedger: Array<IGameState> = [];
    private game: Game | null = null;
    private turn: ITurn = {};
    private turnCounter: number = 0;
    constructor(
        player1Username: string, 
        player1Password: string,
        player2Username: string,
        player2Password: string,
    ) {
        this.player1 = player1Username;
        this.player2 = player2Username;
        this.player1Password = player1Password;
        this.player2Password = player2Password;
    }

    private bothTurnsSubmited() {
        return this.turn[this.player1] && this.turn[this.player2]
    }

    private getTurnDamageAndMana() {
        let [player1DamageTaken, player1ManaSpent, player2DamageTaken, player2ManaSpent] = [0, 0, 0, 0];
        if (this.gameLedger.length > 1) {
            const prevGameState = this.gameLedger[this.gameLedger.length - 2];
            const curGameState = this.gameLedger[this.gameLedger.length - 1];
            player1DamageTaken = curGameState.player1.playerStats.health - prevGameState.player1.playerStats.health;
            player1ManaSpent = curGameState.player1.playerStats.mana - prevGameState.player1.playerStats.mana;
            player2DamageTaken = curGameState.player2.playerStats.health - prevGameState.player2.playerStats.health;
            player2ManaSpent = curGameState.player2.playerStats.mana - prevGameState.player2.playerStats.mana;
        }
        
        return {
            player1: {
                damageDelivered: player2DamageTaken,
                damageTaken: player1DamageTaken,
                manaSpent: player1ManaSpent,
            },
            player2: {
                damageDelivered: player1DamageTaken,
                damageTaken: player2DamageTaken,
                manaSpent: player2ManaSpent,
            }
        }
    }

    public async init() {
        const gameFactory = new GameFactory();
        this.game = await gameFactory.initGame(
            this.player1,
            this.player1Password,
            this.player2,
            this.player2Password
        )
        this.gameLedger.push(cloneDeep(this.game.getGameState()));
    }

    public getLedger() {
        return this.gameLedger;
    }

    public gameOver() {
        const lastState = this.gameLedger[this.gameLedger.length - 1];
        return (lastState.player1.playerStats.health <= 0 || lastState.player2.playerStats.health <= 0);
    }

    public getTimeOutWinner() {
        if (!this.turn[this.player1] && !this.turn[this.player2]) return 'tie';
        if (this.turn[this.player1]) return this.player1;
        return this.player2;
    }

    public async takeTurn(player: string, turn: IPlayerTurn): Promise<Array<IPlayerTurnResponse> | null > {
        this.turn[player] = turn;
        if(!this.game) return null;
        if (this.bothTurnsSubmited()) {
            let winner = null;
            this.turnCounter += 1;
            const turnResponse = await this.game.completeTurn(this.turn[this.player1], this.turn[this.player2]);
            
            // Determine if there is a winner and pass it along
            if (turnResponse.gamePhase !== GameEndTypes.ONGOING) {
                if (turnResponse.gamePhase === GameEndTypes.TIE) winner = 'tie';
                else winner = (turnResponse.gamePhase === GameEndTypes.PLAYER_1_WINS) ? this.player1 : this.player2;
            };
            this.gameLedger.push(cloneDeep(turnResponse.gameState));
            const turnData = this.getTurnDamageAndMana();

            const playerMoves: { [key: string]: number } = {};
            playerMoves[this.player1] = this.turn[this.player1].spellId;
            playerMoves[this.player2] = this.turn[this.player2].spellId;

            // Clear turn array
            this.turn = {};

            return [
                {
                    player: this.player1,
                    playerState: this.game.getPlayerState(this.player1),
                    damageDelivered: turnData.player1.damageDelivered,
                    damageTaken: turnData.player1.damageTaken,
                    manaSpent: turnData.player1.manaSpent,
                    winner: winner,
                    turn: this.turnCounter,
                    playerMoves: playerMoves,
                },
                {
                    player: this.player2,
                    playerState: this.game.getPlayerState(this.player2),
                    damageDelivered: turnData.player2.damageDelivered,
                    damageTaken: turnData.player2.damageTaken,
                    manaSpent: turnData.player2.manaSpent,
                    winner: winner,
                    turn: this.turnCounter,
                    playerMoves: playerMoves,
                }
            ]

        }
        return null
    }
}
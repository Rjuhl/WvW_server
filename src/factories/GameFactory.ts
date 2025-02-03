import { Game } from '../game/Game';
import { PlayerState } from '../game/PlayerState';
import schemas, { IDatabaseSpell } from '../models/schemas'

export class GameFactory {
    private playerSchema;
    constructor() {
        this.playerSchema = schemas.Users;
    };

    private async getPlayerInfo(username: string, password: string) {
        const userData =  await this.playerSchema.where({username: username, password: password}).findOne()
        if (!userData) {
            throw new Error(`Spell with ID ${userData} not found`);
        }
        return userData;
        
    }

    public async initGame(username1: string, password1: string, username2: string, password2: string) {
        const playerInfo1 = await this.getPlayerInfo(username1, password1);
        const playerInfo2 = await this.getPlayerInfo(username2, password2);
        const gameState = {
            player1: new PlayerState(playerInfo1),
            player2: new PlayerState(playerInfo2)
        };

        return new Game(gameState);
    };
};
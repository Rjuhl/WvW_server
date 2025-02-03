
import { PlayerState } from "../../game/PlayerState";
import { IUser } from "../../models/schemas";
import { Game } from '../../game/Game';
import { IBasicStats } from "../../resources/interfaces/game/IBasicStats";
import { GameEndTypes } from "../../resources/types/GameEndTypes";
import mongoose, { ConnectOptions } from 'mongoose';
import {InitSpellRolls, DynamicObject } from "../../constants/TestConstants";
import { ICompleteTurnResponse } from "../../resources/interfaces/game/ICompleteTurnResponse";
import { Spells } from "../../constants/Spells";
import dotenv from 'dotenv';

jest.setTimeout(20000);
jest.spyOn(Game.prototype, 'makeRoll').mockImplementation(
    (numRolls: number, die: number, base: number) => numRolls + die + base
);
dotenv.config();
const TOTAL_SPELLS = Object.keys(Spells).length / 2;
const buildPlayerTurn = (
    spellId: number,
    manaSpent: number,
    newSpells: Array<number> | null = null
) => {
    return {
        spellId: spellId,
        manaSpent: manaSpent,
        newSpells: newSpells
    };
};
const buildPlayerState = (
    username: string, 
    password: string, 
    health: number,
    mana: number,
    classMultiplier: number,
    classType: number,
    ignited?: number,
    frozen?: boolean,
    observedSpells?: Array<number>,
    observedStats?: IBasicStats,

) => {
    const playerState = new PlayerState({
        admin: false,
        username: username,
        password: password,
        health: health,
        mana: mana,
        classMultiplier: classMultiplier,
        class: classType,
        money: 0,
        activeSpells: [...Array(TOTAL_SPELLS).keys()],
        spellsOwned: [...Array(TOTAL_SPELLS).keys()],
    } as unknown as IUser);

    if (ignited) playerState.ignited = ignited;
    if (frozen) playerState.frozen = frozen;
    if (observedSpells) playerState.observedSpells = observedSpells;
    if (observedStats) playerState.observedStats = observedStats;
    return playerState
};
describe("Game Test", () => {
    let SPELL_ROLL: DynamicObject;
    beforeAll(async () => {
        mongoose
        .connect(process.env.DB_URI as string)
        .then(() => console.log('Connected to Database'))
        .catch((err) => console.log(err));
        SPELL_ROLL = await InitSpellRolls();
        console.log("SPELL_ROLL Contructed");
    });

    afterAll(async () => {
        await mongoose.disconnect();    
    });

    const runBasicTests = (turnResponse: ICompleteTurnResponse, numValues: Array<number>, endType: GameEndTypes) => {
        expect(turnResponse.gameState.player1.playerStats.health).toBe(numValues[0]);
        expect(turnResponse.gameState.player2.playerStats.health).toBe(numValues[1]);
        expect(turnResponse.gameState.player1.playerStats.mana).toBe(numValues[2])
        expect(turnResponse.gameState.player2.playerStats.mana).toBe(numValues[3])
        expect(turnResponse.gamePhase).toBe(endType);
    }

    describe("Basic tests", () => {
        let game: Game;
        beforeEach(() => {
            const player1State = buildPlayerState(
                'player_a', 'password',
                100, 10, 1, 0
            );
            const player2State = buildPlayerState(
                'player_b', 'password',
                100, 10, 1, 0
            );
            game = new Game({
                player1: player1State,
                player2: player2State
            });
        });
    
        it("Test Attack on Attack", async () => {
            const aTurn = buildPlayerTurn(Spells.MAGIC_MISSLE, 1);
            const bTurn = buildPlayerTurn(Spells.MAGIC_MISSLE, 1);
            const turnResponse = await game.completeTurn(aTurn, bTurn);
            runBasicTests(turnResponse, [
                100 - SPELL_ROLL.MAGIC_MISSLE(), 
                100 - SPELL_ROLL.MAGIC_MISSLE(), 
                9, 9], GameEndTypes.ONGOING)
        });
    
        it("Test Attack and Block - no damage", async () => {
            const aTurn = buildPlayerTurn(Spells.MAGIC_MISSLE, 1);
            const bTurn = buildPlayerTurn(Spells.WARD, 1);
            const turnResponse = await game.completeTurn(aTurn, bTurn);
            runBasicTests(turnResponse, [100, 100, 9, 9], GameEndTypes.ONGOING)
        });
    
        it("Test Attack and Block - with damage", async () => {
            const aTurn = buildPlayerTurn(Spells.MAGIC_MISSLE, 2);
            const bTurn = buildPlayerTurn(Spells.WARD, 1);
            const turnResponse = await game.completeTurn(aTurn, bTurn)
            runBasicTests(turnResponse, [
                100, 
                100-(Math.floor((SPELL_ROLL.MAGIC_MISSLE(2) - SPELL_ROLL.WARD()) / 2)), 
                8, 9], GameEndTypes.ONGOING)
        });
    
        it("Test Attack and Passive", async () => {
            const aTurn = buildPlayerTurn(Spells.MAGIC_MISSLE, 1);
            const bTurn = buildPlayerTurn(Spells.RECHARGE, 0);
            const turnResponse = await game.completeTurn(aTurn, bTurn);
            runBasicTests(turnResponse, [
                100, 
                100-SPELL_ROLL.MAGIC_MISSLE(),
                9, 12], GameEndTypes.ONGOING)
        });
    
        it("Test Block and Block", async () => {
            const aTurn = buildPlayerTurn(Spells.WARD, 1);
            const bTurn = buildPlayerTurn(Spells.WARD, 1);
            const turnResponse = await game.completeTurn(aTurn, bTurn);
            runBasicTests(turnResponse, [100, 100, 9, 9], GameEndTypes.ONGOING)
        });
    
        it("Test Passive and Passive", async () => {
            const aTurn = buildPlayerTurn(Spells.RECHARGE, 0);
            const bTurn = buildPlayerTurn(Spells.RECHARGE, 0);
            const turnResponse = await game.completeTurn(aTurn, bTurn);
            runBasicTests(turnResponse, [100, 100, 12, 12], GameEndTypes.ONGOING);
        });
    
        it("Test Heal Works", async () => {
            const aTurn = buildPlayerTurn(Spells.HEAL, 1);
            const bTurn = buildPlayerTurn(Spells.HEAL, 2);
            const turnResponse = await game.completeTurn(aTurn, bTurn)
            runBasicTests(turnResponse, [
                100 + SPELL_ROLL.HEAL(), 
                100 + SPELL_ROLL.HEAL(2), 
                9, 8], GameEndTypes.ONGOING)
        });

        it("Incorrect mana cost is caught", async () => {
            const aTurn = buildPlayerTurn(Spells.HEAVENLY_LIGHTNING_STRIKE, 3);
            const bTurn = buildPlayerTurn(Spells.MAGIC_MISSLE, 0);
            const turnResponse = await game.completeTurn(aTurn, bTurn)
            runBasicTests(turnResponse, [100, 100, 10, 10], GameEndTypes.ONGOING)
        });


        it("Unchargeable spells cannot be charged", async () => {
            const aTurn1 = buildPlayerTurn(Spells.RECHARGE, 0);
            const bTurn1 = buildPlayerTurn(Spells.RECHARGE, 0);
            const aTurn2 = buildPlayerTurn(Spells.HEAVENLY_LIGHTNING_STRIKE, 8);
            const bTurn2 = buildPlayerTurn(Spells.HEAVENLY_LIGHTNING_STRIKE, 12);
            await game.completeTurn(aTurn1, bTurn1);
            const turnResponse = await game.completeTurn(aTurn2, bTurn2);
            runBasicTests(turnResponse, [
                100 - SPELL_ROLL.HEAVENLY_LIGHTNING_STRIKE(), 
                100 - SPELL_ROLL.HEAVENLY_LIGHTNING_STRIKE(), 
                8, 8], GameEndTypes.ONGOING);
        });
    }) 

    describe("Status Effect Tests", () => {
        let game: Game;
        beforeEach(() => {
            const player1State = buildPlayerState(
                'player_a', 'password',
                58, 10, 1, 0
            );
            const player2State = buildPlayerState(
                'player_b', 'password',
                58, 10, 1, 0
            );
            game = new Game({
                player1: player1State,
                player2: player2State
            });
        });

        it("First Strike Apply Damage First", async () => {
            const aTurn = buildPlayerTurn(Spells.LIGHTNING_BOLT, 9);
            const bTurn = buildPlayerTurn(Spells.MAGIC_MISSLE, 9);
            const turnResponse = await game.completeTurn(aTurn, bTurn);
            expect(turnResponse.gamePhase).toBe(GameEndTypes.PLAYER_1_WINS);
        });

        it("Two First Strike Attacks Apply Damage Simultaneously", async () => {
            const aTurn = buildPlayerTurn(Spells.LIGHTNING_BOLT, 9);
            const bTurn = buildPlayerTurn(Spells.LIGHTNING_BOLT, 9);
            const turnResponse = await game.completeTurn(aTurn, bTurn);
            expect(turnResponse.gamePhase).toBe(GameEndTypes.TIE);
        });

        it("Ignited Effect Applies When Damage is Dealt and Deals Damage First Next Turn", async () => {
            // Turn 1
            const aTurn1 = buildPlayerTurn(Spells.FIRE_BALL, 1);
            const bTurn1 = buildPlayerTurn(Spells.HEAVENLY_LIGHTNING_STRIKE, 4);
            const turnResponse1 = await game.completeTurn(aTurn1, bTurn1);
            runBasicTests(turnResponse1, [
                58 - SPELL_ROLL.HEAVENLY_LIGHTNING_STRIKE(), 
                58 - SPELL_ROLL.FIRE_BALL(), 
                9, 6], GameEndTypes.ONGOING);
            expect(turnResponse1.gameState.player2.ignited).toBe(3);

            // Turn 2
            const aTurn2 = buildPlayerTurn(Spells.HEAVENLY_LIGHTNING_STRIKE, 4);
            const bTurn2 = buildPlayerTurn(Spells.RECHARGE, 0);
            const turnResponse2 = await game.completeTurn(aTurn2, bTurn2);
            runBasicTests(turnResponse2, [
                58 - SPELL_ROLL.HEAVENLY_LIGHTNING_STRIKE(), 
                58 - SPELL_ROLL.FIRE_BALL() - SPELL_ROLL.IGNITED - SPELL_ROLL.HEAVENLY_LIGHTNING_STRIKE(), 
                5, 8], GameEndTypes.ONGOING);
            expect(turnResponse2.gameState.player2.ignited).toBe(2);

            //Turn 3
            const aTurn3 = buildPlayerTurn(Spells.RECHARGE, 0);
            const bTurn3 = buildPlayerTurn(Spells.LIGHTNING_BOLT, 7);
            const turnResponse3 = await game.completeTurn(aTurn3, bTurn3);
            expect(turnResponse3.gamePhase).toBe(GameEndTypes.PLAYER_1_WINS);
        });

        it("Ignited Effect Does Not Applies When Damage is Not Dealt", async () => {
            const aTurn = buildPlayerTurn(Spells.FIRE_BALL, 1);
            const bTurn = buildPlayerTurn(Spells.WARD, 1);
            const turnResponse = await game.completeTurn(aTurn, bTurn);
            runBasicTests(turnResponse, [58, 58, 9, 9], GameEndTypes.ONGOING);
            expect(turnResponse.gameState.player2.ignited).toBe(Spells.FIRE_BALL);
        });

        it("Test that Ignited Run Out Over 3 Turns", async () => {
            const aTurn = buildPlayerTurn(Spells.FIRE_BALL, 1);
            const bTurn = buildPlayerTurn(Spells.RECHARGE, 0);
            let turnResponse = await game.completeTurn(aTurn, bTurn);
            expect(turnResponse.gameState.player2.ignited).toBe(3);
            for (let i = 0; i < 4; i++) {
                turnResponse = await game.completeTurn(buildPlayerTurn(Spells.RECHARGE, 0), buildPlayerTurn(Spells.RECHARGE, 0));
            }
            expect(turnResponse.gameState.player2.ignited).toBe(Spells.FIRE_BALL);
            runBasicTests(turnResponse, [
                58, 
                58 - SPELL_ROLL.FIRE_BALL() - SPELL_ROLL.IGNITED * 3, 
                17, 20], GameEndTypes.ONGOING);
        });

        it("Test that Freeze Doubles Mana for Next Attack", async () => {
            // Turn 1
            const aTurn1 = buildPlayerTurn(Spells.FREEZE_SPELL, 1);
            const bTurn1 = buildPlayerTurn(Spells.RECHARGE, 0);
            const turnResponse1 = await game.completeTurn(aTurn1, bTurn1);
            runBasicTests(turnResponse1, [
                58, 
                58 - SPELL_ROLL.FREEZE_SPELL(), 
                9, 12], GameEndTypes.ONGOING);
            expect(turnResponse1.gameState.player1.frozen).toBe(false);
            expect(turnResponse1.gameState.player2.frozen).toBe(true);

            // Turn 2
            const aTurn2 = buildPlayerTurn(Spells.RECHARGE, 0);
            const bTurn2 = buildPlayerTurn(Spells.HEAVENLY_LIGHTNING_STRIKE, 8);
            const turnResponse2 = await game.completeTurn(aTurn2, bTurn2);
            runBasicTests(turnResponse2, [
                58 - SPELL_ROLL.HEAVENLY_LIGHTNING_STRIKE(), 
                58 - SPELL_ROLL.FREEZE_SPELL(), 
                11, 4], GameEndTypes.ONGOING);
            expect(turnResponse2.gameState.player2.frozen).toBe(false); 
        });

        it("Test that Frozen Effect is Always Removed Next Turn", async () => {
            const aTurn = buildPlayerTurn(Spells.FREEZE_SPELL, 1);
            const bTurn = buildPlayerTurn(Spells.RECHARGE, 0);
            let turnResponse = await game.completeTurn(aTurn, bTurn);
            expect(turnResponse.gameState.player2.frozen).toBe(true);
            turnResponse = await game.completeTurn(buildPlayerTurn(Spells.RECHARGE, 0), buildPlayerTurn(Spells.RECHARGE, 0));
            expect(turnResponse.gameState.player2.frozen).toBe(false);
        });

        it("Test that Frozen Effect is Only Applied if Damage is Dealt", async () => {
            const aTurn = buildPlayerTurn(Spells.FREEZE_SPELL, 1);
            const bTurn = buildPlayerTurn(Spells.WARD, 1);
            const turnResponse = await game.completeTurn(aTurn, bTurn);
            expect(turnResponse.gameState.player2.frozen).toBe(false);
        });

        it("Test Energy Steal (Damage/No Damage/Cap)", async () => {
            // Turn 1
            const aTurn1 = buildPlayerTurn(Spells.ENERGY_STEAL, 0);
            const bTurn1 = buildPlayerTurn(Spells.MAGIC_MISSLE, 1);
            const turnResponse1 = await game.completeTurn(aTurn1, bTurn1);
            runBasicTests(turnResponse1, [
                58 - SPELL_ROLL.MAGIC_MISSLE(), 
                58, 
                16, 9], GameEndTypes.ONGOING);
    
            //Turn 2
            const aTurn2 = buildPlayerTurn(Spells.ENERGY_STEAL, 0);
            const bTurn2 = buildPlayerTurn(Spells.RECHARGE, 0);
            const turnResponse2 = await game.completeTurn(aTurn2, bTurn2);
            runBasicTests(turnResponse2, [
                58 - SPELL_ROLL.MAGIC_MISSLE(), 
                58, 
                16, 11], GameEndTypes.ONGOING);

            // Turn 3
            const aTurn3 = buildPlayerTurn(Spells.ENERGY_STEAL, 0);
            const bTurn3 = buildPlayerTurn(Spells.HEAVENLY_LIGHTNING_STRIKE, 4);
            const turnResponse3 = await game.completeTurn(aTurn3, bTurn3);
            runBasicTests(turnResponse3, [
                58 - SPELL_ROLL.MAGIC_MISSLE() - SPELL_ROLL.HEAVENLY_LIGHTNING_STRIKE(), 
                58, 
                24, 7], GameEndTypes.ONGOING);
        });

        it("Test Self-Inflicted Damage", async () => {
            const aTurn = buildPlayerTurn(Spells.CHAOTIC_ENERGY, 0);
            const bTurn = buildPlayerTurn(Spells.CHAOTIC_ENERGY, 0);
            const turnResponse = await game.completeTurn(aTurn, bTurn);
            runBasicTests(turnResponse, [
                58 - SPELL_ROLL.SELF_INFLICTED_DAMAGE, 
                58 - SPELL_ROLL.SELF_INFLICTED_DAMAGE,
                17, 17], GameEndTypes.ONGOING);
        });

        it("Negate Block Overflow Reduction Works", async () => {
            const aTurn = buildPlayerTurn(Spells.DRACONIC_BREATH, 3);
            const bTurn = buildPlayerTurn(Spells.WARD, 1);
            const turnResponse = await game.completeTurn(aTurn, bTurn);
            runBasicTests(turnResponse, [
                58, 
                58 - (SPELL_ROLL.DRACONIC_BREATH(3) - SPELL_ROLL.WARD()), 
                7, 9], GameEndTypes.ONGOING);
        });

        it("Negate Fire Damage Works", async () => {
            const aTurn = buildPlayerTurn(Spells.WATER_JET, 1);
            const bTurn = buildPlayerTurn(Spells.FIRE_BALL, 1);
            const turnResponse = await game.completeTurn(aTurn, bTurn);
            runBasicTests(turnResponse, [
                58 - Math.floor(SPELL_ROLL.FIRE_BALL() / 2), 
                58 - SPELL_ROLL.WATER_JET(), 
                9, 9], GameEndTypes.ONGOING);
        });
    });

    describe("Modifer Tests", () => {
        let game: Game;
        beforeEach(() => {
            const player1State = buildPlayerState(
                'player_a', 'password',
                100, 10, 1.4, 2
            );
            const player2State = buildPlayerState(
                'player_b', 'password',
                100, 10, 1.2, 1
            );
            game = new Game({
                player1: player1State,
                player2: player2State
            });
        });

        it("Character Modifiers Work on Attack", async () => {
            const aTurn = buildPlayerTurn(Spells.LIGHTNING_BOLT, 2);
            const bTurn = buildPlayerTurn(Spells.WATER_JET, 2);
            let turnResponse = await game.completeTurn(aTurn, bTurn);
            runBasicTests(turnResponse, [
                100 - Math.floor(SPELL_ROLL.WATER_JET(2) * 1.2), 
                100 - Math.floor(SPELL_ROLL.LIGHTNING_BOLT(2) * 1.4), 
                8, 8], GameEndTypes.ONGOING);
            turnResponse = await game.completeTurn(aTurn, bTurn);
            runBasicTests(turnResponse, [
                100 - Math.floor(SPELL_ROLL.WATER_JET(2) * 1.2) * 2,
                100 - Math.floor(SPELL_ROLL.LIGHTNING_BOLT(2) * 1.4) * 2, 
                6, 6], GameEndTypes.ONGOING);
        })

        it("Character Modifiers Work on Defense", async () => {
            const aTurn = buildPlayerTurn(Spells.MAGIC_MISSLE, 2);
            const bTurn = buildPlayerTurn(Spells.WATER_FIELD, 1);
            const turnResponse = await game.completeTurn(aTurn, bTurn);
            runBasicTests(turnResponse, [
                100, 
                100 - Math.floor((SPELL_ROLL.MAGIC_MISSLE(2) - Math.floor(SPELL_ROLL.WATER_FIELD() * 1.2)) / 2), 
                8, 9], GameEndTypes.ONGOING);
        });

        it("Modifiers stack", async () => {
            await game.completeTurn(buildPlayerTurn(Spells.FORTIFY_ATTACK, 1), buildPlayerTurn(Spells.RECHARGE, 0));
            await game.completeTurn(buildPlayerTurn(Spells.LIGHTNING_RUNE, 1), buildPlayerTurn(Spells.RECHARGE, 0));
            const aTurn = buildPlayerTurn(Spells.LIGHTNING_BOLT, 2);
            const bTurn = buildPlayerTurn(Spells.RECHARGE, 0);
            const turnResponse = await game.completeTurn(aTurn, bTurn);
            runBasicTests(turnResponse, [
                100, 
                100 - Math.floor(SPELL_ROLL.LIGHTNING_BOLT(2) * 1.4 * 1.5 * 1.25), 
                6, 16], GameEndTypes.ONGOING);
        });

        it("Correct Modifers Apply/Persist", async () => {
            await game.completeTurn(buildPlayerTurn(Spells.FORTIFY_ATTACK, 1), buildPlayerTurn(Spells.RECHARGE, 0));
            await game.completeTurn(buildPlayerTurn(Spells.FIRE_RUNE, 1), buildPlayerTurn(Spells.RECHARGE, 0));
            await game.completeTurn(buildPlayerTurn(Spells.WATER_JET, 2), buildPlayerTurn(Spells.RECHARGE, 0));

            const aTurn = buildPlayerTurn(Spells.DRACONIC_BREATH, 2);
            const bTurn = buildPlayerTurn(Spells.RECHARGE, 0);
            const turnResponse = await game.completeTurn(aTurn, bTurn);
            runBasicTests(turnResponse, [
                100, 
                100 - Math.floor(SPELL_ROLL.WATER_JET(2) * 1.5) - Math.floor(SPELL_ROLL.DRACONIC_BREATH(2) * 1.25), 
                4, 18], GameEndTypes.ONGOING);
        });

        it("Special Blocks Work", async () => {
            const aTurn = buildPlayerTurn(Spells.HEAVENLY_LIGHTNING_STRIKE, 4);
            const bTurn = buildPlayerTurn(Spells.FIRE_FIELD, 2);
            const turnResponse = await game.completeTurn(aTurn, bTurn);
            runBasicTests(turnResponse, [
                100, 
                100 - Math.floor(Math.floor((SPELL_ROLL.HEAVENLY_LIGHTNING_STRIKE() * 1.4) - (SPELL_ROLL.FIRE_FIELD(2) + SPELL_ROLL.BLOCK_MODIFER_AMOUNT(2))) / 2), 
                6, 8], GameEndTypes.ONGOING);
        });
    });

    describe("Win Condition Tests", () => {
        let game: Game;
        beforeEach(() => {
            const player1State = buildPlayerState(
                'player_a', 'password',
                12, 10, 1, 0
            );
            const player2State = buildPlayerState(
                'player_b', 'password',
                12, 10, 1, 0
            );
            game = new Game({
                player1: player1State,
                player2: player2State
            });
        });

        it("Player 1 Can Win", async () => {
            const aTurn = buildPlayerTurn(Spells.MAGIC_MISSLE, 1);
            const bTurn = buildPlayerTurn(Spells.RECHARGE, 0);
            const turnResponse = await game.completeTurn(aTurn, bTurn);
            expect(turnResponse.gamePhase).toBe(GameEndTypes.PLAYER_1_WINS);
        });
   
        it("Player 2 Can Win", async () => {
            const aTurn = buildPlayerTurn(Spells.RECHARGE, 0);
            const bTurn = buildPlayerTurn(Spells.MAGIC_MISSLE, 1);
            const turnResponse = await game.completeTurn(aTurn, bTurn);
            expect(turnResponse.gamePhase).toBe(GameEndTypes.PLAYER_2_WINS);
        });

        it("Ties Can Happen", async () => {
            const aTurn = buildPlayerTurn(Spells.MAGIC_MISSLE, 1);
            const bTurn = buildPlayerTurn(Spells.MAGIC_MISSLE, 1);
            const turnResponse = await game.completeTurn(aTurn, bTurn);
            expect(turnResponse.gamePhase).toBe(GameEndTypes.TIE);
        });
    });

    describe("Misc Tests", () => {

        it("Water Damage is Negated Before Winner", async () => {
            const player1State = buildPlayerState(
                'player_a', 'password',
                19, 10, 1.4, 2
            );
            const player2State = buildPlayerState(
                'player_b', 'password',
                100, 10, 1.2, 1
            );
            const game = new Game({
                player1: player1State,
                player2: player2State
            });
            const aTurn = buildPlayerTurn(Spells.WATER_JET, 1);
            const bTurn = buildPlayerTurn(Spells.DRACONIC_BREATH, 3);
            const turnResponse = await game.completeTurn(aTurn, bTurn);
            runBasicTests(turnResponse, [
                19 - Math.floor(SPELL_ROLL.DRACONIC_BREATH(3) / 2), 
                100 - SPELL_ROLL.WATER_JET(), 
                9, 7], GameEndTypes.ONGOING);
        });
    });
});

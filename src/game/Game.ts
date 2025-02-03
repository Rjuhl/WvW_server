import { SpellFactory } from "../factories/SpellFactory";
import schemas, { IDatabaseSpell } from '../models/schemas'
import { ICompleteTurnResponse } from '../resources/interfaces/game/ICompleteTurnResponse';
import { IGameState } from "../resources/interfaces/game/IGameState";
import { IPLayerState } from "../resources/interfaces/game/IPlayerState";
import { IPlayerTurn } from "../resources/interfaces/game/IPlayerTurn";
import { ISpell } from "../resources/interfaces/game/ISpell";
import { GameEndTypes } from "../resources/types/GameEndTypes";
import { SpellRoles } from "../resources/types/SpellRoles";
import { SpellTypes } from "../resources/types/SpellTypes";
import { Spell } from "./Spell";
import cloneDeep from "lodash/cloneDeep";

const IGNITED_ROUNDS = 3;
const MAX_MANA_GAIN = 8;

export class Game  {
    protected gameState: IGameState;
    protected spellFactory;
    constructor(gameState: IGameState) {
        this.gameState = gameState;
        this.spellFactory = new SpellFactory();
    }

    private validateGameState() {
        // Should add validation that the gamestate is constructed properly
        // User is the right user
        // User owns spells equiped
        // ETC
    }

    private winner() {
        const isPlayer1Alive = this.gameState.player1.playerStats.health > 0;
        const isPlayer2Alive = this.gameState.player2.playerStats.health > 0;
        if (isPlayer1Alive && isPlayer2Alive) return GameEndTypes.ONGOING;
        if (!isPlayer1Alive && !isPlayer2Alive) return GameEndTypes.TIE;
        return isPlayer1Alive ? GameEndTypes.PLAYER_1_WINS : GameEndTypes.PLAYER_2_WINS;
    };

    public makeRoll(numRolls: number, die: number, base: number) {
        let amount = base;
        for (let i = 0; i < numRolls; i++) {amount += Math.floor(Math.random() * die) + 1};
        return amount;
    };
    
    private dealDamage(player: IPLayerState, damage: number) {        
        player.playerStats.health -= damage;
    };

    private ignitedDamage(player: IPLayerState) {
        if (player.ignited > 0) {
            player.ignited -= 1;
            this.dealDamage(player, this.makeRoll(1, 6, 0));
        };
    };

    private applyActiveModifiers(player: IPLayerState, spell: ISpell) {
        let modifier = 1;
        player.modifiers
        .filter((abilityModifer) => abilityModifer.applyCondition(spell))
        .forEach((abilityModifer) => modifier *= abilityModifer.multiplier);
        player.modifiers = player.modifiers
        .filter((abilityModifer) => !abilityModifer.deleteCondition(spell));

        return modifier;
    };

    private resolveSpellDamage(
        attackingPlayer: IPLayerState, 
        attackingSpell: ISpell, 
        attackingChargedModifier: number,
        defendingPlayer: IPLayerState, 
        defendingSpell: ISpell, 
        defendingChargedModifier: number
    ) {
        // Roll attacking die and apply modifers
        const attackDie = attackingSpell.damage;
        let attackRoll = (attackingChargedModifier > 0) ?
        this.makeRoll(
            attackDie.numRolls * attackingChargedModifier,
            attackDie.die,
            attackDie.base * attackingChargedModifier
        ) : 0;
        if (attackingSpell.spellRole === SpellRoles.ATTACK) attackRoll *= this.applyActiveModifiers(attackingPlayer, attackingSpell);
        if (attackingSpell.spellClass === SpellTypes.FIRE && defendingSpell.negatesFireDamge) attackRoll = Math.floor(attackRoll / 2); 

        // Roll block and apply modifers
        const defendingDie = defendingSpell.defense;
        let defendingRoll = (defendingChargedModifier > 0) ?
        this.makeRoll(
            defendingDie.numRolls * defendingChargedModifier,
            defendingDie.die,
            defendingDie.base * defendingChargedModifier
        ) : 0;
        if (defendingSpell.spellRole === SpellRoles.DEFENSE) {
            defendingRoll *= this.applyActiveModifiers(defendingPlayer, defendingSpell);
            
            // Check if block is extra effective
            if (defendingSpell.hasBlockModifer && defendingSpell.blockModifierType === attackingSpell.spellClass) defendingRoll += (4 * defendingChargedModifier);

            attackRoll -= Math.floor(defendingRoll);
            if (!attackingSpell.negateBlockOverflowModifier) attackRoll = Math.floor(attackRoll / 2);
        };

        // Note that freezing and igntes will need to be apply after 
        return (attackRoll > 0) ? attackRoll : 0;
    
    };

    private resolveSpellDamageWrapper(
        spell1: ISpell, 
        chargeModifier1: number,
        condition1: boolean, 
        spell2: ISpell, 
        chargeModifier2: number, 
        condition2: boolean
    ){
        let player1Damage = 0;
        let player2Damage = 0;

        if (condition1) {
            const spellDamage = Math.floor(this.resolveSpellDamage(
                this.gameState.player1,
                spell1,
                chargeModifier1,
                this.gameState.player2,
                spell2,
                chargeModifier2
            ));
            this.gameState.player2.playerStats.health -= spellDamage;
            player1Damage += spellDamage
        };

        if (condition2){
            const spellDamage = Math.floor(this.resolveSpellDamage(
                this.gameState.player2,
                spell2,
                chargeModifier2,
                this.gameState.player1,
                spell1,
                chargeModifier1
            ));
            this.gameState.player1.playerStats.health -= spellDamage;
            player2Damage += spellDamage
        }; 

        return [player1Damage, player2Damage]
    };

    private resolveStatics(spell1: ISpell, spell2: ISpell, playerDamages: Array<number>) {
       // Apply after damage effect (freezing + igniting)
        if (playerDamages[0] > 0) {
            if (spell1.ignites) this.gameState.player2.ignited += IGNITED_ROUNDS;
            if (spell1.freezes) this.gameState.player2.frozen = true;
        };

        if (playerDamages[1] > 0) {
            if (spell2.ignites) this.gameState.player1.ignited += IGNITED_ROUNDS;
            if (spell2.freezes) this.gameState.player1.frozen = true;
        };

        // Gain Mana From Damage
        if (spell1.gainManaFromDamage) {
            this.gameState.player1.playerStats.mana += Math.min(Math.floor(playerDamages[1] / 2), MAX_MANA_GAIN)
        };
        if (spell2.gainManaFromDamage) {
            this.gameState.player2.playerStats.mana += Math.min(Math.floor(playerDamages[0] / 2), MAX_MANA_GAIN)
        };

        // Take Self Inflicted Damage
        if (spell1.selfInflictedDamage) this.gameState.player1.playerStats.health -= this.makeRoll(1, 6, 0);
        if (spell2.selfInflictedDamage) this.gameState.player2.playerStats.health -= this.makeRoll(1, 6, 0);

        // Gain Mana
        this.gameState.player1.playerStats.mana += this.makeRoll(
            spell1.manaRecharge.numRolls,
            spell1.manaRecharge.die,
            spell1.manaRecharge.base
        );
        this.gameState.player2.playerStats.mana += this.makeRoll(
            spell2.manaRecharge.numRolls,
            spell2.manaRecharge.die,
            spell2.manaRecharge.base
        );

        // Apply modifers 
        if (spell1.modifier) this.gameState.player1.modifiers.push(spell1.modifier);
        if (spell2.modifier) this.gameState.player2.modifiers.push(spell2.modifier);

        // Reveal Player spells and stats
        if (spell1.readsOpponent) {
            this.gameState.player1.observedSpells = cloneDeep(this.gameState.player2.spells);
            this.gameState.player1.observedStats = cloneDeep(this.gameState.player2.playerStats);
        };
        if (spell2.readsOpponent) {
            this.gameState.player2.observedSpells = cloneDeep(this.gameState.player1.spells);
            this.gameState.player2.observedStats = cloneDeep(this.gameState.player1.playerStats);
        };

    };

    private resolveSpell(spell1: ISpell, chargeModifier1: number, spell2: ISpell, chargeModifier2: number) {
        // Deal ignited damage first
        this.ignitedDamage(this.gameState.player1);
        this.ignitedDamage(this.gameState.player2);
        if (this.winner() !== GameEndTypes.ONGOING) return this.winner();

        // Resolve Healing 
        this.gameState.player1.playerStats.health += this.makeRoll(spell1.healing.numRolls * chargeModifier1, spell1.healing.die, spell1.healing.base * chargeModifier1);
        this.gameState.player2.playerStats.health += this.makeRoll(spell2.healing.numRolls * chargeModifier2, spell2.healing.die, spell2.healing.base * chargeModifier2);
       
        //Resolve Damage
        let playerDamages = [0, 0]
        const firstStrikeDamages = this.resolveSpellDamageWrapper(
            spell1, 
            chargeModifier1,
            spell1.firstStrike,
            spell2,
            chargeModifier2,
            spell2.firstStrike
        );
        playerDamages = playerDamages.map((num, index) => num + firstStrikeDamages[index]);
        if (this.winner() !== GameEndTypes.ONGOING) return this.winner();
        const spellDamages = this.resolveSpellDamageWrapper(
            spell1, 
            chargeModifier1,
            !spell1.firstStrike,
            spell2,
            chargeModifier2,
            !spell2.firstStrike
        );
        playerDamages = playerDamages.map((num, index) => num + spellDamages[index]);
        if (this.winner() !== GameEndTypes.ONGOING) return this.winner();        

        // Resolve non combat effects
        this.resolveStatics(
            spell1, 
            spell2,
            playerDamages
        );

        return this.winner();
       
    };

    private getManaSpent(spell: ISpell, manaSpent: number, playerState: IPLayerState) {
        let spellCost = spell.manaCost;
        if (spellCost === 0) return 0;
        if (playerState.frozen) {
            if (spell.spellRole !== SpellRoles.RECHARGE) spellCost *= 2;
        };
        manaSpent = (playerState.playerStats.mana >= manaSpent) ? manaSpent : playerState.playerStats.mana;
        manaSpent -= manaSpent % spellCost;
        return (!spell.charageable && manaSpent > spellCost) ? spellCost : manaSpent;
    };

    private async spellReselect(newSpells: Array<number>, player: IPLayerState) {
        const spellsOwned = (await schemas.Users.where({ username: player.playerId  }).findOne())?.spellsOwned;
        if (spellsOwned) {
            let isValid = true;
            for (const spell of newSpells) {
                if(!(spellsOwned.includes(spell))){
                    isValid = false;
                    break;;
                }
            };

            if (isValid) {
                player.spells = newSpells;
            };
        };
    };

    public getPlayerState(playerId: string) {
        if (this.gameState.player1.playerId === playerId) return this.gameState.player1;
        if (this.gameState.player2.playerId === playerId) return this.gameState.player2;
        console.log('Get Player State Used Incorrectly');
        return this.gameState.player1;
    };

    public getGameState(): IGameState {
        return this.gameState;
    };

    public async completeTurn(player1Turn: IPlayerTurn, player2Turn: IPlayerTurn): Promise<ICompleteTurnResponse> {
        //Get Spells
        const player1Spell = (this.gameState.player1.spells.includes(player1Turn.spellId)) ? await this.spellFactory.getSpell(player1Turn.spellId) : new Spell();
        const player2Spell = (this.gameState.player2.spells.includes(player2Turn.spellId)) ? await this.spellFactory.getSpell(player2Turn.spellId) : new Spell();

        // get charge modifiers
        const player1ManaSpent = this.getManaSpent(player1Spell, player1Turn.manaSpent, this.gameState.player1);
        const player2ManaSpent = this.getManaSpent(player2Spell, player2Turn.manaSpent, this.gameState.player2);
        const player1SpellCost = (this.gameState.player1.frozen) ? player1Spell.manaCost * 2 : player1Spell.manaCost;
        const player2SpellCost = (this.gameState.player2.frozen) ? player2Spell.manaCost * 2 : player2Spell.manaCost;
        const player1ChargeModifier = (player1SpellCost === 0) ? 0 : Math.floor(player1ManaSpent / player1SpellCost);
        const player2ChargeModifier = (player2SpellCost === 0) ? 0 : Math.floor(player2ManaSpent / player2SpellCost);
        this.gameState.player1.playerStats.mana -= player1ManaSpent;
        this.gameState.player2.playerStats.mana -= player2ManaSpent;

        if (player1Spell.reselectSpells && player1ChargeModifier > 0 && player1Turn.newSpells) await this.spellReselect(player1Turn.newSpells, this.gameState.player1);
        if (player2Spell.reselectSpells && player2ChargeModifier > 0 && player2Turn.newSpells) await this.spellReselect(player2Turn.newSpells, this.gameState.player2);
        
        // Unfreeze players
        this.gameState.player1.frozen = false;
        this.gameState.player2.frozen = false;

        // resolve spell
        const outcome = this.resolveSpell(
            player1Spell,
            player1ChargeModifier,
            player2Spell,
            player2ChargeModifier
        );
        
        return {
            "gameState": this.gameState,
            "gamePhase": outcome
        };
    };
};
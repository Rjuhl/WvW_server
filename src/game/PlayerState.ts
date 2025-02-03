import { IUser } from "../models/schemas";
import { IAbilityMultiplier } from "../resources/interfaces/game/IAbilityMultiplier";
import { IBasicStats } from "../resources/interfaces/game/IBasicStats";
import { IPLayerState } from "../resources/interfaces/game/IPlayerState";
import { SpellRoles } from "../resources/types/SpellRoles";
import { AbilityMultiplier } from "./AbilityMultiplier";

export class PlayerState implements IPLayerState {
    playerId: string;
    playerStats: IBasicStats;
    modifiers: Array<IAbilityMultiplier>;
    manaCostMultiplier: number = 1;
    ignited: number = 0;
    frozen: boolean = false;
    spells: Array<number>;
    observedSpells: Array<number> | null = null;
    observedStats: IBasicStats | null = null;

    constructor(userData: IUser) {
        this.playerId = userData.username;
        this.playerStats = {
            health: userData.health,
            mana: userData.mana,
            classMultiplier: userData.classMultiplier,
            classType: userData.class
        };
        this.modifiers = [
            new AbilityMultiplier(
                this.playerStats.classMultiplier,
                this.playerStats.classType,
                SpellRoles.ALL,
                false
            )
        ];

        this.spells = userData.activeSpells;
    };
};
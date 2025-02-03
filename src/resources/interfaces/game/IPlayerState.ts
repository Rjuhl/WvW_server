import { IBasicStats } from "./IBasicStats"
import { IAbilityMultiplier } from "./IAbilityMultiplier"

export interface IPLayerState {
    playerId: string,
    playerStats: IBasicStats,
    modifiers: Array<IAbilityMultiplier>,
    manaCostMultiplier: number,
    ignited: number,
    frozen: boolean,
    spells: Array<number>,
    observedSpells: Array<number> | null
    observedStats: IBasicStats | null
}
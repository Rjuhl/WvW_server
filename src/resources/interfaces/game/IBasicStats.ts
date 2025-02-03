import { SpellTypes } from "../../types/SpellTypes"

export interface IBasicStats {
    health: number,
    mana: number,
    classMultiplier: number,
    classType: SpellTypes
}
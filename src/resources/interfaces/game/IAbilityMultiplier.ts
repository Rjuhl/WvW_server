import { SpellRoles } from "../../types/SpellRoles";
import { SpellTypes } from "../../types/SpellTypes"
import { ISpell } from "./ISpell";


export interface IAbilityMultiplier {
    multiplier: number,
    type: SpellTypes,
    role: SpellRoles,
    applyCondition(castSpell: ISpell): boolean
    deleteCondition(castSpell: ISpell): boolean
}
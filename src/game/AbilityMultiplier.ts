import { IAbilityMultiplier } from "../resources/interfaces/game/IAbilityMultiplier";
import { ISpell } from "../resources/interfaces/game/ISpell";
import { SpellRoles } from "../resources/types/SpellRoles";
import { SpellTypes } from "../resources/types/SpellTypes";

export class AbilityMultiplier implements IAbilityMultiplier {
    public readonly multiplier: number
    public readonly type: SpellTypes
    public readonly role: SpellRoles
    public readonly removeAfterUse: boolean
    constructor(multiplier: number, type: SpellTypes, role: SpellRoles, removeAfterUse: boolean) {
        this.multiplier = multiplier
        this.type = type
        this.role = role
        this.removeAfterUse = removeAfterUse
    }
    applyCondition(castSpell: ISpell): boolean {
        return (
            ((this.type === castSpell.spellClass) || (this.type === SpellTypes.ALL)) &&
            ((this.role === castSpell.spellRole) || (this.role === SpellRoles.ALL))
        )
    }

    deleteCondition(castSpell: ISpell): boolean {
        return this.removeAfterUse && this.applyCondition(castSpell)
    }
}
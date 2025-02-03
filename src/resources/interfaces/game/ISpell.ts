import { SpellRoles } from "../../types/SpellRoles";
import { SpellTypes } from "../../types/SpellTypes";
import { IAbilityMultiplier } from "./IAbilityMultiplier";
import { IDieRoll } from "./IDieRoll";

export interface ISpell {
    damage: IDieRoll,
    defense: IDieRoll,
    healing: IDieRoll,
    manaRecharge: IDieRoll,
    manaCost: number,
    spellClass: SpellTypes,
    spellRole: SpellRoles,
    firstStrike: boolean,
    charageable: boolean,
    ignites: boolean,
    freezes: boolean,
    negatesFireDamge: boolean,
    negateBlockOverflowModifier: boolean,
    modifier: IAbilityMultiplier | null,
    readsOpponent: boolean,
    reselectSpells: boolean,
    gainManaFromDamage: boolean,
    selfInflictedDamage: boolean,
    hasBlockModifer: boolean,
    blockModifierType: SpellTypes,
}
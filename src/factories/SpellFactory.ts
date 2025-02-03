import { Spell } from '../game/Spell'
import schemas, { IDatabaseSpell } from '../models/schemas'
import { Flag } from '../resources/types/FlagTypes'
import { SpellRoles } from '../resources/types/SpellRoles'
import { SpellTypes } from '../resources/types/SpellTypes'

export class SpellFactory {
    private spellSchema
    constructor() {
        this.spellSchema = schemas.Spells
    }

    // THIS CAN BE FACTORED OUT
    private getType(spellClass: number) {
        switch (spellClass) {
            case 0:
                return SpellTypes.FIRE
            case 1:
                return SpellTypes.WATER
            case 2:
                return SpellTypes.ELECTRIC
            case 3:
                return SpellTypes.NONE
            case 4:
                return SpellTypes.ALL
            default:
                console.log('spellCalss value incorrect (!= 0|1|2|3)')
                return SpellTypes.NONE
        }
    }

    // THIS CAN BE FACTORED OUT
    private getRole(spellRole: number) {
        switch(spellRole) {
            case 0:
                return SpellRoles.ATTACK
            case 1:
                return SpellRoles.DEFENSE
            case 2:
                return SpellRoles.HEALING
            case 3:
                return SpellRoles.RECHARGE
            case 4:
                return SpellRoles.PASSIVE
            case 5: 
                return SpellRoles.NONE
            case 6: 
                return SpellRoles.ALL
            default:
                console.log('spellRole value incorrect (!=0|1|2|3');
                return SpellRoles.NONE
        }
    }

    private async getSpellData(spellId: number) {
        const spellData =  await this.spellSchema.where({id: spellId}).findOne()
        if (!spellData) {
            throw new Error(`Spell with ID ${spellId} not found`);
        }
        return spellData
    }

    public async getSpell(spellId: number) {
        const spellData = await this.getSpellData(spellId)
        const spell = new Spell()

        if (this.getRole(spellData.type) === SpellRoles.ATTACK) {
            spell.setDamage(
                spellData.abilityBase,
                spellData.abilityDie,
                spellData.abilityNumDie,
            )
        }
        if (this.getRole(spellData.type) === SpellRoles.DEFENSE) {
            spell.setDefense(
                spellData.abilityBase,
                spellData.abilityDie,
                spellData.abilityNumDie,
            )
        }
        if (this.getRole(spellData.type) === SpellRoles.HEALING) {
            spell.setHealing(
                spellData.abilityBase,
                spellData.abilityDie,
                spellData.abilityNumDie,
            )
        }
        if (this.getRole(spellData.type) === SpellRoles.RECHARGE) {
            spell.setManaRecharge(
                spellData.abilityBase,
                spellData.abilityDie,
                spellData.abilityNumDie,
            )
        }

        /*
            Note this is confusing. The db type corresponds to spell 
            role while the db class corresponds to the type. 
        */

        spell.setManaCost(spellData.manaCost)
        spell.setSpellRole(this.getRole(spellData.type))
        spell.setSpellType(this.getType(spellData.class))
        spell.setFirstStrike(spellData.flags[Flag.FIRST_STRIKE])
        spell.setCharageable(spellData.flags[Flag.CHARGEABLE])
        spell.setIgnites(spellData.flags[Flag.IGNITES])
        spell.setNegatesFireDamge(spellData.flags[Flag.NEGATE_FIRE_DAMAGE])
        spell.setNegateBlockOverflowModifier(spellData.flags[Flag.NEGATE_BLOCK_OVERFLOW_MODIFIER])
        spell.setReadsOpponent(spellData.flags[Flag.READ_OPPONENT])
        spell.setReselectSpells(spellData.flags[Flag.RESELECT_SPELLS])
        spell.setGainManaFromDamage(spellData.flags[Flag.GAIN_MANA_FROM_DAMAGE])
        spell.setSelfInflictedDamage(spellData.flags[Flag.SELF_INFLICTED_DAMAGE])
        spell.setFreezes(spellData.flags[Flag.FREEZES])
        spell.setHasBlockModifer(spellData.flags[Flag.HAS_BLOCK_MODIFER])
        spell.setBlockModifierType(this.getType(spellData.flags[Flag.BLOCK_MODIFIER_TYPE]))
        spell.setModifier(
            spellData.flags[Flag.MODIFIER_AMOUNT],
            spellData.flags[Flag.MODIFIER_TYPE],
            spellData.flags[Flag.MODIFIER_ROLE],
            spellData.flags[Flag.MODIFIER_REMOVE_AFTER_USE]
        )

        return spell
    }
}
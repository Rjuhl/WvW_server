export interface IPlayerTurn {
    spellId: number
    manaSpent: number
    newSpells: Array<number> | null
}
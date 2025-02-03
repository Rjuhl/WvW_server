import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUser extends Document {
    admin: boolean;
    username: string;
    password: string;
    hatColor: string[];
    staffColor: string[];
    health: number;
    mana: number;
    classMultiplier: number;
    class: number;
    money: number;
    activeSpells: number[];
    spellsOwned: number[];
}

export interface IDatabaseSpell extends Document {
    id: string;
    name: string;
    type: number;
    class: number;
    manaCost: number;
    goldCost: number;
    abilityBase: number;
    abilityDie: number;
    abilityNumDie: number;
    flags: number[];
    description: string;
}

// Define the user schema
const userSchema = new Schema<IUser>({
    admin: { type: Boolean, default: false },
    username: { type: String, required: true },
    password: { type: String, required: true },
    hatColor: { type: [String], maxItems: 3, default: [''] },
    staffColor: { type: [String], maxItems: 3, default: [''] },
    health: { type: Number, required: true, default: 0 },
    mana: { type: Number, required: true, default: 0 },
    classMultiplier: { type: Number, required: true, default: 0},
    class: { type: Number, default: -1 },
    money: { type: Number, default: 100 },
    activeSpells: { type: [Number], maxItems: 6, uniqueItems: true },
    spellsOwned: { type: [Number], maxItems: 20, uniqueItems: true },
});

// Define the spell schema
const spellSchema = new Schema<IDatabaseSpell>({
    id: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: Number, required: true },
    class: { type: Number, required: true },
    manaCost: { type: Number, required: true },
    goldCost: { type: Number, required: true },
    abilityBase: { type: Number, required: true },
    abilityDie: { type: Number, required: true },
    abilityNumDie: { type: Number, required: true },
    flags: { type: [Number], minItems: 20, maxItems: 20 },
    description: { type: String, required: true },
});

// Create models with TypeScript generics
const Users: Model<IUser> = mongoose.model<IUser>('Users', userSchema, 'users');
const Spells: Model<IDatabaseSpell> = mongoose.model<IDatabaseSpell>('Spells', spellSchema, 'spells');

// Export the models and schemas
const mySchemas = { Users, Spells };
export default mySchemas;
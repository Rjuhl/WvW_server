import express from 'express';
import crypto from 'crypto';
import dotenv from 'dotenv';
import schemas from '../models/schemas'; 
import { IUserInfo } from '../resources/interfaces/router/IUserInfo';
import { SpellFactory } from '../factories/SpellFactory';

dotenv.config();

const router = express.Router();

router.post('/signup', async (req, res) => {
    const { username, password, accessCode, adminCode } = req.body;
    if (process.env.ACCESS_CODE != accessCode){
        res.status(201).send("Access code is incorrect")
        res.end()
        return
    }

    const duplicate_username = await schemas.Users.where({username: username}).findOne()
    if (duplicate_username != null) {
        res.status(201).send("Username is taken. Use a different one")
        res.end()
        return
    }

    let admin = false
    if (process.env.ADMIN_CODE === adminCode) {admin = true}

    const newPassword = crypto.createHash('sha1').update(password).digest('hex');
    const newUserData = {username: username, password: newPassword, admin: admin}
    const newUser = new schemas.Users(newUserData)
    const saveUser = await newUser.save()

    if (saveUser) {
        res.send(`User ${username} created. Please login`)
    } else {
        res.status(201).send("Failed to save user profile. Please try again.")
    }

    res.end()
})

router.get('/login', async (req, res) => {
    const {username, password} = req.query
    const hashedPassword = crypto.createHash('sha1').update(password as string).digest('hex');

    const userData = {username: username, password: hashedPassword}
    const userContext = await schemas.Users.where(userData).findOne()

    if (userContext === null) {
        res.status(201)
        res.send("Login or password incorrect")
        res.end()
        return
    }

    if (userContext.class === -1){
        res.send({route: "charcreation", user: userContext})
    } else{
        res.send({route: "home", user: userContext})
    }

    res.end()
})

router.get('/playerAvatar', async (req, res) => {
    const username = req.query.username;
    const filter = {username: username};
    const userContext = await schemas.Users.where(filter).findOne();
    if (userContext) {
        res.send(
            {
                player: userContext.username,
                hatColor: userContext.hatColor,
                staffColor: userContext.staffColor,
                petEquiped: userContext.petEquiped,
            }
        )
        return;
    }
    res.status(201).send("player does not exist");
});

router.post('/submitprofile', async (req, res) => {
    const user = req.body.userInfo
    const totalPoints = 4
    const [healthIncrement, manaIncrement, classMultiplierIncrement] = [20, 1, 0.1]
    const [baseHealth, baseMana, baseClassMultiplier] = [100, 8, 1.0]
    const filter = {username: user.username}
    
    const verifyAttributePoints = (userInfo: IUserInfo) => {
        const [health, mana, classMultiplier] = [userInfo.health, userInfo.mana, userInfo.classMultiplier]

        if (health < baseHealth || mana < baseMana || classMultiplier < baseClassMultiplier) { console.log(0); return false }

        if (
            health > baseHealth + (totalPoints * healthIncrement) ||
            mana > baseMana + (totalPoints * manaIncrement) ||
            classMultiplier > baseClassMultiplier+ (totalPoints * classMultiplierIncrement)
        ) { console.log(1); return false }
        
        const pointsUsed = (value: number, base: number, increment: number) => {
           const points = Math.round((((value - base) / increment) * 10000) / 10000)
           return points > 0 ? points : 0
        }

        if (
            pointsUsed(health, baseHealth, healthIncrement) + 
            pointsUsed(mana, baseMana, manaIncrement) + 
            pointsUsed(classMultiplier, baseClassMultiplier, classMultiplierIncrement) > 4
        ) { console.log(2); return false }

        return true
    }

    if (!verifyAttributePoints(user)) {
        res.status(201)
        res.send("!!!Invalid Character Values!!!")
    } else {
        const result = await schemas.Users.replaceOne(filter, user);
        if (result) {res.send("success")}
        else {res.send("Failed to update user to database")}
        
    }
    res.end()
})

router.post('/changeStats', async (req, res) => {
    const filter = {username: req.body.username, password: req.body.password}
    const userInfo = await schemas.Users.where(filter).findOne()
    if (userInfo && userInfo.money < 50) {
        res.status(201).send("Not enough gold to change player stats")
        return
    }
    if (userInfo) {
        userInfo.money -= 50
        const dbRes = await schemas.Users.replaceOne(filter, userInfo);
        if (!dbRes) {
            res.status(202).send("Db error");
        }
    }

    res.status(200).send("/charcreation")
});

router.post('/addspell', async (req, res) => {
    const spell = req.body
    let success = true
    if (spell.code != process.env.ADMIN_CODE) {
        console.log("no admin access")
        res.send("Must be admin to add spell")
        res.end()
        return
    }
    
    if (spell.id === '-1') {
        const numSpells = await schemas.Spells.countDocuments()
        spell.id = numSpells
        const spellSchema = new schemas.Spells(spell)
        const savedSpell = await spellSchema.save();
        if (!savedSpell) {
            res.status(500).send("Failed to create spell. Please try again.");
            res.end()
            return;
        }
    } else {
        const filter = {id: spell.id}
        const updateResult = await schemas.Spells.replaceOne(filter, spell);
        if (!(updateResult.modifiedCount > 0)) {
            res.status(500).send("Failed to update spell. Please try again.");
            res.end()
            return;
        }
    }

    if (!success) {
        res.send("Failed to create spell. Please try again.")
        res.end()
        return;
    }
    
    res.send("Success");
    res.end();
}) 

router.get('/spell', async (req, res) => {
    const id = req.query.id
    const spell =  await schemas.Spells.where({id: id}).findOne()
    res.send({ spell: spell })
    res.end()
})

router.get('/numSpells', async (req, res) => {
    const numSpells = await schemas.Spells.countDocuments()
    if (numSpells) {
        res.status(200).send({number: numSpells});
        return;
    }
    res.status(500).send("error");
})

router.get('/test', async (req, res) => {
    const spellFactory = new SpellFactory()
    const spell = await spellFactory.getSpell(1)
    console.log(spell)
    res.send({spell: spell})
    res.end()
})

router.post('/buySpell', async (req, res) => {
    const {username, password, spellId} = req.body
    const spell = await schemas.Spells.where({ id:spellId }).findOne()
    let user = await schemas.Users.where({ username:username, password:password }).findOne()

    if (user === null || spell === null) {
        res.status(201).send("Null user or spell")
        return
    }

    if (spell.goldCost > user.money) {
        res.status(201).send("User does not have sufficient gold to purchase spell")
        return
    }

    if (user.spellsOwned.includes(spell.id)) {
        res.status(201).send('spell already bought')
        return
    }

    user.money -= spell.goldCost
    user.spellsOwned.push(spell.id)
    const result = await schemas.Users.replaceOne({ username:username }, user);

    if(result) {res.send(user)}
    else {
        res.status(201).send("Failed to purchase spell")
    }
})

router.post('/setActiveSpell', async (req, res) => {
    const numSpellSlots = 6
    const {username, password, spellId} = req.body
    const spell = await schemas.Spells.where({ id:spellId }).findOne()
    let user = await schemas.Users.where({ username:username, password:password }).findOne()

    if (user === null || spell === null) {
        res.status(201)
        res.send("Null user or spell")
        res.end()
        return
    }

    if (user.activeSpells.length >= numSpellSlots) {
        res.status(201)
        res.send("Active spell limit already reached")
        res.end()
        return
    }

    if (user.activeSpells.includes(spell.id)) {
        res.status(201)
        res.send("Spell already active")
        res.end()
        return
    }

    user.activeSpells.push(spell.id)
    const result = await schemas.Users.replaceOne({ username:username }, user);

    if(result) {res.send(user)}
    else {
        res.status(201)
        res.send("Failed to activate spell")
    }
    res.end()

})

router.post('/deactivateSpell', async (req, res) => {
    const {username, password, spellId} = req.body
    let user = await schemas.Users.where({ username:username, password:password }).findOne()

    if (user === null) {
        res.status(201)
        res.send("Null user")
        res.end()
        return
    }

    let filteredActiveSpells = user.activeSpells.filter(spell => spell !== spellId)
    user.activeSpells = filteredActiveSpells
    const result = await schemas.Users.replaceOne({ username:username }, user);

    if(result) {res.send(user)}
    else {
        res.status(201)
        res.send("Failed to deactivate spell")
    }
    res.end()

})

router.post('/addpet', async (req, res) => {
    const pet = req.body
    let success = true
    if (pet.code != process.env.ADMIN_CODE) {
        console.log("no admin access")
        res.send("Must be admin to add spell")
        res.end()
        return
    }
    
    if (pet.id === '-1') {
        const numPets = await schemas.Pets.countDocuments()
        pet.id = numPets
        const petSchema = new schemas.Pets(pet)
        const savedPet = await petSchema.save();
        if (!savedPet) {
            res.status(500).send("Failed to create spell. Please try again.");
            res.end()
            return;
        }
    } else {
        const filter = {id: pet.id}
        const updateResult = await schemas.Pets.replaceOne(filter, pet);
        if (!(updateResult.modifiedCount > 0)) {
            res.status(500).send("Failed to update spell. Please try again.");
            res.end()
            return;
        }
    }

    if (!success) {
        res.send("Failed to create spell. Please try again.")
        res.end()
        return;
    }
    
    res.send("Success");
    res.end();
}) 


router.get('/pet', async (req, res) => {
    const id = req.query.id;
    const pet =  await schemas.Pets.where({id: id}).findOne();
    res.send({ pet: pet });
    res.end();
});


router.get('/numPets', async (req, res) => {
    const numPets = await schemas.Pets.countDocuments()
    if (numPets) {
        res.status(200).send({number: numPets});
        return;
    }
    res.status(500).send("error");
})

router.post('/equipPet', async (req, res) => {
    const [username, password, pet] = [req.body.username, req.body.password, req.body.pet];
    const filter = { username: username, password: password };
    const userInfo = await schemas.Users.where(filter).findOne();

    if (!userInfo) {
        res.status(201).send("user does not exist");
        return;
    }

    if (!userInfo.petsOwned.includes(pet) && pet !== -1) {
        res.status(201).send("You do now own that pet");
        return;
    }

    userInfo.petEquiped = pet;
    const dbRes = await schemas.Users.replaceOne(filter, userInfo);
    if (!dbRes) {
        res.status(202).send("Db error");
        return;
    }

    res.status(200).send(userInfo);
});

router.post('/buyPet', async (req, res) => {
    const pet = req.body.pet;
    const filter = { username: req.body.username, password: req.body.password };
    const userInfo = await schemas.Users.where(filter).findOne();
    const petInfo = await schemas.Pets.where({ id: pet }).findOne();
    if (!userInfo || !petInfo) {
        res.status(201).send("user or pet does not exist");
        return;
    }

    if (userInfo.petsOwned.includes(pet)) {
        res.status(201).send("Pet already purchased");
        return;
    }

    if (userInfo.money < petInfo.cost) {
        res.status(201).send("Funds are insufficient");
        return;
    }

    if (!userInfo.petsUnlocked.includes(pet)) {
        res.status(201).send("You must unlock this pet before purchasing it");
        return;
    }

    userInfo.petsOwned.push(pet);
    userInfo.money -= petInfo.cost;

    const dbRes = await schemas.Users.replaceOne(filter, userInfo);
    if (!dbRes) {
        res.status(202).send("Db error");
        return;
    }

    res.status(200).send(userInfo);
});

export default router;
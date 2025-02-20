import { Server, Socket } from 'socket.io';
import schemas, { IDatabaseSpell } from '../models/schemas'
import { StateHandler } from './StateHandler';

export default function socketHandler(io: Server): void {
    const stateHandler = new StateHandler(io);

    io.on('connection', (socket: Socket) => {
        // Listen for user list request
        socket.on('getUserList', () => {
            io.emit('onlineUserListUpdate', stateHandler.getOnlineUsers());
        });

        // Listen for requests for a challenger list
        socket.on('getChallengersList', (username: string) => {
            socket.emit('challengersUpdate', stateHandler.getChallengersList(username));
        });

        // User comes online
        socket.on('userOnline', (username: string, password: string) => {
            console.log(`${username} connected`);
            stateHandler.userConnected(username, socket.id, password)
            io.emit('onlineUserListUpdate', stateHandler.getOnlineUsers());
        });

        // User goes offline
        socket.on('userOffline', (username: string) => {
            console.log(`${username} disconnected`);
            stateHandler.userDisconnected(socket.id)
            io.emit('onlineUserListUpdate', stateHandler.getOnlineUsers());
        });

        // User challenges another user
        socket.on('challenge', async (challenger: string, foe: string) => {
            console.log(`${challenger} challenged ${foe}`);
            await stateHandler.challenge(challenger, foe);
        });

        // Cancel a challenge
        socket.on('cancelChallenge', (challenger: string, foe: string) => {
           stateHandler.cancelChallenge(challenger);
        });

        // Handle user disconnecting
        socket.on('disconnect', () => {
            stateHandler.userDisconnected(socket.id);
            io.emit('onlineUserListUpdate', stateHandler.getOnlineUsers());
        });

        // Handles Game Turns 

        socket.on('makeTurn', async (
            username: string, 
            gameRoom: string, 
            spellId: number, 
            manaSpent: number,
            newSpells: Array<number> | null
        ) => {
            const playerTurn = {
                spellId: spellId,
                manaSpent: manaSpent,
                newSpells: newSpells
            }
            const room = stateHandler.getRoom(gameRoom)
            if (room) {
                const turnResponse = await room.takeTurn(username, playerTurn);
                if (turnResponse) {
                    stateHandler.getTimer(gameRoom).start();
                    if (turnResponse[0].winner) {
                        stateHandler.gameOver(gameRoom);
                        if (turnResponse[0].winner !== "tie") {
                            const winnerInfo = await schemas.Users.where({username: turnResponse[0].winner}).findOne();
                            if(winnerInfo) {
                                winnerInfo.money += 10;
                                const res = await schemas.Users.replaceOne({username: turnResponse[0].winner}, winnerInfo);
                            };
                        };
                    }
                    for (const playerResponse of turnResponse) {
                        const playerSocket = stateHandler.getUserSocket(playerResponse.player);
                        io.to(playerSocket).emit('turnResult', playerResponse);
                    }
                }
            }
        })
    });
}

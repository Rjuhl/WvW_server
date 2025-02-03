import { Server, Socket } from 'socket.io';
import { IRooms } from '../resources/interfaces/sockets/IRooms';
import { ISocketUser } from '../resources/interfaces/sockets/ISocketUser';
import { IChallenges } from '../resources/interfaces/sockets/IChallenges';
import { IOnlineUsers } from '../resources/interfaces/sockets/IOnlineUsers';
import { Timer } from './Timer';
import { randomUUID } from 'crypto';
import { GameRoom } from './GameRoom';

export default function socketHandler(io: Server): void {
    const rooms: IRooms = {};
    const timers: Record<string, Timer> = {};
    const onlineUsers: IOnlineUsers = {};
    const socketToUser: ISocketUser = {};
    const userToSocket: ISocketUser = {};
    const challenges: IChallenges = {};
    const passwords: {[username: string]: string} = {};
    const receivedChallenges: IChallenges = {}; // Currently unused 

    const getChallengersList = (username: string) => {
        return (challenges[username]) ? Object.keys(challenges[username]) : [];
    };

    io.on('connection', (socket: Socket) => {
        console.log(`Socket ${socket.id} connected`);

        // Listen for user list request
        socket.on('getUserList', () => {
            io.emit('onlineUserListUpdate', Object.keys(onlineUsers));
        });

        // Listen for requests for a challenger list
        socket.on('getChallengersList', (username: string) => {
            socket.emit('challengersUpdate', getChallengersList(username));
        });

        // User comes online
        socket.on('userOnline', (username: string, password: string) => {
            console.log(`${username} connected`);
            onlineUsers[username] = true;
            socketToUser[socket.id] = username;
            userToSocket[username] = socket.id;
            passwords[username] = password;
            io.emit('onlineUserListUpdate', Object.keys(onlineUsers));
        });

        // User goes offline
        socket.on('userOffline', (username: string) => {
            console.log(`${username} disconnected`);
            delete onlineUsers[username];
            delete socketToUser[socket.id];
            delete userToSocket[username];
            delete passwords[username];
            io.emit('onlineUserListUpdate', Object.keys(onlineUsers));
        });

        // User challenges another user
        socket.on('challenge', async (challenger: string, foe: string) => {
            console.log(`${challenger} challenged ${foe}`);
            // update challanges
            if (!challenges[foe]) challenges[foe] = {};
            challenges[foe][challenger] = true;

            //update recieved challenges
            if (!receivedChallenges[challenger]) receivedChallenges[challenger] = {};
            receivedChallenges[challenger][foe] = true;

            console.log(challenges);
            if (challenges[challenger]?.[foe] && onlineUsers[foe]) {
                console.log("Challenge begins");
                // Create a room and notify both users
                const roomName = `room-${challenger}-${foe}`;
                io.to(userToSocket[challenger]).emit("matchRoom", roomName);
                io.to(userToSocket[foe]).emit("matchRoom", roomName);
                rooms[roomName] = new GameRoom(
                    challenger,
                    passwords[challenger],
                    foe,
                    passwords[foe]
                );
                await rooms[roomName].init();
                const timer = new Timer(
                    roomName,
                    timers,
                    rooms,
                    roomName,
                    challenger,
                    userToSocket[challenger],
                    foe,
                    userToSocket[foe],
                    io
                )
                timers[roomName] = timer;
                timer.start();
                console.log(`Room ${roomName} created between ${challenger} and ${foe}`);

                // Clean up challenges
                delete challenges[challenger][foe];
                delete challenges[foe][challenger];
                delete receivedChallenges[challenger][foe];
                delete receivedChallenges[foe][challenger];
            } else {
                // Notify the foe of a challenge
                if (onlineUsers[foe]) {
                    console.log('Notify foe of challenge');
                    socket.to(userToSocket[foe]).emit("challengersUpdate", getChallengersList(foe));
                    console.log(`${challenger} challenged ${foe}`);
                } else {
                    // If user challenged is offline remove the challenge
                    delete challenges[foe][challenger];
                    delete receivedChallenges[challenger][foe]
                }
               
            }
        });

        // Cancel a challenge
        socket.on('cancelChallenge', (challenger: string, foe: string) => {
            if (challenges[foe]) {
                delete challenges[foe][challenger];
                socket.to(userToSocket[foe]).emit("challengersUpdate", getChallengersList(foe));
                console.log(`${challenger} canceled challenge to ${foe}`);
            }
        });

        // Handle user disconnecting
        socket.on('disconnect', () => {
            const username = socketToUser[socket.id];
            if (username in onlineUsers) {
                console.log(`${username} disconnected`);
                delete onlineUsers[username];
                delete socketToUser[socket.id];
                delete userToSocket[username];
                delete passwords[username];
                io.emit('onlineUserListUpdate', Object.keys(onlineUsers));
            }
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
            if (rooms[gameRoom]) {
                const turnResponse = await rooms[gameRoom].takeTurn(username, playerTurn);
                console.log(`${username} made move in room: ${gameRoom}`);
                if (turnResponse) {
                    timers[gameRoom].start();
                    for (const playerResponse of turnResponse) {
                        console.log(`Emitting message to ${playerResponse.player} with socketid ${userToSocket[playerResponse.player]}`)
                        io.to(userToSocket[playerResponse.player]).emit('turnResult', playerResponse);
                        if (playerResponse.winner) {
                            io.to(userToSocket[playerResponse.player]).emit('winner', playerResponse.winner);
                        }
                    }
                    if (turnResponse[0].winner) {
                        delete rooms[gameRoom];
                        timers[gameRoom].deleteSelf();
                    }
                }
            }
        })
    });
}

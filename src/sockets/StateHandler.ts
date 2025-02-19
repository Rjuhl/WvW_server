import { IRooms } from '../resources/interfaces/sockets/IRooms';
import { ISocketUser } from '../resources/interfaces/sockets/ISocketUser';
import { IChallenges } from '../resources/interfaces/sockets/IChallenges';
import { IOnlineUsers } from '../resources/interfaces/sockets/IOnlineUsers';
import { Timer } from './Timer';
import { randomUUID } from 'crypto';
import { GameRoom } from './GameRoom';
import { IUserToGame, IGameToUser } from '../resources/interfaces/sockets/IUserToGame';

export class StateHandler {
    private rooms: IRooms = {};
    private timers: Record<string, Timer> = {};
    private onlineUsers: IOnlineUsers = {};
    private socketToUser: ISocketUser = {};
    private userToSocket: ISocketUser = {};
    private challenges: IChallenges = {};
    private challengers: IChallenges = {};
    private userToGame: IUserToGame = {};
    private gameToUser: IGameToUser = {};
    private passwords: {[username: string]: string} = {};
    private io: any;

    constructor(io: any) {
        // Only for SENDING message NOT FOR LISTINING
        this.io = io;
    }

    private sendMessage(user: string, message: string, messageBody: any) {
        this.io.to(this.userToSocket[user]).emit(message, messageBody);
    }

    private updateSocket(user: string, socket: string) {
        if (this.userToGame.hasOwnProperty(user) && this.timers[this.userToGame[user]]) {
            this.timers[this.userToGame[user]].updateUserSocket(user, socket);
        }
    };

    public cancelChallenge(user: string) {
        if (this.challenges[user]) {
            for (const foe of Object.keys(this.challenges[user])) {
                delete this.challenges[user];
                if (this.onlineUsers[foe]) {
                    this.sendMessage(foe, "challengersUpdate", this.getChallengersList(foe));
                }
            }
        }
    }

    public userConnected(user: string, socket: string, password: string) {
        this.onlineUsers[user] = true;
        this.socketToUser[socket] = user;
        this.userToSocket[user] = socket;
        this.passwords[user] = password;
        this.updateSocket(user, socket);
    }

    public userDisconnected(socket: string) {
        const user = this.socketToUser[socket];
        if (user in this.onlineUsers) {
            delete this.onlineUsers[user];
            delete this.socketToUser[socket];
            delete this.userToSocket[user];
            delete this.passwords[user];
        }

        // Delete all their challenges
       this.cancelChallenge(user);

    }

    public async challenge(from: string, to: string) {
        // Update Challenge Data Structures
        if (!this.challenges[from]) this.challenges[from] = {}
        if (!this.challengers[to]) this.challengers[to] = {}
        this.challenges[from][to] = true;
        this.challengers[to][from] = true;

        // Check to see if there is already a challenge from 'to'
        if (this.challenges[to]?.[from] && this.onlineUsers[to]) {
            // Create Room
            const roomName = `room-${from}-${to}-${randomUUID()}`;
            this.sendMessage(from, "matchRoom", roomName);
            this.sendMessage(to, "matchRoom", roomName);
            this.rooms[roomName] = new GameRoom(
                from, this.passwords[from],
                to, this.passwords[to]
            );
            await this.rooms[roomName].init();
            this.userToGame[from] = roomName;
            this.userToGame[to] = roomName;
            this.gameToUser[roomName] = [from, to];
            
            // Start Game Timer
            const timer = new Timer(
                roomName, this.timers, this.rooms, roomName,
                from, this.userToSocket[from],
                to, this.userToSocket[to],
                this, this.io
            );
            this.timers[roomName] = timer;
            timer.start();

            // Clean up challenge objects
            delete this.challenges[from][to];
            delete this.challenges[to][from];
            delete this.challengers[from][to];
            delete this.challengers[to][from];

        } else {
            // Send message to user challenged that they were challenged
            if (this.onlineUsers[to]) {
                this.sendMessage(to, "challengersUpdate", this.getChallengersList(to));
            }
        }
    }

    public getOnlineUsers() {
        return Object.keys(this.onlineUsers)
    }

    public getChallengersList(user: string) {
        return (this.challengers[user]) ? Object.keys(this.challengers[user]) : [];
    }

    public getRoom(name: string) {
        return this.rooms[name];
    }

    public getTimer(name: string) {
        return this.timers[name];
    }

    public getUserSocket(user: string) {
        return this.userToSocket[user];
    }

    public gameOver(name: string) {
        this.timers[name].deleteSelf();
        delete this.rooms[name];
        const [from, to] = this.gameToUser[name];
        delete this.userToGame[from];
        delete this.userToGame[to];
        delete this.gameToUser[name];
    }
}

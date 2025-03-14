import { IRooms } from "../resources/interfaces/sockets/IRooms";
import schemas, { IDatabaseSpell } from '../models/schemas'
import { StateHandler } from "./StateHandler";

export class Timer {
    private id: string;
    private parent: Record<string, Timer>;
    private intervalId?: NodeJS.Timeout;
    private countDownIntervalId?: NodeJS.Timeout;
    private rooms: IRooms;
    private roomName: string;
    private player1Username: string;
    private player1SocketId: string;
    private player2Username: string;
    private player2SocketId: string;
    private io: any;
    private duration: number = 1000 * 60 * 2;
    private currentCount: number;
    private prevLedgerSize = 0;
    private stateHandler: StateHandler;

    constructor(
        id: string, 
        parent: Record<string, Timer>,
        rooms: IRooms,
        roomName: string,
        player1Username: string,
        player1SocketId: string,
        player2Username: string,
        player2SocketId: string,
        stateHandler: StateHandler,
        io: any
    ) {
        this.rooms = rooms;
        this.roomName = roomName;
        this.player1Username = player1Username;
        this.player1SocketId = player1SocketId;
        this.player2Username = player2Username;
        this.player2SocketId = player2SocketId;
        this.io = io;
        this.currentCount = this.duration / 1000;
        this.stateHandler = stateHandler;

        this.id = id;
        this.parent = parent;
        parent[id] = this;
    }

    public deleteSelf() {
        clearInterval(this.intervalId);
        clearInterval(this.countDownIntervalId);
        delete this.parent[this.id];
    }

    private countDownTask() {
        this.currentCount -= 1
        this.io.to(this.player1SocketId).volatile.emit("clock", this.currentCount);
        this.io.to(this.player2SocketId).volatile.emit("clock", this.currentCount);
    }

    private async executeTask() {
        if (!this.rooms[this.roomName] || this.rooms[this.roomName].gameOver()) {
            this.deleteSelf();
            return;
        }
        if (this.prevLedgerSize <= this.rooms[this.roomName].getLedger().length) {
            const winner = this.rooms[this.roomName].getTimeOutWinner();
            this.io.to(this.player1SocketId).emit("winner", winner);
            this.io.to(this.player2SocketId).emit("winner", winner);
            
            const winnerInfo = await schemas.Users.where({username: winner}).findOne();
                if(winnerInfo) {
                    winnerInfo.money += 10;
                    const res = await schemas.Users.replaceOne({username: winner}, winnerInfo);
                };
            
            this.stateHandler.gameOver(this.roomName);
            this.deleteSelf();
            return;
        }
    }

    public updateUserSocket(user: string, socket: string) {
        (user === this.player1Username) ? this.player1SocketId = socket : this.player2SocketId = socket;
    }

    public start() {
        if (this.intervalId) clearInterval(this.intervalId);
        if (this.countDownIntervalId) clearInterval(this.countDownIntervalId);
        this.currentCount = this.duration / 1000;
        this.prevLedgerSize = this.rooms[this.roomName].getLedger().length;
        this.intervalId = setInterval(() => {
            this.executeTask();
        }, this.duration);
        this.countDownIntervalId = setInterval(() => {
            this.countDownTask();
        }, 1000)
    }
}
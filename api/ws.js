import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { createGameRoom } from '../server/game-room.js';

const room = createGameRoom();
const server = createServer();
const websocketServer = new WebSocketServer({ server });
websocketServer.on('connection', (socket) => room.attach(socket));

export default server;

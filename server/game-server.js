import { createServer } from 'node:http';
import { existsSync, readFile, statSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { WebSocketServer } from 'ws';
import { createGameRoom } from './game-room.js';
import { loadPersistentLocalWorldStartedAt } from './local-world-clock.js';

const port = Number(process.env.BIBISH_GAME_PORT || 8787);
const host = process.env.BIBISH_GAME_HOST || '0.0.0.0';
const staticRoot = process.env.BIBISH_STATIC_DIR ? resolve(process.env.BIBISH_STATIC_DIR) : null;
const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'],
  ['.mp3', 'audio/mpeg'],
  ['.ogg', 'audio/ogg'],
  ['.wasm', 'application/wasm'],
]);
const room = createGameRoom({ worldStartedAt: loadPersistentLocalWorldStartedAt() });
const server = createServer((request, response) => {
  if (request.url === '/health' || request.url === '/metrics') {
    response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    response.end(JSON.stringify({ ok: true, ...room.getMetrics() }));
    return;
  }
  if (staticRoot && request.method === 'GET') {
    const pathname = new URL(request.url, 'http://bibish.local').pathname;
    const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
    let filePath = resolve(staticRoot, relative);
    if (filePath !== staticRoot && !filePath.startsWith(`${staticRoot}${sep}`)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    if (!existsSync(filePath) || !statSync(filePath).isFile()) filePath = resolve(staticRoot, 'index.html');
    readFile(filePath, (error, contents) => {
      if (error) {
        response.writeHead(404).end('Not found');
        return;
      }
      const immutable = pathname.startsWith('/assets/');
      response.writeHead(200, {
        'content-type': contentTypes.get(extname(filePath).toLowerCase()) || 'application/octet-stream',
        'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
        'x-content-type-options': 'nosniff',
      });
      response.end(contents);
    });
    return;
  }
  response.writeHead(404).end('Not found');
});
const websocketServer = new WebSocketServer({ noServer: true });
websocketServer.on('connection', (socket) => room.attach(socket));
server.on('upgrade', (request, socket, head) => {
  if (request.url !== '/ws') {
    socket.destroy();
    return;
  }
  websocketServer.handleUpgrade(request, socket, head, (client) => websocketServer.emit('connection', client, request));
});
server.listen(port, host, () => {
  console.log(`Bibish realtime server listening on ws://${host}:${port}/ws`);
});

function shutdown() {
  room.close();
  websocketServer.close();
  server.close();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

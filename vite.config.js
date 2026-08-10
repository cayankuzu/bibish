import { defineConfig } from 'vite';
import { WebSocketServer } from 'ws';
import { createGameRoom } from './server/game-room.js';

function localMultiplayer() {
  return {
    name: 'bibish-local-multiplayer',
    apply: 'serve',
    configureServer(server) {
      const room = createGameRoom();
      const websocketServer = new WebSocketServer({ noServer: true });
      websocketServer.on('connection', (socket) => room.attach(socket));

      const handleUpgrade = (request, socket, head) => {
        let pathname;
        try {
          pathname = new URL(request.url || '/', 'http://localhost').pathname;
        } catch {
          return;
        }
        if (pathname !== '/ws') return;
        websocketServer.handleUpgrade(request, socket, head, (client) => {
          websocketServer.emit('connection', client, request);
        });
      };

      server.httpServer?.on('upgrade', handleUpgrade);
      server.middlewares.use('/__bibish/metrics', (_request, response) => {
        response.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        });
        response.end(JSON.stringify({ ok: true, ...room.getMetrics() }));
      });

      server.httpServer?.once('close', () => {
        server.httpServer?.off('upgrade', handleUpgrade);
        room.close();
        websocketServer.close();
      });
    },
  };
}

export default defineConfig({
  plugins: [localMultiplayer()],
  // Windows' app sandbox can block esbuild's dependency pre-bundler from
  // opening packages under Desktop. Three.js is already native ESM, so it can
  // be served directly without that optimization step.
  optimizeDeps: {
    noDiscovery: true,
    include: [],
  },
  server: {
    host: '0.0.0.0',
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
        },
      },
    },
  },
});

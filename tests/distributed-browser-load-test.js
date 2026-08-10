import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer as createNetServer } from 'node:net';
import { chromium } from 'playwright';

const freePort = () => new Promise((resolve, reject) => {
  const server = createNetServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const { port } = server.address();
    server.close(() => resolve(port));
  });
});

const CLIENTS = 100;
const GAME_PORT = Number(process.env.TEST_GAME_PORT || await freePort());
const VITE_PORT = Number(process.env.TEST_VITE_PORT || await freePort());
const BASE_URL = `http://127.0.0.1:${VITE_PORT}`;
const WS_URL = `ws://127.0.0.1:${GAME_PORT}/ws`;
const children = [];
const contexts = [];
const errors = [];
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const percentile = (values, ratio) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))] ?? null;
};

function start(args, extraEnv = {}) {
  const child = spawn(process.execPath, args, { cwd: process.cwd(), env: { ...process.env, ...extraEnv }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  child.stdout.on('data', (data) => process.stdout.write(`[service] ${data}`));
  child.stderr.on('data', (data) => process.stderr.write(`[service] ${data}`));
  children.push(child);
}

async function waitFor(url, predicate = () => true, timeout = 60000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json().catch(() => null);
        if (predicate(data)) return data;
      }
    } catch {}
    await wait(250);
  }
  throw new Error(`Timeout waiting for ${url}`);
}

async function createProtocolClient(browser, index, team) {
  const context = await browser.newContext();
  contexts.push(context);
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push({ index, message: error.message }));
  await page.setContent('<!doctype html><title>Bibish load client</title><p>Connected player</p>');
  await page.evaluate(({ wsUrl, clientIndex, preferredTeam }) => {
    const metrics = globalThis.__protocolMetrics = { connected: false, snapshots: 0, players: 0, totalPlayers: 0, latency: null, team: null };
    const socket = new WebSocket(wsUrl);
    socket.addEventListener('open', () => {
      metrics.connected = true;
      socket.send(JSON.stringify({
        type: 'join', clientId: `browser-load-${clientIndex}`, name: `Browser-${String(clientIndex).padStart(3, '0')}`,
        team: preferredTeam, countryCode: clientIndex % 2 ? 'US' : 'TR',
      }));
      let phase = clientIndex * 0.17;
      const tick = () => {
        if (socket.readyState !== WebSocket.OPEN) return;
        phase += 0.08;
        const homeZ = preferredTeam === 'red' ? -260 : 260;
        socket.send(JSON.stringify({
          type: 'state', x: (clientIndex % 25 - 12) * 4 + Math.sin(phase) * 8, y: 8,
          z: homeZ + Math.cos(phase) * 14, yaw: phase, pitch: 0, stance: 'stand', weapon: 0,
          mode: 0, shieldActive: false, health: 100, score: clientIndex * 10, kills: 0,
          deaths: 0, elapsedSeconds: phase, phase, action: 0, dead: false,
        }));
      };
      tick();
      setInterval(tick, 84);
      setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'ping', sentAt: performance.now() }));
      }, 2000);
    });
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'welcome') metrics.team = message.team;
      if (message.type === 'snapshot') {
        metrics.snapshots += 1;
        metrics.players = message.players.length;
        metrics.totalPlayers = Number(message.totalPlayers) || 0;
      }
      if (message.type === 'pong') metrics.latency = performance.now() - message.sentAt;
    });
    socket.addEventListener('close', () => { metrics.connected = false; });
  }, { wsUrl: WS_URL, clientIndex: index, preferredTeam: team });
  await page.waitForFunction(() => globalThis.__protocolMetrics.connected, null, { timeout: 30000 });
  return page;
}

let browser;
try {
  start(['server/game-server.js'], { BIBISH_GAME_PORT: String(GAME_PORT), BIBISH_ALLOW_FULL_ROSTER: '1' });
  start(['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(VITE_PORT), '--strictPort']);
  await Promise.all([waitFor(`http://127.0.0.1:${GAME_PORT}/health`), waitFor(BASE_URL)]);

  const chromePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  browser = await chromium.launch({
    headless: true,
    executablePath: chromePaths.find(existsSync),
    args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
  });

  const fullContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  contexts.push(fullContext);
  await fullContext.addInitScript(() => localStorage.setItem('bibish-graphics', JSON.stringify({ mode: 'performance', dynamicResolution: true, showStats: true })));
  const fullPage = await fullContext.newPage();
  fullPage.on('pageerror', (error) => errors.push({ index: 0, message: error.message }));
  await fullPage.goto(`${BASE_URL}/?stressFullRoster=1&ws=${encodeURIComponent(WS_URL)}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await fullPage.waitForFunction(() => Boolean(globalThis.__bibishDebug?.joinLoadTest), null, { timeout: 120000 });
  await fullPage.evaluate(() => {
    globalThis.__bibishDebug.joinLoadTest('red', 0);
    globalThis.__motion = setInterval(() => globalThis.__bibishDebug.stepLoadTestMotion(0, performance.now()), 50);
  });

  const order = [...new Set(Array.from({ length: 50 }, (_, index) => [index + 1, index + 50]).flat().filter((index) => index < CLIENTS))];
  const protocolPages = [];
  for (let offset = 0; offset < order.length; offset += 10) {
    protocolPages.push(...await Promise.all(order.slice(offset, offset + 10).map((index) => createProtocolClient(browser, index, index < 50 ? 'red' : 'blue'))));
  }
  const serverReady = await waitFor(`http://127.0.0.1:${GAME_PORT}/metrics`, (metrics) => metrics?.players === CLIENTS && metrics?.teams?.red === 50 && metrics?.teams?.blue === 50, 90000);
  await fullPage.waitForFunction((expected) => globalThis.__bibishDebug.getLoadMetrics().total === expected, CLIENTS - 1, { timeout: 90000 });
  await wait(15000);

  const full = await fullPage.evaluate(() => ({
    renderer: globalThis.__bibishDebug.getRendererMetrics(),
    load: globalThis.__bibishDebug.getLoadMetrics(),
    network: globalThis.__bibishDebug.getNetworkMetrics(),
  }));
  const protocol = await Promise.all(protocolPages.map((page) => page.evaluate(() => globalThis.__protocolMetrics)));
  const latencies = protocol.map((metrics) => metrics.latency).filter(Number.isFinite);
  const result = {
    isolatedBrowserContexts: contexts.length,
    fullGameClients: 1,
    protocolBrowserClients: protocolPages.length,
    teams: serverReady.teams,
    serverPlayers: serverReady.players,
    serverRssMiB: Math.round(serverReady.memory.rss / 1024 / 1024),
    fullClient: {
      remotePlayers: full.load.total,
      fps: full.renderer.measuredFps,
      drawCalls: full.renderer.calls,
      triangles: full.renderer.triangles,
      latencyMs: full.network.latencyMs,
    },
    protocolClients: {
      connected: protocol.filter((metrics) => metrics.connected).length,
      worldCountComplete: protocol.filter((metrics) => metrics.totalPlayers === CLIENTS).length,
      visiblePlayersMax: Math.max(...protocol.map((metrics) => metrics.players)),
      latencyMedianMs: percentile(latencies, 0.5),
      latencyP95Ms: percentile(latencies, 0.95),
    },
    errors,
  };
  result.passed = result.isolatedBrowserContexts === CLIENTS && result.serverPlayers === CLIENTS && result.fullClient.remotePlayers === CLIENTS - 1 && result.protocolClients.connected === CLIENTS - 1 && result.protocolClients.worldCountComplete === CLIENTS - 1 && result.protocolClients.visiblePlayersMax <= 32 && errors.length === 0;
  process.stdout.write(`BIBISH_DISTRIBUTED_LOAD_RESULT ${JSON.stringify(result)}\n`);
  if (!result.passed) process.exitCode = 1;
} catch (error) {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
} finally {
  for (const context of contexts) await context.close().catch(() => {});
  await browser?.close().catch(() => {});
  for (const child of children) child.kill();
}

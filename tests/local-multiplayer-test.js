import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer as createNetServer } from 'node:net';
import { chromium } from 'playwright';

const CLIENT_COUNT = 5;
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const freePort = () => new Promise((resolve, reject) => {
  const server = createNetServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const { port } = server.address();
    server.close(() => resolve(port));
  });
});

async function waitForJson(url, predicate = () => true, timeout = 60000) {
  const startedAt = Date.now();
  let lastValue = null;
  while (Date.now() - startedAt < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const value = await response.json();
        lastValue = value;
        if (predicate(value)) return value;
      }
    } catch {}
    await wait(200);
  }
  throw new Error(`Timed out waiting for ${url}; last value: ${JSON.stringify(lastValue)}`);
}

const port = await freePort();
const baseUrl = `http://127.0.0.1:${port}`;
const vite = spawn(process.execPath, [
  'node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort',
], {
  cwd: process.cwd(),
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});
const serviceOutput = [];
vite.stdout.on('data', (chunk) => serviceOutput.push(String(chunk)));
vite.stderr.on('data', (chunk) => serviceOutput.push(String(chunk)));

let browser;
let context;
const pageErrors = [];

try {
  await waitForJson(`${baseUrl}/__bibish/metrics`, (value) => value.ok && value.roomId === 'global');
  const executablePath = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean).find(existsSync);
  browser = await chromium.launch({
    headless: true,
    executablePath,
    args: [
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--disable-features=CalculateNativeWinOcclusion',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
    ],
  });
  context = await browser.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
  await context.addInitScript(() => {
    localStorage.setItem('bibish-graphics', JSON.stringify({ mode: 'performance', dynamicResolution: true, showStats: true }));
    localStorage.setItem('bibish-audio-volume-v1', '0');
  });

  const pages = await Promise.all(Array.from({ length: CLIENT_COUNT }, async (_, index) => {
    const page = await context.newPage();
    page.on('pageerror', (error) => pageErrors.push({ index, type: 'pageerror', message: error.message }));
    page.on('console', (message) => {
      if (message.type() === 'error') pageErrors.push({ index, type: 'console', message: message.text() });
    });
    await page.goto(`${baseUrl}/?localLobbyTest=${index}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => Boolean(globalThis.__bibishDebug?.joinLoadTest), null, { timeout: 120000 });
    const team = index % 2 === 0 ? 'red' : 'blue';
    const joined = await page.evaluate(({ teamName, clientIndex }) => {
      return globalThis.__bibishDebug.joinLoadTest(teamName, clientIndex);
    }, { teamName: team, clientIndex: index });
    if (!joined.spawned) throw new Error(`Browser tab ${index + 1} could not spawn`);
    return page;
  }));

  // Put every real browser client in the same interest-management cell. This
  // proves that each tab not only receives the global count, but also creates
  // and renders the other tabs' network avatars when they are in view range.
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await Promise.all(pages.map((page) => page.evaluate(() => {
      globalThis.__bibishDebug.stepLoadTestGameplay(0, 0);
    })));
    await wait(120);
  }

  const server = await waitForJson(
    `${baseUrl}/__bibish/metrics`,
    (value) => value.players === CLIENT_COUNT && Math.abs(value.teams.red - value.teams.blue) <= 1,
    30000,
  );
  await Promise.all(pages.map((page) => page.waitForFunction((expected) => {
    return globalThis.__bibishDebug?.getNetworkMetrics()?.serverPlayerCount === expected;
  }, CLIENT_COUNT, { timeout: 30000 })));
  const observedRemotePlayers = await Promise.all(pages.map((page) => page.waitForFunction(() => {
    return globalThis.__bibishDebug?.getLoadMetrics()?.total >= 1;
  }, null, { timeout: 30000 }).then(() => true)));
  await Promise.all(pages.map((page) => page.waitForFunction(() => {
    const flags = [...document.querySelectorAll('#leaderboard img.country-flag')];
    return flags.length > 0 && flags.every((flag) => flag.complete && flag.naturalWidth > 0);
  }, null, { timeout: 30000 })));

  const networkIds = await Promise.all(pages.map((page) => page.evaluate(() => globalThis.__bibishDebug.getNetworkMetrics().clientId)));
  const testPositions = await Promise.all(pages.map((page) => page.evaluate(() => globalThis.__bibishDebug.prepareNetworkEventTest(0, 0))));
  await wait(700);
  const sharedBefore = await Promise.all(pages.map((page) => page.evaluate(() => globalThis.__bibishDebug.getSharedGameState())));
  const attackerIndex = 0;
  const victimIndex = sharedBefore.findIndex((entry) => entry.team !== sharedBefore[attackerIndex].team);
  if (victimIndex < 0) throw new Error('No opposing team client was available for the shared damage test.');
  await pages[attackerIndex].evaluate(({ targetId, point }) => {
    globalThis.__bibishDebug.paintNetworkTest(point.x, point.y, point.z, 'pee', 0.5);
    globalThis.__bibishDebug.sendNetworkEvent({ kind: 'damage', targetId, weapon: 'rifle', zone: 'torso' });
  }, { targetId: networkIds[victimIndex], point: testPositions[attackerIndex] });
  await pages[victimIndex].waitForFunction(() => globalThis.__bibishDebug.getSharedGameState().health === 62, null, { timeout: 15000 });
  await Promise.all(pages.map((page, index) => page.waitForFunction((before) => {
    const current = globalThis.__bibishDebug.getSharedGameState();
    return current.lastNetworkEventId >= 2 && (current.redPaint > before.redPaint || current.bluePaint > before.bluePaint);
  }, sharedBefore[index], { timeout: 15000 })));
  const sharedAfter = await Promise.all(pages.map((page) => page.evaluate(() => globalThis.__bibishDebug.getSharedGameState())));

  const clients = await Promise.all(pages.map((page, index) => page.evaluate((clientIndex) => ({
    index: clientIndex,
    network: globalThis.__bibishDebug.getNetworkMetrics(),
    renderedRemotePlayers: globalThis.__bibishDebug.getLoadMetrics().total,
    loadedLeaderboardFlags: [...document.querySelectorAll('#leaderboard img.country-flag')]
      .filter((flag) => flag.complete && flag.naturalWidth > 0).length,
  }), index).then((client) => ({ ...client, observedRemotePlayers: observedRemotePlayers[index] }))));
  const roomIds = new Set(clients.map((client) => client.network.roomId));
  const instanceIds = new Set(clients.map((client) => client.network.serverInstanceId));
  const result = {
    passed: pageErrors.length === 0
      && server.players === CLIENT_COUNT
      && Math.abs(server.teams.red - server.teams.blue) <= 1
      && roomIds.size === 1
      && roomIds.has('global')
      && instanceIds.size === 1
      && clients.every((client) => client.network.connected)
      && clients.every((client) => client.network.serverPlayerCount === CLIENT_COUNT)
      && clients.every((client) => client.observedRemotePlayers)
      && clients.every((client) => client.loadedLeaderboardFlags >= 1),
    url: baseUrl,
    tabs: CLIENT_COUNT,
    server: {
      players: server.players,
      teams: server.teams,
      roomId: server.roomId,
      instanceId: server.instanceId,
      droppedSnapshots: server.droppedSnapshots,
    },
    clients: clients.map((client) => ({
      index: client.index,
      connected: client.network.connected,
      serverPlayerCount: client.network.serverPlayerCount,
      roomId: client.network.roomId,
      instanceId: client.network.serverInstanceId,
      renderedRemotePlayers: client.renderedRemotePlayers,
      observedRemotePlayers: client.observedRemotePlayers,
      loadedLeaderboardFlags: client.loadedLeaderboardFlags,
    })),
    sharedEvents: {
      victimIndex,
      victimHealth: sharedAfter[victimIndex].health,
      eventIds: sharedAfter.map((entry) => entry.lastNetworkEventId),
      paintChanged: sharedAfter.map((entry, index) => entry.redPaint > sharedBefore[index].redPaint || entry.bluePaint > sharedBefore[index].bluePaint),
      leaderboardSizes: sharedAfter.map((entry) => entry.leaders),
    },
    errors: pageErrors,
  };
  process.stdout.write(`BIBISH_LOCAL_MULTIPLAYER_RESULT ${JSON.stringify(result)}\n`);
  if (!result.passed) process.exitCode = 1;
} catch (error) {
  process.stderr.write(`${error.stack || error}\n${serviceOutput.join('')}\n`);
  process.exitCode = 1;
} finally {
  await context?.close().catch(() => {});
  await browser?.close().catch(() => {});
  vite.kill();
}

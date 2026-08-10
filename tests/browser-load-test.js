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

const clientCount = Math.max(2, Number(process.env.CLIENTS || 100));
const redTarget = Math.floor(clientCount / 2);
const durationMs = Math.max(5000, Number(process.env.DURATION_MS || 20000));
const testGamePort = Number(process.env.TEST_GAME_PORT || await freePort());
const testVitePort = Number(process.env.TEST_VITE_PORT || await freePort());
const baseUrl = process.env.BIBISH_URL || `http://127.0.0.1:${testVitePort}`;
const testWsUrl = process.env.BIBISH_WS_URL || `ws://127.0.0.1:${testGamePort}/ws`;
const ownsServers = !process.env.BIBISH_URL;
const children = [];
const browsers = [];
const contexts = [];
const pages = [];
const errors = [];

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const percentile = (values, ratio) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
};

async function waitForHttp(url, timeout = 60000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {}
    await wait(250);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function start(command, args, extraEnv = {}) {
  const child = spawn(command, args, { cwd: process.cwd(), env: { ...process.env, ...extraEnv }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  child.stdout.on('data', (data) => process.stdout.write(`[service] ${data}`));
  child.stderr.on('data', (data) => process.stderr.write(`[service] ${data}`));
  children.push(child);
  return child;
}

async function launchBrowser() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean);
  const executablePath = candidates.find(existsSync);
  const options = {
    headless: true,
    executablePath,
    args: [
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--disable-features=CalculateNativeWinOcclusion',
      '--disable-dev-shm-usage',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
    ],
  };
  const browser = await chromium.launch(options);
  browsers.push(browser);
  return browser;
}

async function inBatches(items, size, callback) {
  const results = [];
  for (let offset = 0; offset < items.length; offset += size) {
    const batch = items.slice(offset, offset + size);
    results.push(...await Promise.all(batch.map(callback)));
  }
  return results;
}

async function createClient(browser, index) {
  const team = index < redTarget ? 'red' : 'blue';
  const context = await browser.newContext({
    viewport: { width: 640, height: 360 },
    deviceScaleFactor: 1,
    locale: index % 2 ? 'en-US' : 'tr-TR',
  });
  contexts.push(context);
  await context.addInitScript(() => {
    localStorage.setItem('bibish-graphics', JSON.stringify({ mode: 'performance', dynamicResolution: true, showStats: true }));
    localStorage.setItem('bibish-audio-volume-v1', '0');
  });
  const page = await context.newPage();
  pages.push(page);
  page.on('pageerror', (error) => errors.push({ index, kind: 'pageerror', message: error.message }));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push({ index, kind: 'console', message: message.text() });
  });
  await page.goto(`${baseUrl}/?loadtest=${index}&ws=${encodeURIComponent(testWsUrl)}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => Boolean(globalThis.__bibishDebug?.joinLoadTest), null, { timeout: 120000 });
  const joined = await page.evaluate(({ teamName, clientIndex }) => {
    const result = globalThis.__bibishDebug.joinLoadTest(teamName, clientIndex);
    globalThis.__bibishLoadMotion = setInterval(() => globalThis.__bibishDebug.stepLoadTestMotion(clientIndex, performance.now()), 50);
    return result;
  }, { teamName: team, clientIndex: index });
  if (!joined.spawned) throw new Error(`Client ${index} could not spawn`);
  return { index, team, page };
}

async function sampleClients(clients) {
  return inBatches(clients, 10, async ({ index, team, page }) => {
    try {
      const metrics = await page.evaluate(() => ({
        load: globalThis.__bibishDebug.getLoadMetrics(),
        renderer: globalThis.__bibishDebug.getRendererMetrics(),
        network: globalThis.__bibishDebug.getNetworkMetrics(),
        memory: performance.memory ? {
          used: performance.memory.usedJSHeapSize,
          total: performance.memory.totalJSHeapSize,
        } : null,
      }));
      return { index, team, ...metrics };
    } catch (error) {
      errors.push({ index, kind: 'sample', message: error.message });
      return { index, team, failed: true };
    }
  });
}

async function cleanup() {
  for (const context of contexts) await context.close().catch(() => {});
  for (const browser of browsers) await browser.close().catch(() => {});
  for (const child of children) child.kill();
}

try {
  if (ownsServers) {
    start(process.execPath, ['server/game-server.js'], { BIBISH_GAME_PORT: String(testGamePort) });
    start(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(testVitePort), '--strictPort']);
    await Promise.all([
      waitForHttp(`http://127.0.0.1:${testGamePort}/health`),
      waitForHttp(baseUrl),
    ]);
  }

  const browser = await launchBrowser();
  const indexes = Array.from({ length: Math.max(redTarget, clientCount - redTarget) }, (_, index) => [index, redTarget + index])
    .flat()
    .filter((index) => index < clientCount);
  const clients = [];
  const startedAt = Date.now();
  for (let offset = 0; offset < indexes.length; offset += 5) {
    clients.push(...await Promise.all(indexes.slice(offset, offset + 5).map((index) => createClient(browser, index))));
    const serverMetrics = ownsServers ? await fetch(`http://127.0.0.1:${testGamePort}/metrics`).then((response) => response.json()) : null;
    process.stdout.write(`Connected ${clients.length}/${clientCount}${serverMetrics ? ` · red ${serverMetrics.teams.red} blue ${serverMetrics.teams.blue}` : ''}\n`);
  }

  const connectedAt = Date.now();
  await wait(durationMs);
  const samples = await sampleClients(clients);
  const server = ownsServers ? await fetch(`http://127.0.0.1:${testGamePort}/metrics`).then((response) => response.json()) : null;
  const successful = samples.filter((sample) => !sample.failed);
  const fpsValues = successful.map((sample) => Number(sample.renderer?.measuredFps)).filter(Number.isFinite);
  const latencyValues = successful.map((sample) => Number(sample.network?.latencyMs)).filter(Number.isFinite);
  const remoteCounts = successful.map((sample) => Number(sample.load?.total)).filter(Number.isFinite);
  const serverPlayerCounts = successful.map((sample) => Number(sample.network?.serverPlayerCount)).filter(Number.isFinite);
  const heapValues = successful.map((sample) => Number(sample.memory?.used)).filter(Number.isFinite);
  const result = {
    requestedClients: clientCount,
    loadedClients: clients.length,
    isolatedBrowserContexts: contexts.length,
    teams: server?.teams || null,
    serverPlayers: server?.players ?? null,
    launchMs: connectedAt - startedAt,
    sustainedMs: durationMs,
    server: server ? {
      inboundMessages: server.inboundMessages,
      outboundMessages: server.outboundMessages,
      snapshots: server.snapshots,
      snapshotHz: server.snapshotHz,
      rssMiB: Math.round(server.memory.rss / 1024 / 1024),
    } : null,
    client: {
      sampled: successful.length,
      visibleRemotePlayersMin: remoteCounts.length ? Math.min(...remoteCounts) : null,
      visibleRemotePlayersMedian: percentile(remoteCounts, 0.5),
      visibleRemotePlayersMax: remoteCounts.length ? Math.max(...remoteCounts) : null,
      serverPlayerCountMedian: percentile(serverPlayerCounts, 0.5),
      fpsMedian: percentile(fpsValues, 0.5),
      fpsP10: percentile(fpsValues, 0.1),
      latencyMedianMs: percentile(latencyValues, 0.5),
      latencyP95Ms: percentile(latencyValues, 0.95),
      totalJsHeapMiB: heapValues.length ? Math.round(heapValues.reduce((sum, value) => sum + value, 0) / 1024 / 1024) : null,
    },
    errors: errors.slice(0, 50),
    passed: clients.length === clientCount && server?.players === clientCount && server?.teams.red === redTarget && server?.teams.blue === clientCount - redTarget && successful.length === clientCount && errors.length === 0 && serverPlayerCounts.every((count) => count === clientCount) && remoteCounts.every((count) => count <= 32),
  };
  process.stdout.write(`BIBISH_LOAD_TEST_RESULT ${JSON.stringify(result)}\n`);
  if (!result.passed) process.exitCode = 1;
} catch (error) {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
} finally {
  await cleanup();
}

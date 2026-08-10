import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createServer as createNetServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { chromium, firefox, webkit } from 'playwright';

const provider = process.argv.includes('--browserstack') ? 'browserstack' : 'local';
const requestedClients = Math.max(2, Number(process.env.BROWSER_CLIENTS || (provider === 'browserstack' ? 2000 : 6)));
const durationMs = Math.max(10000, Number(process.env.DURATION_MS || 30000));
const launchParallelism = Math.max(1, Number(process.env.LAUNCH_PARALLELISM || (provider === 'browserstack' ? requestedClients : 3)));
const fpsTarget = Math.max(1, Number(process.env.FPS_TARGET || 55));
const reportPath = resolve(process.env.REPORT_PATH || 'test-results/latest-real-browser-report.json');
const ownsServices = provider === 'local' && !process.env.BIBISH_URL;
const children = [];
const sessions = [];
const errors = [];

const PROFILES = [
  { id: 'win-chrome-1080p', engine: 'chromium', browser: 'chrome', os: 'Windows', osVersion: '11', viewport: { width: 1920, height: 1080 }, dpr: 1, cpu: 8, memory: 8 },
  { id: 'win-firefox-768p', engine: 'firefox', browser: 'playwright-firefox', os: 'Windows', osVersion: '11', viewport: { width: 1366, height: 768 }, dpr: 1, cpu: 4, memory: 4 },
  { id: 'mac-webkit-900p', engine: 'webkit', browser: 'playwright-webkit', os: 'OS X', osVersion: 'Sequoia', viewport: { width: 1440, height: 900 }, dpr: 1, cpu: 8, memory: 8 },
  { id: 'win-edge-1440p', engine: 'chromium', browser: 'edge', os: 'Windows', osVersion: '11', viewport: { width: 2560, height: 1440 }, dpr: 1, cpu: 12, memory: 16 },
  { id: 'mac-chrome-retina', engine: 'chromium', browser: 'chrome', os: 'OS X', osVersion: 'Sequoia', viewport: { width: 1512, height: 982 }, dpr: 2, cpu: 10, memory: 16 },
];

const wait = (milliseconds) => new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));
const percentile = (values, ratio) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio))];
};
const summarize = (values) => {
  const finite = values.filter((value) => value != null).map(Number).filter(Number.isFinite);
  return {
    samples: finite.length,
    minimum: finite.length ? Math.min(...finite) : null,
    p10: percentile(finite, 0.1),
    median: percentile(finite, 0.5),
    p95: percentile(finite, 0.95),
    maximum: finite.length ? Math.max(...finite) : null,
    average: finite.length ? Number((finite.reduce((sum, value) => sum + value, 0) / finite.length).toFixed(2)) : null,
  };
};
const freePort = () => new Promise((resolvePort, reject) => {
  const server = createNetServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const { port } = server.address();
    server.close(() => resolvePort(port));
  });
});

async function waitForHttp(url, predicate = () => true, timeout = 120000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const value = await response.json().catch(() => null);
        if (predicate(value)) return value;
      }
    } catch {}
    await wait(250);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function startService(args, extraEnv = {}) {
  const child = spawn(process.execPath, args, {
    cwd: process.cwd(),
    env: { ...process.env, ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  child.stdout.on('data', (data) => process.stdout.write(`[service] ${data}`));
  child.stderr.on('data', (data) => process.stderr.write(`[service] ${data}`));
  children.push(child);
  return child;
}

async function browserStackPlan() {
  const username = process.env.BROWSERSTACK_USERNAME;
  const accessKey = process.env.BROWSERSTACK_ACCESS_KEY;
  if (!username || !accessKey) throw new Error('BrowserStack cloud run requires BROWSERSTACK_USERNAME and BROWSERSTACK_ACCESS_KEY.');
  const authorization = Buffer.from(`${username}:${accessKey}`).toString('base64');
  const response = await fetch('https://api.browserstack.com/automate/plan.json', { headers: { authorization: `Basic ${authorization}` } });
  if (!response.ok) throw new Error(`BrowserStack plan preflight failed with HTTP ${response.status}.`);
  const plan = await response.json();
  const maximumParallel = Number(plan.parallel_sessions_max_allowed ?? plan.parallel_sessions_max ?? plan.parallel_sessions ?? 0);
  if (maximumParallel < requestedClients) {
    throw new Error(`BrowserStack plan permits ${maximumParallel} parallel sessions; ${requestedClients} simultaneous real browsers were requested. Test was not started or misreported.`);
  }
  return { maximumParallel, planName: plan.automate_plan || plan.plan_name || 'unknown' };
}

function localChromiumPath(profile) {
  const candidates = profile.browser === 'edge'
    ? ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe']
    : ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'];
  return candidates.find(existsSync);
}

async function launchBrowser(profile, index) {
  if (provider === 'browserstack') {
    const caps = {
      browser: profile.browser,
      browser_version: 'latest',
      os: profile.os,
      os_version: profile.osVersion,
      name: `Bibish global lobby ${index + 1}/${requestedClients}`,
      build: process.env.BROWSERSTACK_BUILD || `bibish-real-2000-${new Date().toISOString().slice(0, 10)}`,
      'browserstack.username': process.env.BROWSERSTACK_USERNAME,
      'browserstack.accessKey': process.env.BROWSERSTACK_ACCESS_KEY,
      'browserstack.playwrightVersion': '1.latest',
      'browserstack.console': 'errors',
      'browserstack.networkLogs': false,
      'browserstack.video': false,
      resolution: `${profile.viewport.width}x${profile.viewport.height}`,
    };
    return chromium.connect(`wss://cdp.browserstack.com/playwright?caps=${encodeURIComponent(JSON.stringify(caps))}`);
  }
  const engine = profile.engine === 'firefox' ? firefox : profile.engine === 'webkit' ? webkit : chromium;
  const executablePath = profile.engine === 'chromium' ? localChromiumPath(profile) : undefined;
  const args = profile.engine === 'chromium' ? [
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    '--disable-features=CalculateNativeWinOcclusion',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
  ] : [];
  return engine.launch({ headless: true, executablePath, args });
}

async function createSession(index, baseUrl, wsUrl) {
  const profile = PROFILES[index % PROFILES.length];
  const team = index % 2 === 0 ? 'red' : 'blue';
  const browser = await launchBrowser(profile, index);
  let context;
  try {
    context = await browser.newContext({ viewport: profile.viewport, deviceScaleFactor: profile.dpr, locale: index % 2 ? 'en-US' : 'tr-TR' });
  await context.addInitScript(({ cpu, memory }) => {
    localStorage.setItem('bibish-graphics', JSON.stringify({ mode: 'ultra', dynamicResolution: false, showStats: true }));
    localStorage.setItem('bibish-audio-volume-v1', '0');
    try { Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, get: () => cpu }); } catch {}
    try { Object.defineProperty(navigator, 'deviceMemory', { configurable: true, get: () => memory }); } catch {}
    globalThis.__bibishLongTaskMs = 0;
    globalThis.__bibishLongTaskCount = 0;
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          globalThis.__bibishLongTaskMs += entry.duration;
          globalThis.__bibishLongTaskCount += 1;
        }
      }).observe({ type: 'longtask', buffered: true });
    } catch {}
  }, { cpu: profile.cpu, memory: profile.memory });
  const page = await context.newPage();
  const sessionErrors = [];
  page.on('pageerror', (error) => sessionErrors.push(`page: ${error.message}`));
  page.on('console', (message) => { if (message.type() === 'error') sessionErrors.push(`console: ${message.text()}`); });
  await page.goto(`${baseUrl}/?stressFullRoster=0&ws=${encodeURIComponent(wsUrl)}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => Boolean(globalThis.__bibishDebug?.joinLoadTest), null, { timeout: 180000 });
  const joined = await page.evaluate(({ assignedTeam, playerIndex }) => {
    const result = globalThis.__bibishDebug.joinLoadTest(assignedTeam, playerIndex);
    globalThis.__bibishRealMotion = setInterval(() => globalThis.__bibishDebug.stepLoadTestGameplay(playerIndex, performance.now()), 50);
    return result;
  }, { assignedTeam: team, playerIndex: index });
  if (!joined?.spawned) throw new Error(`Browser ${index} did not spawn.`);
  await page.waitForFunction(() => globalThis.__bibishDebug.getNetworkMetrics()?.connected === true, null, { timeout: 60000 });
    return { index, team, profile, browser, context, page, errors: sessionErrors, samples: [] };
  } catch (error) {
    await context?.close().catch(() => {});
    await browser.close().catch(() => {});
    throw error;
  }
}

async function sampleSession(session) {
  try {
    const value = await session.page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      const gl = canvas?.getContext('webgl2') || canvas?.getContext('webgl');
      const debug = gl?.getExtension('WEBGL_debug_renderer_info');
      return {
        renderer: globalThis.__bibishDebug.getRendererMetrics(),
        network: globalThis.__bibishDebug.getNetworkMetrics(),
        visible: globalThis.__bibishDebug.getLoadMetrics().total,
        heap: performance.memory?.usedJSHeapSize || null,
        longTaskMs: globalThis.__bibishLongTaskMs || 0,
        longTaskCount: globalThis.__bibishLongTaskCount || 0,
        webglRenderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl?.getParameter(gl.RENDERER) || 'unavailable',
        userAgent: navigator.userAgent,
      };
    });
    session.samples.push(value);
    return value;
  } catch (error) {
    session.errors.push(`sample: ${error.message}`);
    return null;
  }
}

function sessionReport(session) {
  const rendererSamples = session.samples.map((sample) => sample.renderer).filter(Boolean);
  const networkSamples = session.samples.map((sample) => sample.network).filter(Boolean);
  const last = session.samples.at(-1) || {};
  return {
    index: session.index,
    team: session.team,
    profile: session.profile,
    roomId: last.network?.roomId || null,
    serverInstanceId: last.network?.serverInstanceId || null,
    serverPlayerCount: last.network?.serverPlayerCount || 0,
    visibleRemotePlayers: summarize(session.samples.map((sample) => sample.visible)),
    fps: summarize(rendererSamples.map((sample) => sample.measuredFps)),
    latencyMs: summarize(networkSamples.map((sample) => sample.latencyMs)),
    heapMiB: summarize(session.samples.map((sample) => sample.heap ? sample.heap / 1024 / 1024 : null)),
    drawCalls: summarize(rendererSamples.map((sample) => sample.calls)),
    triangles: summarize(rendererSamples.map((sample) => sample.triangles)),
    longTaskMs: last.longTaskMs || 0,
    longTaskCount: last.longTaskCount || 0,
    webglRenderer: last.webglRenderer || 'unavailable',
    userAgent: last.userAgent || 'unavailable',
    errors: session.errors,
  };
}

function groupReports(reports, keySelector) {
  const groups = new Map();
  for (const report of reports) {
    const key = keySelector(report);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(report);
  }
  return [...groups.entries()].map(([name, entries]) => ({
    name,
    clients: entries.length,
    fpsMedian: summarize(entries.map((entry) => entry.fps.median)),
    fpsP10: summarize(entries.map((entry) => entry.fps.p10)),
    latencyMedianMs: summarize(entries.map((entry) => entry.latencyMs.median)),
    failures: entries.filter((entry) => entry.errors.length || entry.fps.median < fpsTarget).length,
  }));
}

let gamePort;
let vitePort;
let baseUrl = process.env.BIBISH_URL;
let wsUrl = process.env.BIBISH_WS_URL;
let plan = null;
let serverMetrics = null;

try {
  if (provider === 'browserstack') {
    if (!baseUrl || !wsUrl) throw new Error('Cloud browser test requires public BIBISH_URL and BIBISH_WS_URL endpoints.');
    plan = await browserStackPlan();
  } else if (ownsServices) {
    gamePort = await freePort();
    vitePort = await freePort();
    baseUrl = `http://127.0.0.1:${vitePort}`;
    wsUrl = `ws://127.0.0.1:${gamePort}/ws`;
    startService(['server/game-server.js'], { BIBISH_GAME_PORT: String(gamePort), BIBISH_INSTANCE_ID: 'local-real-browser-pilot' });
    startService(['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(vitePort), '--strictPort']);
    await Promise.all([waitForHttp(`http://127.0.0.1:${gamePort}/health`), waitForHttp(baseUrl)]);
  } else if (!baseUrl || !wsUrl) {
    throw new Error('Set both BIBISH_URL and BIBISH_WS_URL when testing an existing deployment.');
  }

  const startedAt = Date.now();
  for (let offset = 0; offset < requestedClients; offset += launchParallelism) {
    const indexes = Array.from({ length: Math.min(launchParallelism, requestedClients - offset) }, (_, item) => offset + item);
    const batch = await Promise.all(indexes.map(async (index) => {
      try { return await createSession(index, baseUrl, wsUrl); }
      catch (error) { errors.push({ index, message: error.message }); return null; }
    }));
    sessions.push(...batch.filter(Boolean));
    process.stdout.write(`Real browsers connected ${sessions.length}/${requestedClients}\n`);
    if (errors.length) throw new Error(`Browser launch failed: ${JSON.stringify(errors.slice(0, 3))}`);
  }

  await Promise.all(sessions.map((session) => session.page.waitForFunction(
    (expected) => globalThis.__bibishDebug.getNetworkMetrics()?.serverPlayerCount === expected,
    requestedClients,
    { timeout: 180000 },
  )));
  const sampleStartedAt = Date.now();
  while (Date.now() - sampleStartedAt < durationMs) {
    await Promise.all(sessions.map(sampleSession));
    await wait(1000);
  }
  if (ownsServices) serverMetrics = await fetch(`http://127.0.0.1:${gamePort}/metrics`).then((response) => response.json());

  const clients = sessions.map(sessionReport);
  const roomIds = [...new Set(clients.map((client) => client.roomId).filter(Boolean))];
  const serverInstances = [...new Set(clients.map((client) => client.serverInstanceId).filter(Boolean))];
  const allFpsMedians = clients.map((client) => client.fps.median).filter(Number.isFinite);
  const report = {
    generatedAt: new Date().toISOString(),
    provider,
    methodology: provider === 'browserstack'
      ? 'One real BrowserStack desktop browser session per player; all sessions concurrent and connected to one logical global lobby.'
      : 'One separate local browser process per player across Chromium, Firefox, WebKit and Edge profiles; suitable as a cross-engine pilot, not as 2000 physical computers.',
    requestedClients,
    connectedClients: sessions.length,
    teams: {
      red: clients.filter((client) => client.team === 'red').length,
      blue: clients.filter((client) => client.team === 'blue').length,
    },
    durationSeconds: Number(((Date.now() - startedAt) / 1000).toFixed(2)),
    fpsTarget,
    globalLobby: {
      roomIds,
      serverInstances,
      everyClientSawFullPopulation: clients.every((client) => client.serverPlayerCount === requestedClients),
      passed: roomIds.length === 1 && roomIds[0] === 'global' && clients.every((client) => client.serverPlayerCount === requestedClients),
    },
    aggregate: {
      fpsMedianAcrossClients: summarize(allFpsMedians),
      clientsAtTarget: clients.filter((client) => client.fps.median >= fpsTarget).length,
      clientsBelowTarget: clients.filter((client) => client.fps.median < fpsTarget).length,
      latencyMedianAcrossClients: summarize(clients.map((client) => client.latencyMs.median)),
      totalBrowserHeapMiB: Number(clients.reduce((sum, client) => sum + (client.heapMiB.median || 0), 0).toFixed(1)),
      browserErrors: clients.reduce((sum, client) => sum + client.errors.length, 0),
    },
    byEngine: groupReports(clients, (client) => client.profile.engine),
    byProfile: groupReports(clients, (client) => client.profile.id),
    browserStackPlan: plan,
    server: serverMetrics,
    clients,
    launchErrors: errors,
  };
  report.passed = sessions.length === requestedClients && report.globalLobby.passed && report.aggregate.browserErrors === 0 && report.aggregate.clientsBelowTarget === 0;
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`BIBISH_REAL_BROWSER_REPORT ${JSON.stringify({ reportPath, provider, requestedClients, connectedClients: sessions.length, globalLobby: report.globalLobby, aggregate: report.aggregate, byEngine: report.byEngine, passed: report.passed })}\n`);
  if (!report.passed) process.exitCode = 1;
} catch (error) {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
} finally {
  for (const session of sessions) await session.context.close().catch(() => {});
  for (const session of sessions) await session.browser.close().catch(() => {});
  for (const child of children) child.kill();
}

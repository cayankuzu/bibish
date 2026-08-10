import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer as createNetServer } from 'node:net';
import { chromium } from 'playwright';
import WebSocket from 'ws';

const TOTAL_PLAYERS = Math.max(4, Number(process.env.TOTAL_PLAYERS || 2000));
const RED_TARGET = Math.floor(TOTAL_PLAYERS / 2);
const BLUE_TARGET = TOTAL_PLAYERS - RED_TARGET;
const browserMode = process.argv.includes('--browser');
const virtualCount = browserMode ? TOTAL_PLAYERS - 1 : TOTAL_PLAYERS;
const sustainMs = Math.max(10000, Number(process.env.DURATION_MS || 25000));
const batchSize = Math.max(25, Number(process.env.BATCH_SIZE || 100));
const STATE_INTERVAL_MS = 100;
const ULTRA_MEDIAN_FPS_TARGET = Math.max(1, Number(process.env.ULTRA_MEDIAN_FPS_TARGET || 55));
const children = [];
const players = [];
const errors = [];
const latencySamples = [];
let snapshotMessages = 0;
let snapshotBytes = 0;
let statesSent = 0;
let unexpectedCloses = 0;
let shuttingDown = false;

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const percentile = (values, ratio) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
};
const freePort = () => new Promise((resolve, reject) => {
  const server = createNetServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const { port } = server.address();
    server.close(() => resolve(port));
  });
});

const gamePort = await freePort();
const vitePort = browserMode ? await freePort() : null;
const wsUrl = `ws://127.0.0.1:${gamePort}/ws`;
const baseUrl = browserMode ? `http://127.0.0.1:${vitePort}` : null;

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

function preferredTeams() {
  const redTarget = browserMode ? Math.max(0, RED_TARGET - 1) : RED_TARGET;
  const blueTarget = BLUE_TARGET;
  const order = [];
  let red = 0;
  let blue = 0;
  while (red < redTarget || blue < blueTarget) {
    if (red < redTarget) {
      order.push('red');
      red += 1;
    }
    if (blue < blueTarget) {
      order.push('blue');
      blue += 1;
    }
  }
  return order;
}

function connectVirtualPlayer(index, team) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl, { perMessageDeflate: false, handshakeTimeout: 30000 });
    const gridX = ((index * 73) % 1200) - 600;
    const gridZ = ((index * 151) % 1200) - 600;
    const player = {
      index,
      socket,
      preferredTeam: team,
      assignedTeam: null,
      x: gridX,
      z: gridZ,
      yaw: (index * 0.618) % (Math.PI * 2),
      phase: index * 0.17,
      speed: 2.7 + index % 17 * 0.13,
      turnRate: ((index % 9) - 4) * 0.012,
      stance: 'stand',
      mode: 0,
      weapon: 0,
      action: 0,
      deadTicks: 0,
      snapshots: 0,
      visiblePlayers: 0,
      totalPlayers: 0,
      roomId: null,
      serverInstanceId: null,
      settled: false,
    };
    players.push(player);
    socket.once('open', () => socket.send(JSON.stringify({
      type: 'join',
      clientId: `virtual-${String(index).padStart(4, '0')}`,
      deviceKey: `virtual-device-${String(index).padStart(4, '0')}`,
      name: `${team === 'red' ? 'Kizil' : 'Mavi'}Test-${String(index).padStart(4, '0')}`,
      team,
      countryCode: index % 3 === 0 ? 'TR' : index % 3 === 1 ? 'US' : 'DE',
    })));
    socket.on('message', (raw) => {
      snapshotBytes += raw.byteLength;
      let message;
      try { message = JSON.parse(String(raw)); } catch { return; }
      if (message.type === 'welcome') {
        player.assignedTeam = message.team;
        player.roomId = message.roomId || null;
        player.serverInstanceId = message.instanceId || null;
        if (!player.settled) {
          player.settled = true;
          resolve(player);
        }
        return;
      }
      if (message.type !== 'snapshot') return;
      snapshotMessages += 1;
      player.snapshots += 1;
      player.visiblePlayers = message.players?.length || 0;
      player.totalPlayers = Number(message.totalPlayers) || 0;
      if ((index + player.snapshots) % 23 === 0 && latencySamples.length < 200000) {
        latencySamples.push(Math.max(0, Date.now() - Number(message.serverTime || Date.now())));
      }
    });
    socket.once('error', (error) => {
      errors.push(`client ${index}: ${error.message}`);
      if (!player.settled) {
        player.settled = true;
        reject(error);
      }
    });
    socket.once('close', () => {
      if (!shuttingDown) unexpectedCloses += 1;
      if (!player.settled) {
        player.settled = true;
        reject(new Error(`Client ${index} closed before welcome`));
      }
    });
  });
}

function startRandomGameplay() {
  let tick = 0;
  return setInterval(() => {
    tick += 1;
    for (const player of players) {
      const { socket, index } = player;
      if (socket.readyState !== WebSocket.OPEN || socket.bufferedAmount > 512 * 1024) continue;
      if (tick % (37 + index % 41) === 0) {
        player.turnRate = (((index * 17 + tick) % 13) - 6) * 0.018;
        player.stance = (index + tick) % 19 === 0 ? 'prone' : (index + tick) % 7 === 0 ? 'crouch' : 'stand';
        player.mode = (index + tick) % 5 === 0 ? 1 : 0;
        player.weapon = player.mode === 0 && (index + tick) % 4 === 0 ? 1 : 0;
      }
      player.yaw += player.turnRate;
      player.phase += player.stance === 'prone' ? 0.08 : player.stance === 'crouch' ? 0.15 : 0.28;
      const stanceSpeed = player.stance === 'prone' ? 0.25 : player.stance === 'crouch' ? 0.55 : 1;
      player.x += Math.sin(player.yaw) * player.speed * stanceSpeed * STATE_INTERVAL_MS / 1000;
      player.z += Math.cos(player.yaw) * player.speed * stanceSpeed * STATE_INTERVAL_MS / 1000;
      if (Math.abs(player.x) > 610) {
        player.x = Math.sign(player.x) * 610;
        player.yaw *= -1;
      }
      if (Math.abs(player.z) > 610) {
        player.z = Math.sign(player.z) * 610;
        player.yaw = Math.PI - player.yaw;
      }
      const attackCycle = (tick + index * 11) % 53;
      player.action = attackCycle === 0 ? (player.weapon === 1 ? 4 : 1) : player.mode === 1 && attackCycle < 3 ? 2 + index % 3 : 0;
      if ((tick + index * 29) % 2101 === 0) player.deadTicks = 30;
      if (player.deadTicks > 0) player.deadTicks -= 1;
      const dead = player.deadTicks > 0;
      socket.send(JSON.stringify({
        type: 'state',
        x: player.x,
        y: 8 + Math.sin(player.x * 0.018) * 4 + Math.cos(player.z * 0.015) * 3,
        z: player.z,
        yaw: player.yaw,
        pitch: Math.sin(player.phase * 0.03) * 0.18,
        stance: player.stance,
        weapon: player.weapon,
        mode: player.mode,
        shieldActive: player.weapon === 1 && (tick + index) % 8 < 3,
        health: dead ? 0 : 55 + (index * 7 + tick) % 46,
        score: index * 13 + tick,
        kills: Math.floor(tick / 430) + index % 9,
        deaths: Math.floor(tick / 2101),
        elapsedSeconds: tick * STATE_INTERVAL_MS / 1000,
        phase: player.phase,
        action: player.action,
        dead,
      }));
      statesSent += 1;
    }
  }, STATE_INTERVAL_MS);
}

async function launchStressBrowser(team) {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean);
  const browser = await chromium.launch({
    headless: true,
    executablePath: candidates.find(existsSync),
    args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--ignore-gpu-blocklist'],
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await context.addInitScript(() => {
    localStorage.setItem('bibish-graphics', JSON.stringify({ mode: 'ultra', dynamicResolution: false, showStats: true }));
    localStorage.setItem('bibish-audio-volume-v1', '0');
  });
  const page = await context.newPage();
  const browserErrors = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') browserErrors.push(message.text()); });
  await page.goto(`${baseUrl}/?stressFullRoster=1&ws=${encodeURIComponent(wsUrl)}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => Boolean(globalThis.__bibishDebug?.joinLoadTest), null, { timeout: 180000 });
  await page.evaluate(({ assignedTeam, totalPlayers }) => {
    globalThis.__bibishDebug.joinLoadTest(assignedTeam, totalPlayers);
    globalThis.__stressMotion = setInterval(() => globalThis.__bibishDebug.stepLoadTestMotion(totalPlayers, performance.now()), 50);
  }, { assignedTeam: team, totalPlayers: TOTAL_PLAYERS });
  await page.waitForFunction(
    (expected) => globalThis.__bibishDebug.getNetworkMetrics()?.serverPlayerCount === expected && globalThis.__bibishDebug.getLoadMetrics().total === expected - 1,
    TOTAL_PLAYERS,
    { timeout: 180000 },
  );
  const fpsSamples = [];
  for (let sample = 0; sample < 8; sample += 1) {
    await wait(2000);
    fpsSamples.push(await page.evaluate(() => ({
      renderer: globalThis.__bibishDebug.getRendererMetrics(),
      load: globalThis.__bibishDebug.getLoadMetrics(),
      network: globalThis.__bibishDebug.getNetworkMetrics(),
      heap: performance.memory?.usedJSHeapSize || null,
      overlay: Boolean(document.querySelector('.vite-error-overlay')),
      hasContent: document.body.innerText.trim().length > 0,
    })));
  }
  return { browser, context, page, browserErrors, fpsSamples };
}

let gameplayTimer;
let stressBrowser;
try {
  startService(['server/game-server.js'], {
    BIBISH_GAME_PORT: String(gamePort),
    BIBISH_ALLOW_FULL_ROSTER: browserMode ? '1' : '0',
  });
  if (browserMode) startService(['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(vitePort), '--strictPort']);
  await waitForHttp(`http://127.0.0.1:${gamePort}/health`);
  if (browserMode) await waitForHttp(baseUrl);

  const teams = preferredTeams();
  const rampStartedAt = Date.now();
  for (let offset = 0; offset < teams.length; offset += batchSize) {
    await Promise.all(teams.slice(offset, offset + batchSize).map((team, batchIndex) => connectVirtualPlayer(offset + batchIndex, team)));
    if ((offset + batchSize) % 500 === 0 || offset + batchSize >= teams.length) {
      const metrics = await fetch(`http://127.0.0.1:${gamePort}/metrics`).then((response) => response.json());
      process.stdout.write(`Connected ${Math.min(offset + batchSize, teams.length)}/${virtualCount} · red ${metrics.teams.red} blue ${metrics.teams.blue}\n`);
    }
  }
  gameplayTimer = startRandomGameplay();
  await wait(2500);

  if (browserMode) {
    const beforeBrowser = await fetch(`http://127.0.0.1:${gamePort}/metrics`).then((response) => response.json());
    const browserTeam = beforeBrowser.teams.red < beforeBrowser.teams.blue ? 'red' : 'blue';
    stressBrowser = await launchStressBrowser(browserTeam);
  }

  const readyMetrics = await waitForHttp(
    `http://127.0.0.1:${gamePort}/metrics`,
    (metrics) => metrics?.players === TOTAL_PLAYERS && metrics?.teams?.red === RED_TARGET && metrics?.teams?.blue === BLUE_TARGET,
    180000,
  );
  const sustainStartedAt = Date.now();
  const beforeSustain = { ...readyMetrics };
  await wait(sustainMs);
  const afterSustain = await fetch(`http://127.0.0.1:${gamePort}/metrics`).then((response) => response.json());
  const elapsedSeconds = Math.max(1, (Date.now() - sustainStartedAt) / 1000);
  const visibleCounts = players.map((player) => player.visiblePlayers).filter((value) => value > 0);
  const completeWorldCounts = players.filter((player) => player.totalPlayers === TOTAL_PLAYERS).length;
  const roomIds = [...new Set(players.map((player) => player.roomId).filter(Boolean))];
  const serverInstanceIds = [...new Set(players.map((player) => player.serverInstanceId).filter(Boolean))];
  const lastBrowserSample = stressBrowser?.fpsSamples.at(-1) || null;
  const browserFps = stressBrowser ? stressBrowser.fpsSamples.map((sample) => sample.renderer.measuredFps).filter(Number.isFinite) : [];
  const result = {
    mode: browserMode ? `${virtualCount} virtual + 1 full ultra Chromium` : `${TOTAL_PLAYERS} virtual WebSocket players`,
    requestedPlayers: TOTAL_PLAYERS,
    serverPlayers: afterSustain.players,
    teams: afterSustain.teams,
    globalLobby: {
      roomIds,
      serverInstanceIds,
      everyClientSawFullPopulation: completeWorldCounts === virtualCount,
    },
    rampSeconds: (sustainStartedAt - rampStartedAt) / 1000,
    sustainedSeconds: elapsedSeconds,
    randomGameplay: {
      stateHzPerPlayer: 1000 / STATE_INTERVAL_MS,
      statesSent,
      stances: ['stand', 'crouch', 'prone'],
      actions: ['move', 'rifle', 'sword', 'paint', 'shield', 'death'],
    },
    virtualClients: {
      connected: players.filter((player) => player.socket.readyState === WebSocket.OPEN).length,
      unexpectedCloses,
      errors: errors.slice(0, 25),
      snapshotsReceived: snapshotMessages,
      completeWorldCountSeen: completeWorldCounts,
      visiblePlayersMedian: percentile(visibleCounts, 0.5),
      visiblePlayersP95: percentile(visibleCounts, 0.95),
      snapshotLatencyMedianMs: percentile(latencySamples, 0.5),
      snapshotLatencyP95Ms: percentile(latencySamples, 0.95),
      receivedMiB: Math.round(snapshotBytes / 1024 / 1024),
    },
    server: {
      snapshotHz: afterSustain.snapshotHz,
      interestRadius: afterSustain.interestRadius,
      maxInterestPlayers: afterSustain.maxInterestPlayers,
      averagePlayersPerSnapshot: Number(afterSustain.averagePlayersPerSnapshot.toFixed(1)),
      droppedSnapshots: afterSustain.droppedSnapshots - beforeSustain.droppedSnapshots,
      inboundMessagesPerSecond: Math.round((afterSustain.inboundMessages - beforeSustain.inboundMessages) / elapsedSeconds),
      outboundMessagesPerSecond: Math.round((afterSustain.outboundMessages - beforeSustain.outboundMessages) / elapsedSeconds),
      inboundMiBPerSecond: Number(((afterSustain.inboundBytes - beforeSustain.inboundBytes) / 1024 / 1024 / elapsedSeconds).toFixed(2)),
      outboundMiBPerSecond: Number(((afterSustain.outboundBytes - beforeSustain.outboundBytes) / 1024 / 1024 / elapsedSeconds).toFixed(2)),
      rssMiB: Math.round(afterSustain.memory.rss / 1024 / 1024),
      heapMiB: Math.round(afterSustain.memory.heapUsed / 1024 / 1024),
      cpuPercentSingleCore: Number(afterSustain.cpuPercentSingleCore.toFixed(1)),
      eventLoopMeanMs: Number(afterSustain.eventLoopMeanMs.toFixed(2)),
      eventLoopP99Ms: Number(afterSustain.eventLoopP99Ms.toFixed(2)),
      eventLoopMaxMs: Number(afterSustain.eventLoopMaxMs.toFixed(2)),
    },
    ultraBrowser: stressBrowser ? {
      remotePlayers: lastBrowserSample.load.total,
      serverPlayers: lastBrowserSample.network.serverPlayerCount,
      fpsMedian: percentile(browserFps, 0.5),
      fpsP10: percentile(browserFps, 0.1),
      fpsMinimum: Math.min(...browserFps),
      medianFpsTarget: ULTRA_MEDIAN_FPS_TARGET,
      drawCalls: lastBrowserSample.renderer.calls,
      triangles: lastBrowserSample.renderer.triangles,
      pixelRatio: lastBrowserSample.renderer.pixelRatio,
      quality: lastBrowserSample.renderer.quality,
      latencyMs: lastBrowserSample.network.latencyMs,
      heapMiB: lastBrowserSample.heap ? Math.round(lastBrowserSample.heap / 1024 / 1024) : null,
      errors: stressBrowser.browserErrors,
      overlay: lastBrowserSample.overlay,
      hasContent: lastBrowserSample.hasContent,
    } : null,
  };
  result.connectivityPassed = result.serverPlayers === TOTAL_PLAYERS && result.teams.red === RED_TARGET && result.teams.blue === BLUE_TARGET && result.virtualClients.unexpectedCloses === 0 && result.virtualClients.errors.length === 0 && result.globalLobby.roomIds.length === 1 && result.globalLobby.roomIds[0] === 'global' && result.globalLobby.everyClientSawFullPopulation;
  result.serverHealthPassed = result.server.eventLoopP99Ms < 250 && result.server.rssMiB < 1024 && result.server.droppedSnapshots < afterSustain.snapshotDeliveries * 0.01;
  result.ultraFpsPassed = !result.ultraBrowser || (result.ultraBrowser.quality === 'ultra' && result.ultraBrowser.fpsMedian >= ULTRA_MEDIAN_FPS_TARGET && result.ultraBrowser.errors.length === 0 && !result.ultraBrowser.overlay);
  result.passed = result.connectivityPassed && result.serverHealthPassed && result.ultraFpsPassed;
  process.stdout.write(`BIBISH_2000_LOAD_RESULT ${JSON.stringify(result)}\n`);
  if (!result.passed) process.exitCode = 1;
} catch (error) {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
} finally {
  clearInterval(gameplayTimer);
  shuttingDown = true;
  for (const player of players) player.socket.close(1000, 'test-complete');
  await wait(250);
  await stressBrowser?.context.close().catch(() => {});
  await stressBrowser?.browser.close().catch(() => {});
  for (const child of children) child.kill();
}

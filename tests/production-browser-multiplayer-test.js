import { existsSync } from 'node:fs';
import { chromium } from 'playwright';

const baseUrl = process.env.BIBISH_PUBLIC_URL || 'https://bibish-iota.vercel.app';
const clientCount = Math.max(2, Number(process.env.CLIENT_COUNT || 4));
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const executablePath = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean).find(existsSync);

if (!executablePath) throw new Error('Chrome or Edge executable was not found.');

const sessions = [];
const errors = [];

try {
  for (let index = 0; index < clientCount; index += 1) {
    const browser = await chromium.launch({
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
    const width = 1180 + index * 17;
    const height = 720 + index * 11;
    const context = await browser.newContext({
      viewport: { width, height },
      screen: { width, height },
      deviceScaleFactor: 1,
    });
    await context.addInitScript(() => {
      localStorage.setItem('bibish-graphics', JSON.stringify({ mode: 'ultra', dynamicResolution: true, showStats: true }));
      localStorage.setItem('bibish-audio-volume-v1', '0');
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push({ index, type: 'pageerror', message: error.message }));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push({ index, type: 'console', message: message.text() });
    });
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForFunction(() => Boolean(globalThis.__bibishDebug?.joinLoadTest), null, { timeout: 180000 });
    const team = index % 2 === 0 ? 'red' : 'blue';
    const joined = await page.evaluate(({ assignedTeam, clientIndex }) => {
      return globalThis.__bibishDebug.joinLoadTest(assignedTeam, clientIndex + 7000);
    }, { assignedTeam: team, clientIndex: index });
    if (!joined.spawned) throw new Error(`Production browser ${index + 1} could not spawn.`);
    sessions.push({ browser, context, page, index });
  }

  for (let attempt = 0; attempt < 16; attempt += 1) {
    await Promise.all(sessions.map(({ page }) => page.evaluate(() => {
      globalThis.__bibishDebug.stepLoadTestGameplay(0, 0);
    })));
    await wait(150);
  }

  await Promise.all(sessions.map(({ page }) => page.waitForFunction((expected) => {
    const metrics = globalThis.__bibishDebug?.getNetworkMetrics?.();
    return metrics?.connected === true
      && metrics.serverPlayerCount === expected
      && metrics.roomId === 'global'
      && metrics.lastSnapshotAgeMs < 1500;
  }, clientCount, { timeout: 60000 })));

  const networkIds = await Promise.all(sessions.map(({ page }) => page.evaluate(() => globalThis.__bibishDebug.getNetworkMetrics().clientId)));
  const testPositions = await Promise.all(sessions.map(({ page }) => page.evaluate(() => globalThis.__bibishDebug.prepareNetworkEventTest(0, 0))));
  await wait(900);
  const sharedBefore = await Promise.all(sessions.map(({ page }) => page.evaluate(() => globalThis.__bibishDebug.getSharedGameState())));
  const attackerIndex = 0;
  const victimIndex = sharedBefore.findIndex((entry) => entry.team !== sharedBefore[attackerIndex].team);
  if (victimIndex < 0) throw new Error('No opposing production client was available for the damage test.');
  await sessions[attackerIndex].page.evaluate(({ targetId, point }) => {
    globalThis.__bibishDebug.paintNetworkTest(point.x, point.y, point.z, 'pee', 0.5);
    globalThis.__bibishDebug.sendNetworkEvent({ kind: 'damage', targetId, weapon: 'rifle', zone: 'torso' });
  }, { targetId: networkIds[victimIndex], point: testPositions[attackerIndex] });
  await sessions[victimIndex].page.waitForFunction(() => globalThis.__bibishDebug.getSharedGameState().health === 62, null, { timeout: 30000 });
  await Promise.all(sessions.map(({ page }, index) => page.waitForFunction((before) => {
    const current = globalThis.__bibishDebug.getSharedGameState();
    return current.lastNetworkEventId >= before.lastNetworkEventId + 2
      && (current.redPaint > before.redPaint || current.bluePaint > before.bluePaint);
  }, sharedBefore[index], { timeout: 30000 })));
  const sharedAfter = await Promise.all(sessions.map(({ page }) => page.evaluate(() => globalThis.__bibishDebug.getSharedGameState())));

  await wait(4000);
  const clients = await Promise.all(sessions.map(({ page, index }) => page.evaluate((clientIndex) => ({
    index: clientIndex,
    network: globalThis.__bibishDebug.getNetworkMetrics(),
    render: globalThis.__bibishDebug.getLoadMetrics(),
    renderer: globalThis.__bibishDebug.getRendererMetrics(),
    overlay: Boolean(document.querySelector('.vite-error-overlay,[data-nextjs-dialog],#webpack-dev-server-client-overlay')),
    contentLength: document.body.innerText.trim().length,
    duplicateBlocked: !document.querySelector('#duplicate-session-block')?.classList.contains('hidden'),
  }), index)));

  await sessions[0].page.screenshot({ path: 'production-multiplayer.png', fullPage: false });
  const roomIds = new Set(clients.map((client) => client.network.roomId));
  const instanceIds = new Set(clients.map((client) => client.network.serverInstanceId));
  const teamCounts = clients.at(-1).network.serverTeamCounts;
  const result = {
    passed: errors.length === 0
      && roomIds.size === 1
      && roomIds.has('global')
      && instanceIds.size === 1
      && clients.every((client) => client.network.connected)
      && clients.every((client) => client.network.serverPlayerCount === clientCount)
      && clients.every((client) => client.network.lastSnapshotAgeMs < 1500)
      && clients.every((client) => client.render.total >= 1)
      && clients.every((client) => client.contentLength > 0 && !client.overlay && !client.duplicateBlocked)
      && sharedAfter[victimIndex].health === 62
      && sharedAfter.every((entry, index) => entry.redPaint > sharedBefore[index].redPaint || entry.bluePaint > sharedBefore[index].bluePaint)
      && Math.abs(teamCounts.red - teamCounts.blue) <= 1,
    baseUrl,
    browser: executablePath,
    clients: clientCount,
    roomIds: [...roomIds],
    instanceIds: [...instanceIds],
    teamCounts,
    sharedEvents: {
      attackerIndex,
      victimIndex,
      victimHealth: sharedAfter[victimIndex].health,
      eventIds: sharedAfter.map((entry) => entry.lastNetworkEventId),
      paintChanged: sharedAfter.map((entry, index) => entry.redPaint > sharedBefore[index].redPaint || entry.bluePaint > sharedBefore[index].bluePaint),
      leaderboardSizes: sharedAfter.map((entry) => entry.leaders),
    },
    samples: clients.map((client) => ({
      index: client.index,
      connected: client.network.connected,
      latencyMs: client.network.latencyMs,
      lastSnapshotAgeMs: client.network.lastSnapshotAgeMs,
      remotePlayers: client.render.total,
      fps: client.renderer.measuredFps,
      quality: client.renderer.quality,
    })),
    errors,
  };
  process.stdout.write(`BIBISH_PRODUCTION_MULTIPLAYER_RESULT ${JSON.stringify(result)}\n`);
  if (!result.passed) process.exitCode = 1;
} catch (error) {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
} finally {
  for (const { context, browser } of sessions) {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

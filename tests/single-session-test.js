import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer as createNetServer } from 'node:net';
import { chromium } from 'playwright';

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const freePort = () => new Promise((resolve, reject) => {
  const server = createNetServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const { port } = server.address();
    server.close(() => resolve(port));
  });
});

async function waitForJson(url, predicate = () => true, timeout = 30000) {
  const startedAt = Date.now();
  let lastValue = null;
  while (Date.now() - startedAt < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        lastValue = await response.json();
        if (predicate(lastValue)) return lastValue;
      }
    } catch {}
    await wait(150);
  }
  throw new Error(`Timed out waiting for ${url}; last value: ${JSON.stringify(lastValue)}`);
}

const executablePath = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean).find(existsSync);
const port = await freePort();
const baseUrl = `http://127.0.0.1:${port}`;
const vite = spawn(process.execPath, [
  'node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort',
], { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
const browsers = [];

async function openBrowser() {
  const browser = await chromium.launch({ headless: true, executablePath, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
  browsers.push(browser);
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await context.addInitScript(() => {
    localStorage.setItem('bibish-graphics', JSON.stringify({ mode: 'performance', dynamicResolution: true, showStats: true }));
    localStorage.setItem('bibish-audio-volume-v1', '0');
  });
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => Boolean(globalThis.__bibishDebug?.joinLoadTest), null, { timeout: 120000 });
  return page;
}

try {
  await waitForJson(`${baseUrl}/__bibish/metrics`, (value) => value.ok);
  const firstPage = await openBrowser();
  await firstPage.evaluate(() => globalThis.__bibishDebug.joinLoadTest('red', 1));
  await firstPage.waitForFunction(() => globalThis.__bibishDebug.getNetworkMetrics()?.connected === true, null, { timeout: 30000 });
  await waitForJson(`${baseUrl}/__bibish/metrics`, (value) => value.players === 1 && value.activeDevices === 1);

  const secondPage = await openBrowser();
  await secondPage.evaluate(() => globalThis.__bibishDebug.joinLoadTest('blue', 2));
  await secondPage.waitForFunction(() => !document.querySelector('#duplicate-session-block')?.classList.contains('hidden'), null, { timeout: 30000 });
  const server = await waitForJson(`${baseUrl}/__bibish/metrics`, (value) => value.totalConnections >= 2);
  const first = await firstPage.evaluate(() => globalThis.__bibishDebug.getNetworkMetrics());
  const second = await secondPage.evaluate(() => ({
    network: globalThis.__bibishDebug.getNetworkMetrics(),
    blocked: !document.querySelector('#duplicate-session-block')?.classList.contains('hidden'),
  }));
  const result = {
    passed: server.players === 1
      && server.activeDevices === 1
      && first.connected === true
      && second.network.connected === false
      && second.blocked === true
      && first.deviceKey === second.network.deviceKey,
    server: { players: server.players, activeDevices: server.activeDevices, totalConnections: server.totalConnections },
    first: { connected: first.connected, deviceKey: first.deviceKey },
    second: { connected: second.network.connected, deviceKey: second.network.deviceKey, blocked: second.blocked },
  };
  process.stdout.write(`BIBISH_SINGLE_SESSION_RESULT ${JSON.stringify(result)}\n`);
  if (!result.passed) process.exitCode = 1;
} catch (error) {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
} finally {
  for (const browser of browsers) await browser.close().catch(() => {});
  vite.kill();
}

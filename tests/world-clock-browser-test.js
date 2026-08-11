import { existsSync } from 'node:fs';
import { chromium } from 'playwright';

const baseUrl = process.env.BIBISH_TEST_URL || 'http://127.0.0.1:5173';
const executablePath = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean).find(existsSync);

if (!executablePath) throw new Error('Chrome or Edge executable was not found.');

const browser = await chromium.launch({ headless: true, executablePath, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await context.addInitScript(() => {
  localStorage.setItem('bibish-language-v1', 'tr');
  localStorage.setItem('bibish-audio-volume-v1', '0');
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

const metrics = () => fetch(`${baseUrl}/__bibish/metrics`).then((response) => response.json());
const waitForMetrics = (predicate, timeoutMs = 10_000) => new Promise((resolve, reject) => {
  const startedAt = Date.now();
  const poll = async () => {
    const value = await metrics();
    if (predicate(value)) return resolve(value);
    if (Date.now() - startedAt > timeoutMs) return reject(new Error(`Metrics timeout: ${JSON.stringify(value)}`));
    setTimeout(poll, 50);
  };
  poll().catch(reject);
});

try {
  await page.goto(`${baseUrl}/?localLobbyTest=1`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.waitForFunction(() => Boolean(globalThis.__bibishDebug?.joinLoadTest), null, { timeout: 120_000 });
  await page.waitForFunction(() => document.querySelector('#loading-screen')?.classList.contains('hidden'), null, { timeout: 120_000 });
  const initiallyPaused = await waitForMetrics((value) => value.players === 0 && value.worldClockRunning === false);

  await page.evaluate(() => globalThis.__bibishDebug.joinLoadTest('red', 707));
  const visibleClockAtJoin = await page.locator('#world-age-value').textContent();
  const joined = await waitForMetrics((value) => value.players === 1 && value.worldClockRunning === true);
  await page.waitForFunction((previous) => document.querySelector('#world-age-value')?.textContent !== previous, visibleClockAtJoin, { timeout: 5000 });
  const visibleClockAfterJoin = await page.locator('#world-age-value').textContent();
  await new Promise((resolve) => setTimeout(resolve, 1150));
  const beforeRefresh = await metrics();
  if (beforeRefresh.worldActiveElapsedMs - joined.worldActiveElapsedMs < 900) {
    throw new Error(`Clock did not advance before refresh: ${JSON.stringify({ joined, beforeRefresh })}`);
  }

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.waitForFunction(() => Boolean(globalThis.__bibishDebug?.joinLoadTest), null, { timeout: 120_000 });
  await page.waitForFunction(() => document.querySelector('#loading-screen')?.classList.contains('hidden'), null, { timeout: 120_000 });
  const afterRefresh = await waitForMetrics((value) => value.players === 0 && value.worldClockRunning === false);
  if (afterRefresh.worldActiveElapsedMs + 50 < beforeRefresh.worldActiveElapsedMs) {
    throw new Error(`Refresh reset the clock: ${JSON.stringify({ beforeRefresh, afterRefresh })}`);
  }
  await new Promise((resolve) => setTimeout(resolve, 1100));
  const pausedAfterRefresh = await metrics();
  if (Math.abs(pausedAfterRefresh.worldActiveElapsedMs - afterRefresh.worldActiveElapsedMs) > 50) {
    throw new Error(`Clock advanced with zero players after refresh: ${JSON.stringify({ afterRefresh, pausedAfterRefresh })}`);
  }

  await page.evaluate(() => globalThis.__bibishDebug.joinLoadTest('blue', 708));
  const rejoined = await waitForMetrics((value) => value.players === 1 && value.worldClockRunning === true);
  await new Promise((resolve) => setTimeout(resolve, 1100));
  const resumed = await metrics();
  if (rejoined.worldActiveElapsedMs + 50 < afterRefresh.worldActiveElapsedMs
    || resumed.worldActiveElapsedMs - rejoined.worldActiveElapsedMs < 900) {
    throw new Error(`Clock did not resume after refresh: ${JSON.stringify({ afterRefresh, rejoined, resumed })}`);
  }

  const browserState = await page.evaluate(() => ({
    content: document.body.innerText.trim().length,
    errorOverlay: Boolean(document.querySelector('.vite-error-overlay, #webpack-dev-server-client-overlay')),
    worldAge: document.querySelector('#world-age-value')?.textContent,
  }));
  if (!browserState.content || browserState.errorOverlay || errors.length) {
    throw new Error(`Browser health failed: ${JSON.stringify({ browserState, errors })}`);
  }

  console.log('BIBISH_WORLD_CLOCK_BROWSER_RESULT', JSON.stringify({
    passed: true,
    initiallyPaused: initiallyPaused.worldActiveElapsedMs,
    beforeRefresh: beforeRefresh.worldActiveElapsedMs,
    afterRefresh: afterRefresh.worldActiveElapsedMs,
    pausedAfterRefresh: pausedAfterRefresh.worldActiveElapsedMs,
    resumed: resumed.worldActiveElapsedMs,
    browserState,
    visibleClockAtJoin,
    visibleClockAfterJoin,
  }));
} finally {
  await context.close();
  await browser.close();
}

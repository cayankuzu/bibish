import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright';

const baseUrl = process.env.BIBISH_TEST_URL || 'http://127.0.0.1:5173';
const executablePath = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean).find(existsSync);

if (!executablePath) throw new Error('Chrome or Edge executable was not found.');

const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: ['--enable-webgl', '--ignore-gpu-blocklist'],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
await context.addInitScript(() => {
  localStorage.removeItem('bibish-match-history-v1');
  localStorage.setItem('bibish-language-v1', 'tr');
  localStorage.setItem('bibish-audio-volume-v1', '0');
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});

try {
  await page.goto(`${baseUrl}/?localLobbyTest=1&endPreview=red&playerTeam=red`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => Boolean(globalThis.__bibishDebug?.previewMatchEnd), null, { timeout: 120000 });
  await page.waitForFunction(() => document.querySelector('#loading-screen')?.classList.contains('hidden'), null, { timeout: 120000 });
  await page.waitForSelector('#end-screen:not(.hidden)', { timeout: 10000 });
  const record = await page.evaluate(() => JSON.parse(localStorage.getItem('bibish-match-history-v1') || '[]')[0]);
  const end = await page.evaluate(() => ({
    title: document.querySelector('#winner-title')?.textContent,
    message: document.querySelector('#winner-reason')?.textContent,
    duration: document.querySelector('#end-duration-value')?.textContent,
    leaderboardRows: document.querySelectorAll('#end-leaderboard .end-leader-row').length,
    mapPixels: document.querySelector('#end-map-canvas')?.toDataURL().length || 0,
    archiveCount: Number(document.querySelector('#match-history-count')?.textContent || 0),
    storedCount: JSON.parse(localStorage.getItem('bibish-match-history-v1') || '[]').length,
  }));
  if (!end.title?.includes('KAZANDI')) throw new Error(`Missing winner title: ${end.title}`);
  if (!end.message?.includes('SIÇIP SIVADINIZ')) throw new Error(`Missing requested result copy: ${end.message}`);
  if (end.leaderboardRows < 1 || end.mapPixels < 1000) throw new Error(`Incomplete end summary: ${JSON.stringify(end)}`);
  if (end.archiveCount !== 1 || end.storedCount !== 1) throw new Error(`Match was not archived: ${JSON.stringify(end)}`);

  const screenshotPath = join(tmpdir(), 'bibish-match-end.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await page.click('#end-home-button');
  await page.waitForSelector('#team-screen:not(.hidden)');
  const archiveScreenshotPath = join(tmpdir(), 'bibish-match-history.png');
  await page.screenshot({ path: archiveScreenshotPath, fullPage: true });
  await page.click('.match-history-item');
  await page.waitForSelector('#match-details-screen:not(.hidden)');
  const detailScreenshotPath = join(tmpdir(), 'bibish-match-detail.png');
  await page.screenshot({ path: detailScreenshotPath, fullPage: true });
  const archive = await page.evaluate(() => ({
    title: document.querySelector('#match-details-title')?.textContent,
    rows: document.querySelectorAll('#history-leaderboard .end-leader-row').length,
    mapPixels: document.querySelector('#history-map-canvas')?.toDataURL().length || 0,
    worldAge: document.querySelector('#world-age-value')?.textContent,
    selectedTeam: document.querySelector('#history-team-tabs .active')?.dataset.team,
    selectedPlayers: document.querySelector('#history-detail-stats article:nth-child(4) strong')?.textContent,
  }));
  if (!archive.title?.includes('KAZANDI') || archive.rows < 1 || archive.mapPixels < 1000 || archive.selectedTeam !== 'red' || archive.selectedPlayers !== '24') {
    throw new Error(`Archived detail is incomplete: ${JSON.stringify(archive)}`);
  }
  await page.click('#history-loser-tab');
  const losingTeamStats = await page.evaluate(() => ({
    selectedTeam: document.querySelector('#history-team-tabs .active')?.dataset.team,
    selectedPlayers: document.querySelector('#history-detail-stats article:nth-child(4) strong')?.textContent,
    rows: document.querySelectorAll('#history-leaderboard .end-leader-row').length,
    names: [...document.querySelectorAll('#history-leaderboard .end-leader-row b')].map((node) => node.textContent),
  }));
  if (losingTeamStats.selectedTeam !== 'blue' || losingTeamStats.selectedPlayers !== '23' || losingTeamStats.rows < 1 || losingTeamStats.names.includes('Bibishçi')) {
    throw new Error(`Losing-team switch is incorrect: ${JSON.stringify(losingTeamStats)}`);
  }
  await page.click('#close-match-details');
  await page.evaluate(() => globalThis.__bibishDebug.previewMatchEnd('red', 'blue', false));
  const losingMessage = await page.locator('#winner-reason').textContent();
  if (!losingMessage?.includes('TÜYÜ KARŞI TAKIM DİKTİ')) throw new Error(`Missing losing copy: ${losingMessage}`);
  const emptyWorldBefore = await fetch(`${baseUrl}/__bibish/metrics`).then((response) => response.json());
  await new Promise((resolve) => setTimeout(resolve, 1100));
  const emptyWorldAfter = await fetch(`${baseUrl}/__bibish/metrics`).then((response) => response.json());
  const emptyWorldClock = {
    playersBefore: emptyWorldBefore.players,
    playersAfter: emptyWorldAfter.players,
    runningBefore: emptyWorldBefore.worldClockRunning,
    runningAfter: emptyWorldAfter.worldClockRunning,
    elapsedAdvanceMs: emptyWorldAfter.worldActiveElapsedMs - emptyWorldBefore.worldActiveElapsedMs,
  };
  if (emptyWorldClock.playersBefore !== 0 || emptyWorldClock.playersAfter !== 0
    || emptyWorldClock.runningBefore || emptyWorldClock.runningAfter || Math.abs(emptyWorldClock.elapsedAdvanceMs) > 50) {
    throw new Error(`Empty-world clock did not pause: ${JSON.stringify(emptyWorldClock)}`);
  }
  await page.click('#end-home-button');
  await page.evaluate(() => globalThis.__bibishDebug.joinLoadTest('red', 99));
  await page.waitForFunction(async () => {
    const response = await fetch('/__bibish/metrics');
    const data = await response.json();
    return data.players === 1 && data.worldClockRunning === true;
  }, null, { timeout: 10000 });
  const activeWorldBefore = await fetch(`${baseUrl}/__bibish/metrics`).then((response) => response.json());
  await new Promise((resolve) => setTimeout(resolve, 1100));
  const activeWorldAfter = await fetch(`${baseUrl}/__bibish/metrics`).then((response) => response.json());
  const activeWorldClock = {
    players: activeWorldAfter.players,
    running: activeWorldAfter.worldClockRunning,
    elapsedAdvanceMs: activeWorldAfter.worldActiveElapsedMs - activeWorldBefore.worldActiveElapsedMs,
  };
  if (activeWorldClock.players !== 1 || !activeWorldClock.running || activeWorldClock.elapsedAdvanceMs < 900) {
    throw new Error(`Active-world clock did not advance: ${JSON.stringify(activeWorldClock)}`);
  }
  const worldClock = await page.evaluate(() => {
    const fort = document.querySelector('#fort-strip').getBoundingClientRect();
    const clock = document.querySelector('#world-age').getBoundingClientRect();
    return {
      threeDays: globalThis.__bibishDebug.previewWorldAge(3 * 86400 + 5 * 3600),
      oneWeek: globalThis.__bibishDebug.previewWorldAge(8 * 86400 + 2 * 3600),
      visible: clock.width > 0 && clock.height > 0,
      belowForts: clock.top >= fort.bottom,
    };
  });
  if (!worldClock.visible || !worldClock.belowForts || !worldClock.threeDays.includes('3 GÜN') || !worldClock.oneWeek.includes('1 HAFTA')) {
    throw new Error(`World clock is incorrect: ${JSON.stringify(worldClock)}`);
  }
  if (errors.length) throw new Error(`Browser errors: ${errors.join(' | ')}`);
  console.log('BIBISH_MATCH_END_RESULT', JSON.stringify({ passed: true, recordId: record.id, end, archive, losingTeamStats, losingMessage, emptyWorldClock, activeWorldClock, worldClock, screenshotPath, archiveScreenshotPath, detailScreenshotPath }));
} finally {
  await context.close();
  await browser.close();
}

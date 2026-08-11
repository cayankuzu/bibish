import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CLOCK_SCHEMA_VERSION = 2;

function validElapsed(value) {
  const elapsed = Number(value);
  return Number.isFinite(elapsed) && elapsed >= 0 ? elapsed : null;
}

export function loadPersistentLocalWorldClock(root = process.cwd()) {
  const dataDirectory = resolve(root, '.bibish-data');
  const clockPath = resolve(dataDirectory, 'world-clock.json');
  const legacyCacheDirectory = resolve(root, 'node_modules', '.cache', 'bibish');
  const previousClockPath = resolve(legacyCacheDirectory, 'world-clock.json');
  const legacyClockPath = resolve(legacyCacheDirectory, 'world-started-at');
  let elapsedMs = null;

  const configured = Number(process.env.BIBISH_WORLD_STARTED_AT);
  if (Number.isFinite(configured) && configured > 0) {
    elapsedMs = Math.max(0, Date.now() - configured);
  } else {
    for (const storedClockPath of [clockPath, previousClockPath]) {
      try {
        const stored = JSON.parse(readFileSync(storedClockPath, 'utf8'));
        elapsedMs = validElapsed(stored?.activeElapsedMs);
      } catch {}
      if (elapsedMs !== null) break;
    }
  }

  // v1 used a wall-clock epoch that advanced even while the room was empty.
  // Migrate its current value once, then let v2 count connected-player time only.
  if (elapsedMs === null) {
    try {
      const legacyStartedAt = Number(readFileSync(legacyClockPath, 'utf8').trim());
      if (Number.isFinite(legacyStartedAt) && legacyStartedAt > 0 && legacyStartedAt <= Date.now() + 60_000) {
        elapsedMs = Math.max(0, Date.now() - legacyStartedAt);
      }
    } catch {}
  }

  elapsedMs ??= 0;

  const persist = ({ activeElapsedMs }) => {
    const safeElapsedMs = validElapsed(activeElapsedMs);
    if (safeElapsedMs === null) return;
    try {
      let durableElapsedMs = safeElapsedMs;
      try {
        const current = JSON.parse(readFileSync(clockPath, 'utf8'));
        durableElapsedMs = Math.max(durableElapsedMs, validElapsed(current?.activeElapsedMs) ?? 0);
      } catch {}
      mkdirSync(dataDirectory, { recursive: true });
      writeFileSync(clockPath, JSON.stringify({
        schemaVersion: CLOCK_SCHEMA_VERSION,
        // A stale Vite room closing after a config reload must never overwrite
        // a newer room's larger active-time value.
        activeElapsedMs: Math.round(durableElapsedMs),
        savedAt: Date.now(),
      }), 'utf8');
    } catch {
      // Salt okunur ortamlarda sayaç süreç ömrü boyunca doğru çalışmaya devam eder.
    }
  };

  persist({ activeElapsedMs: elapsedMs });
  return { activeElapsedMs: elapsedMs, persist };
}

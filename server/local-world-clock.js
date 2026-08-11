import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function loadPersistentLocalWorldStartedAt(root = process.cwd()) {
  const configured = Number(process.env.BIBISH_WORLD_STARTED_AT);
  if (Number.isFinite(configured) && configured > 0) return configured;

  const cacheDirectory = resolve(root, 'node_modules', '.cache', 'bibish');
  const clockPath = resolve(cacheDirectory, 'world-started-at');
  try {
    const stored = Number(readFileSync(clockPath, 'utf8').trim());
    if (Number.isFinite(stored) && stored > 0 && stored <= Date.now() + 60_000) return stored;
  } catch {}

  const startedAt = Date.now();
  try {
    mkdirSync(cacheDirectory, { recursive: true });
    writeFileSync(clockPath, String(startedAt), 'utf8');
  } catch {
    // Salt okunur bir ortamda sayaç yine çalışır; yalnızca yeniden başlatmada sıfırlanır.
  }
  return startedAt;
}

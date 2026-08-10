import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const staging = mkdtempSync(join(tmpdir(), 'bibish-cloudflare-'));
const wrangler = resolve(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js');

try {
  cpSync(resolve(root, 'cloudflare'), resolve(staging, 'cloudflare'), { recursive: true });
  cpSync(resolve(root, 'wrangler.jsonc'), resolve(staging, 'wrangler.jsonc'));
  const args = ['deploy', '--config', resolve(staging, 'wrangler.jsonc'), '--no-bundle'];
  if (process.argv.includes('--dry-run')) args.push('--dry-run');
  const result = spawnSync(process.execPath, [wrangler, ...args], {
    cwd: root,
    stdio: 'inherit',
    windowsHide: true,
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  const resolvedTemp = resolve(tmpdir());
  const resolvedStaging = resolve(staging);
  if (resolvedStaging.startsWith(`${resolvedTemp}\\`) || resolvedStaging.startsWith(`${resolvedTemp}/`)) {
    rmSync(resolvedStaging, { recursive: true, force: true });
  }
}

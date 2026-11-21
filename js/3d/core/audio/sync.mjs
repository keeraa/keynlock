/** Mirror the canonical music modules (core/audio) into the static scenes, which cannot import them.
 * Run at repository root: node js/3d/core/audio/sync.mjs --check|--sync
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const manifest = JSON.parse(await readFile(resolve(here, 'manifest.json'), 'utf8'));
const mode = process.argv.includes('--sync') ? 'sync' : 'check';
let changed = 0;
for (const module of manifest.modules) {
  const canonical = await readFile(resolve(here, module), 'utf8');
  for (const consumer of manifest.consumers) {
    const destination = resolve(root, consumer, module);
    let current = null;
    try { current = await readFile(destination, 'utf8'); } catch { /* missing copy */ }
    if (current === canonical) continue;
    changed++;
    if (mode === 'sync') {
      await writeFile(destination, canonical);
      process.stdout.write(`synced ${consumer}/${module}\n`);
    } else process.stderr.write(`out of sync ${consumer}/${module}\n`);
  }
}
if (mode === 'check' && changed) process.exitCode = 1;
else process.stdout.write(`${mode}: ${changed} mirror(s) ${mode === 'check' ? 'out of sync' : 'updated'}\n`);

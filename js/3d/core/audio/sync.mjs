/** Mirror the shared sound modules and recordings into the static scenes, which cannot import them.
 * Run at repository root: node js/3d/core/audio/sync.mjs --check|--sync
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const manifest = JSON.parse(await readFile(resolve(here, 'manifest.json'), 'utf8'));
const mode = process.argv.includes('--sync') ? 'sync' : 'check';
let changed = 0;
const files = [...manifest.modules, ...manifest.assets.map(asset => `../${asset}`)];
for (const file of files) {
  const canonical = await readFile(resolve(here, file));
  for (const consumer of manifest.consumers) {
    const destination = resolve(root, consumer, file);
    let current = null;
    try { current = await readFile(destination); } catch { /* missing copy */ }
    if (current?.equals(canonical)) continue;
    changed++;
    if (mode === 'sync') {
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, canonical);
      process.stdout.write(`synced ${consumer}/${file}\n`);
    } else process.stderr.write(`out of sync ${consumer}/${file}\n`);
  }
}
if (mode === 'check' && changed) process.exitCode = 1;
else process.stdout.write(`${mode}: ${changed} mirror(s) ${mode === 'check' ? 'out of sync' : 'updated'}\n`);

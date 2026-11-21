// One source per workshop inside the Lair.
//
// Each workshop lives in exactly one folder (WORKSHOPS). The room's own code in
// src/ imports from there instead of keeping a copy: copies drift (the old
// src/alchemy-core, src/atelier-core, src/workbench-core and public/stations/
// alchemy all had). This check fails when
//   - two files in the Lair have the same content (outside ALLOWED_COPIES), or
//   - src/ has a module with the same name as a workshop module.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

export const WORKSHOPS = {
  alchemy: 'integrations/alchemy',
  atelier: 'integrations/atelier',
  workbench: 'public/stations/workbench',
};

// Generated or installed folders, not sources.
const SKIP = new Set(['node_modules', 'dist', '.git', 'test-results',
  // `npm run build:atelier` output of integrations/atelier (CI keeps it fresh).
  'public/stations/atelier']);

// The workbench is a static page served from public/ without a bundler, so it
// cannot import the alchemy's Vite assets and keeps its own copies.
const ALLOWED_COPIES = [
  ['integrations/alchemy/src/assets/painted-brass.webp', 'public/stations/workbench/assets/painted-brass.webp'],
  ['integrations/alchemy/src/assets/painted-steel.webp', 'public/stations/workbench/assets/painted-steel.webp'],
];
// Entry points that every app has under the same name.
const COMMON_NAMES = new Set(['main.js']);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const rel = relative(root, path);
    if (SKIP.has(name) || SKIP.has(rel)) continue;
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(rel);
  }
  return out;
}

export function findProblems() {
  const problems = [];
  for (const [id, home] of Object.entries(WORKSHOPS))
    if (!existsSync(join(root, home))) problems.push(`workshop ${id}: ${home} is missing`);

  const files = walk(root);
  const byHash = new Map();
  for (const file of files) {
    const data = readFileSync(join(root, file));
    if (data.length < 256) continue; // tiny files (configs, stubs) match by chance
    const hash = createHash('sha1').update(data).digest('hex');
    byHash.set(hash, [...(byHash.get(hash) ?? []), file]);
  }
  const allowed = new Set(ALLOWED_COPIES.map(pair => [...pair].sort().join('\n')));
  for (const group of byHash.values()) {
    if (group.length > 1 && !allowed.has([...group].sort().join('\n')))
      problems.push(`same content in ${group.join(', ')}`);
  }

  const homes = Object.values(WORKSHOPS);
  const workshopModules = new Map();
  for (const file of files) {
    const home = homes.find(dir => file.startsWith(`${dir}/`));
    if (home && /\.m?js$/.test(file) && !file.includes('/vendor/'))
      workshopModules.set(basename(file), file);
  }
  for (const file of files) {
    if (!file.startsWith('src/') || !/\.m?js$/.test(file) || COMMON_NAMES.has(basename(file))) continue;
    const original = workshopModules.get(basename(file));
    if (original) problems.push(`${file} looks like a copy of ${original}: import the workshop's module instead`);
  }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const problems = findProblems();
  if (problems.length) {
    console.error(`One source per workshop: ${problems.length} problem(s)`);
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }
  console.log(`One source per workshop: ok (${Object.keys(WORKSHOPS).join(', ')})`);
}

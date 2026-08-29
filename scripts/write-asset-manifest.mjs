import { writeFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif']);
const assetsDir = resolve('assets');

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) { walk(full, out); continue; }
    const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
    if (IMAGE_EXT.has(ext)) out.push(relative('.', full).split('\\').join('/'));
  }
  return out;
}

const images = walk(assetsDir, []).sort();
writeFileSync(resolve('asset-manifest.json'), `${JSON.stringify({ images }, null, 2)}\n`, 'utf8');
console.log(`Asset manifest: ${images.length} images`);

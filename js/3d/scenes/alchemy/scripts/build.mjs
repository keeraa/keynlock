import { cpSync, copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = join(root, 'src');
const output = join(root, 'dist');
const shared = resolve(root, '../../shared/materials/metals');
const metals = ['brass', 'copper', 'enamel', 'graphite', 'steel'];

if (!existsSync(join(source, 'index.html'))) throw Error('Missing alchemy source');
for (const metal of metals) {
  if (!existsSync(join(shared, `painted-${metal}.webp`)))
    throw Error(`Missing shared material: ${metal}`);
}

// dist is generated and isolated from the committed version-28 lab snapshot.
rmSync(output, { recursive: true, force: true });
cpSync(source, output, { recursive: true });
mkdirSync(join(output, 'assets'), { recursive: true });
for (const metal of metals) {
  const name = `painted-${metal}.webp`;
  copyFileSync(join(shared, name), join(output, 'assets', name));
}
console.log(`Alchemy build ready: ${output}`);

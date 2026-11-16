import { cpSync, copyFileSync, existsSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = join(root, 'src');
const output = join(root, 'dist');
const shared = resolve(root, '../../shared/materials/metals');
const rendering = resolve(root, '../../core/rendering/painted-texture.js');
const backgroundBlur = resolve(root, '../../core/rendering/background-blur.js');
const metals = ['brass', 'copper', 'enamel', 'graphite', 'steel'];

if (!existsSync(join(source, 'index.html'))) throw Error('Missing alchemy source');
if (!existsSync(rendering)) throw Error('Missing shared rendering core');
if (!existsSync(backgroundBlur)) throw Error('Missing shared background blur core');
for (const metal of metals) {
  if (!existsSync(join(shared, `painted-${metal}.webp`)))
    throw Error(`Missing shared material: ${metal}`);
}

// dist is generated and isolated from the committed version-28 lab snapshot.
rmSync(output, { recursive: true, force: true });
cpSync(source, output, { recursive: true });
// The published scene is self-contained; its development imports use the repository core.
const visuals = join(output, 'visuals.js');
const externalSpecifier = '../../../core/rendering/painted-texture.js';
const code = readFileSync(visuals, 'utf8');
if (!code.includes(externalSpecifier)) throw Error('Missing shared rendering import');
writeFileSync(visuals, code.replace(externalSpecifier, './shared/painted-texture.js'));
mkdirSync(join(output, 'shared'), { recursive: true });
copyFileSync(rendering, join(output, 'shared/painted-texture.js'));
const background = join(output, 'background-effects.js');
const backgroundSource = readFileSync(background, 'utf8');
if (!backgroundSource.includes(externalSpecifier.replace('painted-texture', 'background-blur')))
  throw Error('Missing shared background blur import');
writeFileSync(background, backgroundSource.replace(
  externalSpecifier.replace('painted-texture', 'background-blur'), './shared/background-blur.js'));
copyFileSync(backgroundBlur, join(output, 'shared/background-blur.js'));
mkdirSync(join(output, 'assets'), { recursive: true });
for (const metal of metals) {
  const name = `painted-${metal}.webp`;
  copyFileSync(join(shared, name), join(output, 'assets', name));
}
console.log(`Alchemy build ready: ${output}`);

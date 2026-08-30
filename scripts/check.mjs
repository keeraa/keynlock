import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const posix = value => value.replaceAll('\\', '/');
const fail = message => { throw new Error(message); };

function walk(dir, predicate = () => true) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = resolve(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) out.push(...walk(full, predicate));
    else if (predicate(full)) out.push(full);
  }
  return out;
}

function localAttributeRefs(html, tag, attr) {
  const refs = [];
  const tagRe = new RegExp(`<${tag}\\b[^>]*>`, 'gi');
  const attrRe = new RegExp(`\\b${attr}=["']([^"']+)["']`, 'i');
  for (const match of html.matchAll(tagRe)) {
    const a = match[0].match(attrRe);
    if (a) refs.push(a[1]);
  }
  return refs.filter(x => !/^(?:https?:|data:|#)/i.test(x));
}

const htmlPath = resolve(root, 'index.html');
const html = readFileSync(htmlPath, 'utf8');
const scripts = localAttributeRefs(html, 'script', 'src');
const expectedScriptOrder = ["js/core/asset-preload.js","js/core/game-catalog.js","js/core/challenge-hud.js","js/core/tool-motion.js","js/core/game-defeat.js","js/core/state.js","js/core/puzzle-modes.js","js/core/audio.js","js/core/ui.js","js/world/inventory.js","js/world/lair.js","js/world/navigation-shop.js","js/core/digital-helpers.js","js/modes/heat-cold.js","js/modes/drum.js","js/modes/oscilloscope.js","js/core/game.js","js/modes/mass-effect.js","js/modes/anachronox.js","js/modes/composite.js","js/modes/tension.js","js/modes/resonance.js","js/modes/deduction.js","js/modes/skyrim.js","js/modes/risen2.js","js/modes/gothic1.js","js/modes/hillsfar.js","js/modes/oblivion.js","js/modes/watchmen.js","js/modes/museum.js","js/modes/mass2.js","js/modes/pipeline.js","js/modes/wharf.js","js/modes/thiefds.js","js/modes/kingdomcome.js","js/modes/thief12.js","js/modes/fallout.js","js/modes/anachlab.js","js/modes/masshack.js","js/modes/pathologic.js","js/modes/bioshock2.js","js/modes/alphaprotocol.js","js/modes/base-locks.js","js/world/alchemy.js","js/world/guards.js","js/world/missions.js","js/world/game-settings.js","js/world/collection.js","js/core/init.js","js/core/inventory-hit-testing.js"];
if (JSON.stringify(scripts) !== JSON.stringify(expectedScriptOrder)) fail('JavaScript load order changed; classic scripts share one lexical environment.');
const links = localAttributeRefs(html, 'link', 'href').filter(x => x.endsWith('.css'));

for (const ref of [...scripts, ...links]) {
  if (!existsSync(resolve(root, ref))) fail(`Missing index resource: ${ref}`);
}

const jsFiles = walk(resolve(root, 'js'), f => f.endsWith('.js'));
for (const file of jsFiles) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) fail(`JS syntax failed: ${posix(relative(root, file))}\n${result.stderr}`);
}

const indexedScripts = new Set(scripts.map(posix));
const actualScripts = new Set(jsFiles.map(f => posix(relative(root, f))));
for (const path of actualScripts) if (!indexedScripts.has(path)) fail(`JS file not loaded by index.html: ${path}`);
for (const path of indexedScripts) if (!actualScripts.has(path)) fail(`index.html loads unknown JS file: ${path}`);

const cssFiles = walk(resolve(root, 'css'), f => f.endsWith('.css'));
const indexedCss = new Set(links.map(posix));
for (const file of cssFiles) {
  const path = posix(relative(root, file));
  if (!indexedCss.has(path)) fail(`CSS file not loaded by index.html: ${path}`);
}

const sourceFiles = [htmlPath, ...cssFiles, ...jsFiles];
const assetPattern = /(?:\.\.\/|\.\/)?assets\/[A-Za-z0-9_./-]+\.(?:png|webp|jpe?g|svg|gif|woff2?)/gi;
let checkedAssets = 0;
for (const source of sourceFiles) {
  const text = readFileSync(source, 'utf8');
  if (/data:image|;base64,/i.test(text)) fail(`Embedded asset found in ${posix(relative(root, source))}`);
  if (/\/css\/assets\//i.test(text)) fail(`Broken /css/assets path found in ${posix(relative(root, source))}`);
  const refs = [...text.matchAll(assetPattern)].map(m => m[0]);
  const sourceIsCss = source.endsWith('.css');
  for (const ref of refs) {
    const resolved = sourceIsCss ? resolve(dirname(source), ref) : resolve(root, ref.replace(/^\.\//, ''));
    if (!existsSync(resolved)) fail(`Missing asset ${ref} referenced by ${posix(relative(root, source))}`);
    checkedAssets++;
  }
}

const ids = [...html.matchAll(/\bid=["']([^"']+)["']/gi)].map(m => m[1]);
const duplicates = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
if (duplicates.length) fail(`Duplicate HTML ids: ${duplicates.join(', ')}`);

const catalogueSource = readFileSync(resolve(root, 'js/core/game-catalog.js'), 'utf8');
const catalogueEntries = [...catalogueSource.matchAll(/^\s*(?:'([^']+)'|([a-z][\w-]*)):\{title:[^\n]+kind:'(native|prototype)'/gm)]
  .map(match => ({ id: match[1] || match[2], kind: match[3] }));
const nativeGames = catalogueEntries.filter(entry => entry.kind === 'native').map(entry => entry.id);
const openerSource = readFileSync(resolve(root, 'js/modes/base-locks.js'), 'utf8').match(/GameActions\.registerOpeners\(\{([\s\S]*?)\n\s*\}\);/)?.[1] || '';
const registeredOpeners = new Set([...openerSource.matchAll(/^\s*([a-z][\w-]*):/gm)].map(match => match[1]));
const missingOpeners = nativeGames.filter(id => !registeredOpeners.has(id));
if (missingOpeners.length) fail(`Native games missing a shared open action: ${missingOpeners.join(', ')}`);
const tensionGuardSource = readFileSync(resolve(root, 'js/core/inventory-hit-testing.js'), 'utf8');
if (!tensionGuardSource.includes('tryOpenBaseLock=guardOpen(tryOpenBaseLock)')) {
  fail('Classic base-lock opener must enforce the typed tensioner guard.');
}
const physicalNativeGames = catalogueEntries
  .filter(entry => entry.kind === 'native')
  .filter(entry => new RegExp(`^\\s*${entry.id}:\\{[^\\n]+lock:\\{present:true,manualOpen:true,specialTool:true\\}`,'m').test(catalogueSource))
  .map(entry => entry.id);
const expectedTypedTensionGames = ['classic','target','line','sequence','special','g1'];
if (JSON.stringify(physicalNativeGames) !== JSON.stringify(expectedTypedTensionGames)) {
  fail('Physical native games and typed-tension catalogue flags are out of sync.');
}
if (!tensionGuardSource.includes("const typedTensionModes=new Set(['classic','target','line','sequence','special','g1'])")) {
  fail('Typed-tension mode list must match games that render typed plates and a tensioner.');
}
if (!tensionGuardSource.includes("GameActions.registerOpenGuard('g1',()=>!forceWrongTensionBreak())")) {
  fail('Gothic 1 opener must enforce the typed tensioner guard.');
}

const version = readFileSync(resolve(root, 'VERSION'), 'utf8').trim();
console.log(`KEYNLOCK check OK — v${version}`);
console.log(`${jsFiles.length} JS files, ${cssFiles.length} CSS files, ${ids.length} unique HTML ids, ${checkedAssets} asset references.`);

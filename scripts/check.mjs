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
const expectedScriptOrder = ["js/core/state.js","js/core/audio.js","js/core/ui.js","js/world/inventory.js","js/world/lair.js","js/world/navigation-shop.js","js/core/digital-helpers.js","js/modes/heat-cold.js","js/modes/drum.js","js/modes/oscilloscope.js","js/core/game.js","js/modes/mass-effect.js","js/modes/anachronox.js","js/modes/composite.js","js/modes/tension.js","js/modes/resonance.js","js/modes/deduction.js","js/modes/skyrim.js","js/modes/risen2.js","js/modes/gothic1.js","js/modes/hillsfar.js","js/modes/base-locks.js","js/world/alchemy.js","js/world/guards.js","js/world/missions.js","js/world/prototype-mechanics.js","js/core/init.js","js/core/inventory-hit-testing.js"];
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

const modeTabs = [
  'tabClassic','tabTarget','tabLine','tabAlt2','tabSpecial','tabHillsfar','tabMass','tabG1','tabR2',
  'tabSkyrim','tabAnach','tabTension','tabResonance','tabDeduction','tabComposite','tabHeatCold','tabDrum','tabScope'
];
for (const id of modeTabs) if (!ids.includes(id)) fail(`Missing mode tab: ${id}`);

const prototypeHtml = readFileSync(resolve(root, 'prototypes/lockpicking-mechanics-v63.html'), 'utf8');
const prototypeScenes = new Set([...prototypeHtml.matchAll(/<section\b[^>]*\bdata-name=["']([^"']+)["']/gi)].map(match => match[1]));
const prototypeWorld = readFileSync(resolve(root, 'js/world/prototype-mechanics.js'), 'utf8');
const placesSource = prototypeWorld.match(/const PROTOTYPE_MECHANIC_PLACES=\[([\s\S]*?)\n\s*\];/)?.[1] || '';
const mappedPrototypeGames = new Set([...placesSource.matchAll(/\bgame:'([^']+)'/g)].map(match => match[1]));
const missingPrototypeGames = [...prototypeScenes].filter(game => !mappedPrototypeGames.has(game));
const unknownPrototypeGames = [...mappedPrototypeGames].filter(game => !prototypeScenes.has(game));
if (missingPrototypeGames.length) fail(`Prototype games missing from map: ${missingPrototypeGames.join(', ')}`);
if (unknownPrototypeGames.length) fail(`Map references unknown prototype games: ${unknownPrototypeGames.join(', ')}`);

const version = readFileSync(resolve(root, 'VERSION'), 'utf8').trim();
console.log(`KEYNLOCK check OK — v${version}`);
console.log(`${jsFiles.length} JS files, ${cssFiles.length} CSS files, ${ids.length} unique HTML ids, ${checkedAssets} asset references, ${prototypeScenes.size} mapped prototype games checked.`);

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

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

function assertBalancedCss(css,path){
  let depth=0,quote='',comment=false;
  for(let i=0;i<css.length;i++){
    const char=css[i],next=css[i+1];
    if(comment){if(char==='*'&&next==='/'){comment=false;i++;}continue;}
    if(quote){if(char==='\\'){i++;continue;}if(char===quote)quote='';continue;}
    if(char==='/'&&next==='*'){comment=true;i++;continue;}
    if(char==='"'||char==="'"){quote=char;continue;}
    if(char==='{')depth++;
    if(char==='}'&&--depth<0)fail(`Unexpected CSS closing brace in ${path}`);
  }
  if(comment||quote||depth!==0)fail(`Unbalanced CSS syntax in ${path}`);
}

const htmlPath = resolve(root, 'index.html');
const html = readFileSync(htmlPath, 'utf8');
const scripts = localAttributeRefs(html, 'script', 'src');
const expectedScriptOrder = ["js/core/asset-preload.js","js/core/game-catalog.js","js/core/challenge-hud.js","js/core/tool-motion.js","js/core/game-defeat.js","js/core/state.js","js/core/puzzle-modes.js","js/core/audio.js","js/core/ui.js","js/world/inventory.js","js/world/lair.js","js/world/navigation.js","js/core/digital-helpers.js","js/modes/drum.js","js/modes/oscilloscope.js","js/core/game.js","js/modes/anachronox.js","js/modes/composite.js","js/modes/tension.js","js/modes/resonance.js","js/modes/deduction.js","js/modes/skyrim.js","js/modes/gothic1.js","js/modes/hillsfar.js","js/modes/oblivion.js","js/modes/watchmen.js","js/modes/museum.js","js/modes/mass2.js","js/modes/pipeline.js","js/modes/wharf.js","js/modes/thiefds.js","js/modes/kingdomcome.js","js/modes/thief12.js","js/modes/fallout.js","js/modes/masshack.js","js/modes/pathologic.js","js/modes/bioshock2.js","js/modes/alphaprotocol.js","js/modes/base-locks.js","js/world/alchemy-stations.js","js/world/alchemy-ui.js","js/world/alchemy-inventory.js","js/world/guards.js","js/world/missions.js","js/world/game-settings.js","js/world/collection.js","js/core/init.js","js/core/inventory-hit-testing.js"];
expectedScriptOrder.splice(1,0,'js/core/main-menu.js');
expectedScriptOrder.splice(1,0,'js/data/world.js','js/data/economy.js','js/data/restoration.js','js/data/paintings.js');
expectedScriptOrder.splice(1,0,'js/core/save-store.js');
expectedScriptOrder.splice(expectedScriptOrder.indexOf('js/core/puzzle-modes.js'),0,'js/core/resources.js');
expectedScriptOrder.splice(expectedScriptOrder.indexOf('js/world/guards.js'),0,'js/world/restoration.js');
expectedScriptOrder.splice(expectedScriptOrder.indexOf('js/world/guards.js'),0,'js/core/painting-rewards.js');
expectedScriptOrder.splice(expectedScriptOrder.indexOf('js/world/alchemy-stations.js'),0,'js/world/alchemy-engine.js');
expectedScriptOrder.splice(expectedScriptOrder.indexOf('js/world/alchemy-stations.js'),0,'js/world/alchemy-distillation.js');
expectedScriptOrder.splice(expectedScriptOrder.indexOf('js/world/alchemy-ui.js'),0,'js/world/alchemy-pigments.js');
expectedScriptOrder.push('js/core/tooltips.js');
if (JSON.stringify(scripts) !== JSON.stringify(expectedScriptOrder)) fail('JavaScript load order changed; classic scripts share one lexical environment.');
const links = localAttributeRefs(html, 'link', 'href').filter(x => x.endsWith('.css'));

const contentContext = { window: {} };
for (const ref of ['js/data/world.js','js/data/economy.js','js/data/restoration.js','js/data/paintings.js']) {
  runInNewContext(readFileSync(resolve(root, ref), 'utf8'), contentContext, { filename: ref });
}
const content = contentContext.window.KeynlockContent;
if (!content?.world || !content?.economy || !content?.restoration || !content?.paintings) fail('Content catalog is incomplete.');
const districtIds = new Set(Object.keys(content.world.districts));
const componentIds = new Set(content.economy.components.map(item => item.id));
const paintingIds = content.paintings.map(item => item.id);
const gameCatalogSource = readFileSync(resolve(root, 'js/core/game-catalog.js'), 'utf8');
const gameDefinitionBlock = gameCatalogSource.split('const GAME_DEFINITIONS={')[1]?.split('// Scene art belongs')[0] || '';
const gameIds = new Set([...gameDefinitionBlock.matchAll(/^\s{2}([a-z0-9]+):\{/gm)].map(match => match[1]));
if (new Set(paintingIds).size !== paintingIds.length) fail('Painting ids must be unique.');
for (const painting of content.paintings) {
  if (!painting.id || !painting.title || !painting.artist || !painting.year || !painting.image) fail(`Incomplete painting: ${painting.id || 'unknown'}`);
  if (!painting.colors.every(color => componentIds.has(color))) fail(`Unknown reward color in painting: ${painting.id}`);
}
for (const place of content.world.missionPlaces) {
  if (!gameIds.has(place.mode)) fail(`Unknown mission game: ${place.mode}`);
  if (!districtIds.has(place.district)) fail(`Unknown mission district: ${place.district}`);
  if (!Number.isFinite(place.x) || !Number.isFinite(place.y)) fail(`Invalid mission coordinates: ${place.mode}`);
}
for (const district of Object.values(content.restoration.categoryDistricts)) {
  if (!districtIds.has(district)) fail(`Unknown restoration district: ${district}`);
}

for (const ref of [...scripts, ...links]) {
  if (!existsSync(resolve(root, ref))) fail(`Missing index resource: ${ref}`);
}

const jsFiles = walk(resolve(root, 'js'), f => f.endsWith('.js'));
for (const file of jsFiles) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) fail(`JS syntax failed: ${posix(relative(root, file))}\n${result.stderr}`);
}
const moduleFiles = walk(resolve(root, 'js/modules'), f => f.endsWith('.mjs'));
for (const file of moduleFiles) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) fail(`Module syntax failed: ${posix(relative(root, file))}\n${result.stderr}`);
}
for (const file of [...jsFiles,...moduleFiles]) {
  if (file.endsWith('/core/save-store.js')) continue;
  if (/\blocalStorage\b/.test(readFileSync(file,'utf8'))) fail(`Direct localStorage access outside SaveStore: ${posix(relative(root,file))}`);
}
const forbiddenWindowBridges=[
  ['js/world/missions.js','window.awardMissionPainting'],
  ['js/core/ui.js','window.awardMissionPainting']
];
for(const [path,token] of forbiddenWindowBridges){
  if(readFileSync(resolve(root,path),'utf8').includes(token))fail(`Legacy global bridge returned: ${token} in ${path}`);
}
const alchemyStationSource=readFileSync(resolve(root,'js/world/alchemy-stations.js'),'utf8');
if(alchemyStationSource.includes('window.requestAnimationFrame.bind(window)'))fail('Alchemy station code bypasses its animation scheduler.');
if(!alchemyStationSource.includes('window.KeynlockAlchemyEngine'))fail('Alchemy stations must use the isolated engine service.');
if(!alchemyStationSource.includes('window.KeynlockAlchemyDistillation.create'))fail('Distillation must stay isolated from the station coordinator.');

const indexedScripts = new Set(scripts.map(posix));
const actualScripts = new Set(jsFiles.map(f => posix(relative(root, f))));
for (const path of actualScripts) if (!indexedScripts.has(path)) fail(`JS file not loaded by index.html: ${path}`);
for (const path of indexedScripts) if (!actualScripts.has(path)) fail(`index.html loads unknown JS file: ${path}`);

const cssFiles = walk(resolve(root, 'css'), f => f.endsWith('.css'));
const indexedCss = new Set(links.map(posix));
for (const file of cssFiles) {
  const path = posix(relative(root, file));
  if (!indexedCss.has(path)) fail(`CSS file not loaded by index.html: ${path}`);
  const css=readFileSync(file,'utf8');
  assertBalancedCss(css,path);
  if(/@media[^{}]*\{\s*\}/s.test(css))fail(`Empty media query in ${path}`);
}

const cssText=cssFiles.map(file=>readFileSync(file,'utf8')).join('\n');
const cssWithoutComments=cssText.replace(/\/\*[\s\S]*?\*\//g,'');
const importantCount=(cssWithoutComments.match(/!important/g)||[]).length;
if(importantCount>2215)fail(`CSS specificity budget regressed: ${importantCount} !important declarations (budget 2215).`);
if(Buffer.byteLength(cssText)>380000)fail('CSS source-size budget exceeded (380 KB).');

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
const expectedTypedTensionGames = ['classic','sequence','special','g1'];
if (JSON.stringify(physicalNativeGames) !== JSON.stringify(expectedTypedTensionGames)) {
  fail('Physical native games and typed-tension catalogue flags are out of sync.');
}
if (!tensionGuardSource.includes("const typedTensionModes=new Set(['classic','sequence','special','g1'])")) {
  fail('Typed-tension mode list must match games that render typed plates and a tensioner.');
}
if (!tensionGuardSource.includes("GameActions.registerOpenGuard('g1',()=>!forceWrongTensionBreak())")) {
  fail('Gothic 1 opener must enforce the typed tensioner guard.');
}

const version = readFileSync(resolve(root, 'VERSION'), 'utf8').trim();
console.log(`KEYNLOCK check OK — v${version}`);
console.log(`${jsFiles.length} JS files, ${cssFiles.length} CSS files, ${ids.length} unique HTML ids, ${checkedAssets} asset references.`);

#!/usr/bin/env node
// Cache busting for the Key Archive without hand-written `?v=` tags.
//
// Source modules import each other by plain relative paths ('./rules.js').
// This script hashes every module, vendor file and stylesheet in dist/ and
// writes an import map into dist/index.html that sends each plain URL to
// `URL?v=<content hash>`. The browser resolves every importer through the
// same map, so a module always has exactly one URL, and the URL changes
// exactly when the file's content does. The root index.html is regenerated
// as dist/index.html plus a <base href="./dist/" />.
//
//   node scripts/import-map.mjs          rewrite both index.html files
//   node scripts/import-map.mjs --check  exit 1 if they are stale
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const BASE_LINE = '  <base href="./dist/" />\n';
const START = '<!-- import-map:start -->';
const END = '<!-- import-map:end -->';

function walk(dir, test, out = []) {
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, test, out);
    else if (test(name)) out.push(path);
  }
  return out;
}

export function contentHash(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 10);
}

const urlOf = path => './' + relative(DIST, path).split(sep).join('/');

export function buildImportMap() {
  const modules = [...walk(join(DIST, 'js'), n => n.endsWith('.js')),
    ...walk(join(DIST, 'vendor'), n => n.endsWith('.js'))];
  const imports = {};
  for (const path of modules) imports[urlOf(path)] = `${urlOf(path)}?v=${contentHash(path)}`;
  return { imports };
}

export function renderDistIndex(html = readFileSync(join(DIST, 'index.html'), 'utf8')) {
  const map = JSON.stringify(buildImportMap(), null, 2).replace(/\n/g, '\n  ');
  const block = `${START}\n  <script type="importmap">\n  ${map}\n  </script>\n  ${END}`;
  let out = html.includes(START)
    ? html.replace(new RegExp(`${START}[\\s\\S]*?${END}`), block)
    : html.replace('</head>', `  ${block}\n</head>`);
  // A script's src does not go through the map, so the entry uses the very URL
  // the map gives main.js: one module instance, versioned like the rest.
  const entry = buildImportMap().imports['./js/main.js'];
  out = out.replace(/<script type="module"(?: src="\.\/js\/main\.js[^"]*")?>(?:import '\.\/js\/main\.js';)?<\/script>/,
    `<script type="module" src="${entry}"></script>`);
  out = out.replace(/href="\.\/([\w-]+\.css)(\?v=[^"]*)?"/g,
    (_, file) => `href="./${file}?v=${contentHash(join(DIST, file))}"`);
  return out;
}

export function renderRootIndex(distHtml) {
  return distHtml.replace(/(<meta charset[^>]*>\n)/, `$1${BASE_LINE}`);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const distPath = join(DIST, 'index.html');
  const rootPath = join(ROOT, 'index.html');
  const dist = renderDistIndex();
  const root = renderRootIndex(dist);
  const stale = [[distPath, dist], [rootPath, root]]
    .filter(([path, text]) => readFileSync(path, 'utf8') !== text);
  if (process.argv.includes('--check')) {
    if (stale.length) {
      console.error(`import-map: ${stale.map(([p]) => relative(ROOT, p)).join(', ')} out of date; run node scripts/import-map.mjs`);
      process.exit(1);
    }
    console.log('import-map: up to date');
  } else {
    for (const [path, text] of stale) writeFileSync(path, text);
    console.log(`import-map: ${stale.length} file(s) updated`);
  }
}

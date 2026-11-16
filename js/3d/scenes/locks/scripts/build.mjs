/** Production Site build: local Three.js r187, tree-shaken and minified. */
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, copyFileSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = join(root, 'src');
const target = join(root, 'dist');
const staging = join(root, '.tmp-site-build');
if (target === root || !target.startsWith(root + '/')) throw Error('Unsafe build directory');

const threeModules = {
  three: 'three.js',
  'three/core': 'three-core.js',
  'three/addons/controls/OrbitControls.js': 'OrbitControls.js',
  'three/addons/geometries/RoundedBoxGeometry.js': 'RoundedBoxGeometry.js',
};
const vendor = Object.fromEntries(Object.entries(threeModules).map(([name, file]) =>
  [name, join(source, 'vendor', file)]));

// The staging directory is derived output, never authored code or user data.
rmSync(staging, { recursive: true, force: true });
mkdirSync(staging, { recursive: true });
const result = await build({
  entryPoints: [join(source, 'js/main.js')],
  outfile: join(staging, 'app.js'),
  bundle: true,
  minify: true,
  treeShaking: true,
  format: 'esm',
  platform: 'browser',
  target: ['chrome110', 'firefox115', 'safari16'],
  legalComments: 'inline',
  metafile: true,
  logLevel: 'info',
  plugins: [{
    name: 'locked-three-r187',
    setup(config) {
      config.onResolve({ filter: /^three(?:\/.*)?$/ }, args => {
        const path = vendor[args.path];
        if (!path) throw Error(`Unknown Three.js import: ${args.path}`);
        return { path };
      });
    },
  }],
});

const html = readFileSync(join(source, 'index.html'), 'utf8');
let output = html.replace(/\s*<script type="importmap">[\s\S]*?<\/script>/, '');
const replacements = [
  ['./styles/app.css', './app.css'],
  ['./js/main.js', './app.js'],
  ['./js/startup.js', './startup.js'],
];
for (const [original, updated] of replacements) {
  if (!output.includes(original)) throw Error(`HTML does not contain ${original}`);
  output = output.replace(original, updated);
}
writeFileSync(join(staging, 'index.html'), output);
copyFileSync(join(source, 'styles/app.css'), join(staging, 'app.css'));
copyFileSync(join(source, 'js/startup.js'), join(staging, 'startup.js'));
cpSync(join(source, 'assets'), join(staging, 'assets'), { recursive: true });

const inputBytes = Object.values(result.metafile.inputs).reduce((sum, entry) => sum + entry.bytes, 0);
const bundleBytes = statSync(join(staging, 'app.js')).size;
const report = {
  bundler: 'esbuild',
  treeShaking: true,
  minified: true,
  sourceBytes: inputBytes,
  outputBundleBytes: bundleBytes,
  reductionPercent: Math.round((1 - bundleBytes / inputBytes) * 100),
  inputs: Object.keys(result.metafile.inputs).length,
};
mkdirSync(join(root, 'reports'), { recursive: true });
writeFileSync(join(root, 'reports/bundle.json'), JSON.stringify(report, null, 2) + '\n');
rmSync(target, { recursive: true, force: true });
cpSync(staging, target, { recursive: true });
rmSync(staging, { recursive: true, force: true });
console.log(`Bundled ${report.inputs} modules, ${Math.round(bundleBytes / 1024)} KB, ${report.reductionPercent}% smaller than source JS`);

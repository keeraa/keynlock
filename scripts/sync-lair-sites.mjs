import { execFileSync } from 'node:child_process';
import { closeSync, cpSync, existsSync, mkdtempSync, openSync, realpathSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const upstream = 'https://github.com/keeraa/keynlock.git';
const mainRef = 'refs/heads/main';
const projectId = 'appgprj_6afb3a865d3481918f34f2226b7ab2d6';
const github = realpathSync(fileURLToPath(new URL('../', import.meta.url)));
const sourcePaths = [
  'js/3d/scenes/lair',
  'js/3d/core',
  'js/3d/workshops',
  'js/3d/package.json',
  'js/3d/package-lock.json',
];
const hostingPath = '.openai/hosting.json';
const metadataPaths = ['.gitignore', hostingPath];

function git(cwd, args, options = {}) {
  return execFileSync('git', args, {
    cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024, ...options,
  });
}

function currentMain() {
  const [sha, ref] = git(github, ['ls-remote', '--exit-code', upstream, mainRef]).trim().split(/\s+/);
  if (ref !== mainRef || !/^[0-9a-f]{40}$/.test(sha)) {
    throw new Error('Could not resolve keeraa/keynlock main.');
  }
  try {
    git(github, ['cat-file', '-e', `${sha}^{commit}`]);
  } catch {
    git(github, ['fetch', '--no-tags', '--no-write-fetch-head', upstream, sha]);
  }
  return sha;
}

function entries(cwd, revision, paths = []) {
  return git(cwd, ['ls-tree', '-rz', revision, '--', ...paths]);
}

function treeFromEntries(cwd, input, index) {
  const env = { ...process.env, GIT_INDEX_FILE: index };
  git(cwd, ['update-index', '-z', '--index-info'], { input, env });
  return git(cwd, ['write-tree'], { env }).trim();
}

function requireMatchingContents(checkout, expectedTree) {
  if (git(checkout, ['write-tree']).trim() !== expectedTree ||
      git(checkout, ['diff', '--name-only', '--']).trim() ||
      git(checkout, ['ls-files', '--others', '--exclude-standard']).trim()) {
    throw new Error('The Site index or working files differ from GitHub main. Prepare a clean Sites checkout.');
  }
}

function importSource(checkout, main, source, scratch) {
  if (git(checkout, ['status', '--porcelain']).trim()) {
    throw new Error('The Site checkout has local changes. Preserve them and open a clean checkout.');
  }
  const currentSource = entries(checkout, 'HEAD', ['js']);
  if (currentSource === source) return;

  const revisions = git(github, ['log', '--first-parent', '--format=%H', main, '--', ...sourcePaths]);
  if (!revisions.trim().split('\n').some(sha => entries(github, sha, sourcePaths) === currentSource)) {
    throw new Error('Sites has source changes outside GitHub main history. Reconcile them in GitHub before publishing.');
  }

  const tree = treeFromEntries(github, source, join(scratch, 'github.index'));
  const pack = join(scratch, 'lair.pack');
  const output = openSync(pack, 'wx');
  try {
    git(github, ['pack-objects', '--stdout', '--revs'], { input: `${tree}\n`, stdio: ['pipe', output, 'pipe'] });
  } finally {
    closeSync(output);
  }
  const input = openSync(pack, 'r');
  try {
    git(checkout, ['unpack-objects', '-q'], { stdio: [input, 'ignore', 'pipe'] });
  } finally {
    closeSync(input);
  }
}

function build(checkout, expectedTree, source, scratch) {
  git(checkout, ['check-ignore', '--quiet', 'dist/']);
  const exportDir = join(scratch, 'source');
  git(checkout, ['checkout-index', '--all', `--prefix=${exportDir}/`]);
  const workspace = join(exportDir, 'js/3d');
  for (const args of [
    ['ci', '--no-audit', '--no-fund'],
    ['run', 'check', '-w', 'keynlock-lair'],
    ['run', 'check:sources', '-w', 'keynlock-lair'],
    ['run', 'build', '-w', 'keynlock-lair'],
  ]) {
    execFileSync('npm', args, { cwd: workspace, stdio: 'inherit' });
  }

  const output = join(workspace, 'scenes/lair/dist');
  if (!existsSync(join(output, 'index.html')) || !existsSync(join(output, 'stations/workbench/index.html'))) {
    throw new Error('The production build is missing the Lair or workbench entry point.');
  }
  requireMatchingContents(checkout, expectedTree);
  if (entries(github, currentMain(), sourcePaths) !== source) {
    throw new Error('Lair sources changed on GitHub main during the build. Prepare and build again.');
  }

  const candidate = mkdtempSync(join(checkout, '.lair-dist-'));
  try {
    cpSync(output, join(candidate, 'new'), { recursive: true });
    const dist = join(checkout, 'dist');
    const previous = join(candidate, 'previous');
    if (existsSync(dist)) renameSync(dist, previous);
    try {
      renameSync(join(candidate, 'new'), dist);
    } catch (error) {
      if (existsSync(previous)) renameSync(previous, dist);
      throw error;
    }
  } finally {
    rmSync(candidate, { recursive: true, force: true });
  }
}

function run([action, target, ...extra]) {
  if (!['prepare', 'verify', 'build'].includes(action) || !target || extra.length) {
    throw new Error('Usage: node scripts/sync-lair-sites.mjs <prepare|verify|build> <sites-checkout>');
  }
  if (['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR'].some(key => process.env[key])) {
    throw new Error('Run without Git directory or index overrides.');
  }
  const checkout = realpathSync(target);
  if (checkout === github || realpathSync(git(checkout, ['rev-parse', '--show-toplevel']).trim()) !== checkout) {
    throw new Error('Pass the root of the separate Lair Sites source checkout.');
  }

  const hosting = JSON.parse(git(checkout, ['show', `HEAD:${hostingPath}`]));
  if (hosting.project_id !== projectId || hosting.static?.directory !== 'dist') {
    throw new Error('Pass the existing Lair Site with its dist hosting configuration.');
  }
  const metadata = entries(checkout, 'HEAD', metadataPaths);
  const siteSource = entries(checkout, 'HEAD', ['js']);
  if (entries(checkout, 'HEAD') !== metadata + siteSource) {
    throw new Error('Sites tracks files outside the Lair workspace and hosting metadata. Review them before publishing.');
  }

  const main = currentMain();
  const source = entries(github, main, sourcePaths);
  const scratch = mkdtempSync(join(tmpdir(), 'keynlock-lair-sites-'));
  try {
    if (action === 'prepare') importSource(checkout, main, source, scratch);
    const siteIndex = (metadata + source).replace(/(^|\0)(\d+) (?:blob|commit) ([0-9a-f]+)\t/g, '$1$2 $3 0\t');
    if (action !== 'prepare' && git(checkout, ['ls-files', '--stage', '-z']) !== siteIndex) {
      throw new Error('The Site source differs from GitHub main. Run prepare first.');
    }
    const expectedTree = treeFromEntries(checkout, metadata + source, join(scratch, 'sites.index'));
    const siteTree = git(checkout, ['rev-parse', 'HEAD^{tree}']).trim();
    if (action === 'prepare' && siteTree !== expectedTree) {
      git(checkout, ['read-tree', '-m', '-u', 'HEAD', expectedTree]);
    }
    requireMatchingContents(checkout, expectedTree);
    if (action === 'build') build(checkout, expectedTree, source, scratch);
    console.log(JSON.stringify({
      project_id: projectId, github_main: main, source_tree: expectedTree,
      sites_checkout: checkout, source_changed: siteTree !== expectedTree,
    }));
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

try {
  run(process.argv.slice(2));
} catch (error) {
  console.error(error.stderr?.toString().trim() || error.message);
  process.exitCode = 1;
}

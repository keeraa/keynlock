import { execFileSync } from 'node:child_process';
import { closeSync, mkdtempSync, openSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const upstream = 'https://github.com/keeraa/keynlock.git';
const mainRef = 'refs/heads/main';
const scene = 'js/3d/scenes/city';
const hostingPath = '.openai/hosting.json';
const github = realpathSync(fileURLToPath(new URL('../', import.meta.url)));

const git = (cwd, ...args) => execFileSync('git', args, {
  cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
}).trim();

function currentMain() {
  const [sha, ref] = git(github, 'ls-remote', '--exit-code', upstream, mainRef).split(/\s+/);
  if (ref !== mainRef || !/^[0-9a-f]{40}$/.test(sha)) {
    throw new Error('Could not resolve keeraa/keynlock main.');
  }
  try {
    git(github, 'cat-file', '-e', `${sha}^{commit}`);
  } catch {
    git(github, 'fetch', '--no-tags', upstream, sha);
  }
  return sha;
}

function requireHosting(sourceTree, checkout) {
  const source = JSON.parse(git(github, 'show', `${sourceTree}:${hostingPath}`));
  const target = JSON.parse(git(checkout, 'show', `HEAD:${hostingPath}`));
  if (!source.project_id || source.project_id !== target.project_id ||
      source.static?.directory !== 'dist' || target.static?.directory !== 'dist') {
    throw new Error('The checkout must be the existing World Map Site with its dist hosting configuration.');
  }
  return source.project_id;
}

function mainHistoryContains(main, siteTree) {
  const revisions = git(github, 'log', '--first-parent', '--format=%H', main, '--', scene);
  return revisions.split('\n').filter(Boolean).some(sha => {
    const entry = git(github, 'ls-tree', sha, '--', scene);
    return entry.split(/\s+/)[2] === siteTree;
  });
}

// Copy only the objects for the city subtree. The Site retains its own Git history.
function importTree(sourceTree, checkout) {
  const staging = mkdtempSync(join(tmpdir(), 'keynlock-world-map-'));
  try {
    const pack = join(staging, 'world-map.pack');
    const output = openSync(pack, 'wx');
    try {
      execFileSync('git', ['pack-objects', '--stdout', '--revs'], {
        cwd: github, input: `${sourceTree}\n`, stdio: ['pipe', output, 'pipe'],
      });
    } finally {
      closeSync(output);
    }
    const input = openSync(pack, 'r');
    try {
      execFileSync('git', ['unpack-objects', '-q'], {
        cwd: checkout, stdio: [input, 'ignore', 'pipe'],
      });
    } finally {
      closeSync(input);
    }
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

function requireMatchingContents(checkout, sourceTree) {
  if (git(checkout, 'write-tree') !== sourceTree ||
      git(checkout, 'diff', '--name-only', '--') ||
      git(checkout, 'ls-files', '--others', '--exclude-standard')) {
    throw new Error('The Site checkout differs from the current GitHub main. Prepare it again before publishing.');
  }
}

function run([action, target, ...extra]) {
  if (!['prepare', 'verify'].includes(action) || !target || extra.length) {
    throw new Error('Usage: node scripts/sync-world-map-sites.mjs <prepare|verify> <sites-checkout>');
  }
  if (['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR'].some(key => process.env[key])) {
    throw new Error('Run without Git directory or index overrides.');
  }
  const checkout = realpathSync(target);
  if (checkout === github || realpathSync(git(checkout, 'rev-parse', '--show-toplevel')) !== checkout) {
    throw new Error('Pass the root of a separate Sites source checkout.');
  }

  const githubMain = currentMain();
  const sourceTree = git(github, 'rev-parse', '--verify', `${githubMain}:${scene}`);
  const projectId = requireHosting(sourceTree, checkout);
  const siteTree = git(checkout, 'rev-parse', 'HEAD^{tree}');
  if (action === 'prepare') {
    if (git(checkout, 'status', '--porcelain')) {
      throw new Error('The Site checkout already has changes. Preserve them and open a fresh checkout.');
    }
    if (siteTree !== sourceTree) {
      if (!mainHistoryContains(githubMain, siteTree)) {
        throw new Error('Site HEAD is not a known GitHub main city snapshot. Reconcile the Site-only changes in GitHub before publishing.');
      }
      importTree(sourceTree, checkout);
      git(checkout, 'read-tree', '-m', '-u', 'HEAD', sourceTree);
    }
  }
  requireMatchingContents(checkout, sourceTree);
  console.log(JSON.stringify({ project_id: projectId, github_main: githubMain, source_tree: sourceTree,
    sites_checkout: checkout, source_changed: siteTree !== sourceTree }));
}

try {
  run(process.argv.slice(2));
} catch (error) {
  console.error(error.stderr?.toString().trim() || error.message);
  process.exitCode = 1;
}

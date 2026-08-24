import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { platform } from 'node:os';
import { startServer } from './serve.mjs';

function findChrome() {
  const candidates = [];
  if (platform() === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium'
    );
  } else if (platform() === 'win32') {
    for (const base of [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA]) {
      if (base) candidates.push(`${base}\\Google\\Chrome\\Application\\chrome.exe`);
    }
  } else {
    for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
      const found = spawnSync('which', [name], { encoding: 'utf8' });
      if (found.status === 0 && found.stdout.trim()) candidates.push(found.stdout.trim());
    }
  }
  return candidates.find(existsSync) || null;
}

const check = spawnSync(process.execPath, ['scripts/check.mjs'], { encoding: 'utf8', stdio: 'pipe' });
process.stdout.write(check.stdout || '');
process.stderr.write(check.stderr || '');
if (check.status !== 0) process.exit(check.status || 1);

const { server, url } = await startServer({ port: 0, quiet: true });
try {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Root HTTP ${response.status}`);
  const html = await response.text();
  const refs = [
    ...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi),
    ...html.matchAll(/<link\b[^>]*\bhref=["']([^"']+)["']/gi),
  ].map(m => m[1]).filter(x => !/^(?:https?:|data:|#)/i.test(x));

  for (const ref of refs) {
    const r = await fetch(new URL(ref, url));
    if (!r.ok) throw new Error(`${ref}: HTTP ${r.status}`);
  }
  console.log(`HTTP smoke OK — ${refs.length} entry resources loaded.`);

  const chrome = findChrome();
  if (!chrome) {
    console.log('Browser smoke skipped: Chrome/Chromium not found.');
  } else {
    const result = spawnSync(chrome, [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--virtual-time-budget=2500',
      '--dump-dom',
      url,
    ], { encoding: 'utf8', timeout: 20000, maxBuffer: 12 * 1024 * 1024 });
    if (result.status !== 0) throw new Error(`Chrome smoke failed (${result.status}):\n${result.stderr}`);
    console.log('Browser smoke OK — Chrome loaded the KEYNLOCK entry page.');
  }
} finally {
  await new Promise(resolve => server.close(resolve));
}

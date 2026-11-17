const { chromium } = require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  await page.goto('http://127.0.0.1:8000/', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const fps = await page.locator('#fps').innerText();
  await page.screenshot({ path: 'preview-lair.png' });
  await page.locator('.zone-nav button[data-zone="restoration"]').click();
  const panel = await page.locator('#panel-title').innerText();
  const panelVisible = await page.locator('#zone-panel').isVisible();
  console.log(JSON.stringify({ fps, panel, panelVisible, errors }, null, 2));
  await browser.close();
  if (errors.length || !panelVisible || fps === '—') process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });

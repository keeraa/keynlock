import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openRoom, readRoom, settleAlchemyCamera, viewport } from './harness.mjs';

test('first-person walking slides against furniture and walls, interacts, and restores orbit controls', async t => {
  const page = await openRoom(t);
  await page.evaluate(() => {
    Object.defineProperty(document.querySelector('#scene-interaction'), 'requestPointerLock', { value: undefined });
  });
  const toggle = page.locator('#room-walk-toggle');
  const overview = await page.evaluate(() => window.__keynlockDebug.host.camera.position.y);
  assert.ok(overview > 2.5, 'the walk began from the overview, above eye level');
  // The camera first comes down to the walker's eyes, then the walk starts.
  await toggle.click();
  await page.waitForFunction(() => document.querySelector('#room-walk-toggle').getAttribute('aria-pressed') === 'true');
  assert.equal(await page.locator('#room-walk-look').textContent(), 'Мышь — обзор');
  // The walk starts turned a little left; these checks walk straight ahead.
  const spawn = await page.evaluate(() => {
    window.__keynlockDebug.walk.face(0, 0);
    return window.__keynlockDebug.host.camera.position.toArray();
  });
  assert.ok(Math.abs(spawn[1] - .0385 - 1.70) < .001, 'the camera starts at eye level');
  assert.equal((await page.evaluate(readRoom)).controls.enabled, false);

  const measured = await page.evaluate(spawnZ => {
    const { walk: movement, host: { camera } } = window.__keynlockDebug;
    const key = (type, code) => document.dispatchEvent(new KeyboardEvent(type, { code }));
    function sample(sprint) {
      camera.position.z = spawnZ;
      if (sprint) key('keydown', 'ShiftLeft');
      key('keydown', 'KeyW');
      const start = camera.position.z;
      // Step the same movement controller with known deltas so GPU scheduling
      // doesn't skew the comparison between walking and sprinting.
      const frameSeconds = 1 / 60;
      for (let i = 0; i < 8; i++) movement.update(frameSeconds);
      key('keyup', 'KeyW');
      key('keyup', 'ShiftLeft');
      return (start - camera.position.z) / (8 * frameSeconds);
    }
    const walk = sample(false);
    const sprint = sample(true);
    camera.position.z = spawnZ;
    return { walk, sprint };
  }, spawn[2]);
  assert.ok(Math.abs(measured.walk - 4.4) < .5, `walking matches the Key Archive speed (${JSON.stringify(measured)})`);
  assert.ok(Math.abs(measured.sprint - 7.4) < .8, 'holding Shift matches the Key Archive sprint speed');

  await page.keyboard.down('KeyW');
  await page.waitForFunction(z => window.__keynlockDebug.host.camera.position.z < z - .45, spawn[2]);
  await page.keyboard.up('KeyW');
  await page.evaluate(y => window.__keynlockDebug.host.camera.position.set(.25, y, 4.16), spawn[1]);
  await page.keyboard.down('KeyW');
  await page.waitForFunction(() => window.__keynlockDebug.host.camera.position.z < 4.05);
  // Walk closer than the collision distance would permit without the chair.
  await page.evaluate(async () => {
    for (let i = 0; i < 12; i++) await new Promise(requestAnimationFrame);
  });
  await page.keyboard.up('KeyW');
  const position = await page.evaluate(() => window.__keynlockDebug.host.camera.position.toArray());
  assert.ok(position[2] > 3.7, 'the chair stops the player within the room');
  assert.equal(position[1], spawn[1], 'the eye height remains level');
  await page.getByText('E · Карта и дела', { exact: true }).waitFor();
  await page.keyboard.press('KeyE');
  await page.locator('#zone-panel').waitFor();
  assert.equal(await page.locator('#panel-title').textContent(), 'Карта и дела');
  assert.equal(await toggle.getAttribute('aria-pressed'), 'false');
  assert.equal((await page.evaluate(readRoom)).controls.enabled, true);

  await toggle.click();
  await page.waitForFunction(() => document.querySelector('#room-walk-toggle').getAttribute('aria-pressed') === 'true');
  await page.evaluate(() => window.__keynlockDebug.host.camera.position.x = 7.85);
  await page.keyboard.down('KeyD');
  await page.waitForFunction(() => window.__keynlockDebug.host.camera.position.x > 7.90);
  await page.evaluate(async () => {
    for (let i = 0; i < 12; i++) await new Promise(requestAnimationFrame);
  });
  await page.keyboard.up('KeyD');
  assert.ok(await page.evaluate(() => window.__keynlockDebug.host.camera.position.x < 7.95), 'the wall blocks sideways movement');

  const yaw = await page.evaluate(() => window.__keynlockDebug.host.camera.quaternion.y);
  await page.mouse.move(620, 400);
  await page.mouse.down();
  await page.mouse.move(680, 415, { steps: 4 });
  await page.mouse.up();
  assert.ok(await page.evaluate(before => Math.abs(window.__keynlockDebug.host.camera.quaternion.y - before) > .03, yaw));
  assert.equal(await page.locator('#scene-interaction').evaluate(el => getComputedStyle(el).cursor), 'none');
  assert.equal(await page.locator('#room-walk-hud .room-walk-crosshair').count(), 1);
  const settings = page.locator('#lair-visual-panel');
  await page.locator('#lair-music-toggle').focus();
  await page.keyboard.press('Escape');
  await settings.waitFor();
  await page.locator('#room-walk-hud').waitFor({ state: 'hidden' });
  assert.equal(await toggle.getAttribute('aria-pressed'), 'true');
  assert.equal((await page.evaluate(readRoom)).controls.enabled, false);
  const paused = (await page.evaluate(readRoom)).position;
  await page.keyboard.down('KeyW');
  await page.evaluate(async () => { for (let i = 0; i < 4; i++) await new Promise(requestAnimationFrame); });
  await page.keyboard.up('KeyW');
  assert.deepEqual((await page.evaluate(readRoom)).position, paused);
  await page.keyboard.press('Escape');
  await settings.waitFor({ state: 'hidden' });
  await page.locator('#room-walk-hud').waitFor();
  assert.equal(await toggle.getAttribute('aria-pressed'), 'true');
  await page.locator('#reset-camera').click();
  await page.locator('#room-walk-hud').waitFor({ state: 'hidden' });
  assert.equal((await page.evaluate(readRoom)).controls.enabled, true);
});

test('E hands off a pointer-locked walk to alchemy exactly once', async t => {
  const page = await openRoom(t, { pointerLock: true, startOnFoot: true });
  await page.bringToFront();
  const toggle = page.locator('#room-walk-toggle');
  await page.waitForFunction(() => document.querySelector('#room-walk-toggle').getAttribute('aria-pressed') === 'true');
  // Capture from the active walk before aiming at a workshop, where a click
  // would open the workshop instead of locking the mouse.
  await page.mouse.click(viewport.width / 2, viewport.height / 2);
  await page.waitForFunction(() => document.pointerLockElement === document.querySelector('#scene-interaction'));
  await page.evaluate(() => {
    const { camera, controls, renderer } = window.__keynlockDebug.host;
    const tabletop = renderer.getUnifiedScene().getObjectByName('alchemy-main-tabletop');
    const position = tabletop.getWorldPosition(camera.position.clone());
    camera.position.set(position.x - 3, camera.position.y, position.z);
    camera.lookAt(position.x, camera.position.y, position.z);

    const handoff = { releases: 0, resumes: 0, orbitChanges: [] };
    window.walkHandoff = handoff;
    document.addEventListener('pointerlockchange', () => {
      if (!document.pointerLockElement) handoff.releases++;
    });
    window.__keynlockDebug.workshop('alchemy').status.subscribe((status, previous) => {
      if (status.active && previous?.active === false) handoff.resumes++;
    });
    let enabled = controls.enabled;
    Object.defineProperty(controls, 'enabled', {
      get: () => enabled,
      set(value) {
        if (value !== enabled) handoff.orbitChanges.push(value);
        enabled = value;
      },
      configurable: true,
    });
  });
  await page.getByText('E · Алхимия', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => document.pointerLockElement?.id), 'scene-interaction');
  await page.keyboard.down('KeyE');
  await page.keyboard.down('KeyE'); // Repeated keydown while E is still held.
  await page.keyboard.up('KeyE');
  await page.waitForFunction(() => document.pointerLockElement === null && window.walkHandoff.releases > 0
    && window.__keynlockDebug.workshop('alchemy').lifecycle.isActive());
  await settleAlchemyCamera(page);

  assert.equal(await toggle.getAttribute('aria-pressed'), 'false');
  assert.equal(await page.locator('#alchemy-input-plane').isVisible(), true);
  assert.equal((await page.evaluate(readRoom)).controls.enabled, false);
  await page.evaluate(() => window.__keynlockDebug.workshop('alchemy').openRecipeBook());
  const recipe = page.locator('#alchemy-embedded-app #recipe-overlay');
  await recipe.waitFor();
  await page.keyboard.press('Escape');
  await recipe.waitFor({ state: 'hidden' });
  assert.equal(await page.locator('#alchemy-input-plane').isVisible(), true);
  assert.deepEqual(await page.evaluate(() => window.walkHandoff),
    { releases: 1, resumes: 1, orbitChanges: [] });
});

test('the Lair starts on foot and a zone opened from the walk returns to it', async t => {
  const page = await openRoom(t, { startOnFoot: true, pointerLock: true });
  const wallVisible = () => page.evaluate(() =>
    window.__keynlockDebug.host.renderer.getUnifiedScene().getObjectByName('lair-entrance-wall').visible);
  assert.equal(await page.locator('#room-walk-toggle').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('.topbar #reset-camera').isVisible(), true);
  assert.equal(await page.locator('.bottom-ui').evaluate(footer => getComputedStyle(footer).backgroundImage), 'none');
  assert.equal(await wallVisible(), true, 'the default walk sees the entrance doors from inside');
  assert.equal(await page.evaluate(() => document.pointerLockElement), null, 'loading needs no mouse capture');
  await page.mouse.click(viewport.width / 2, viewport.height / 2);
  await page.waitForFunction(() => document.pointerLockElement?.id === 'scene-interaction');
  await page.keyboard.press('Escape');
  await page.locator('#lair-visual-panel').waitFor();
  await page.waitForFunction(() => document.pointerLockElement === null);
  assert.equal(await page.locator('#room-walk-toggle').getAttribute('aria-pressed'), 'true');
  await page.locator('#lair-visual-close').click();
  await page.locator('#room-walk-hud').waitFor();
  await page.mouse.click(viewport.width / 2, viewport.height / 2);
  await page.waitForFunction(() => document.pointerLockElement?.id === 'scene-interaction');
  const before = await page.evaluate(() => {
    const camera = window.__keynlockDebug.host.camera;
    camera.position.x += 1.2;
    return camera.position.toArray();
  });
  await page.keyboard.press('5');            // the zone bar is hidden while walking
  await page.locator('#zone-panel').waitFor();
  await page.waitForFunction(() => document.pointerLockElement === null);
  // The label follows the next frame.
  await page.waitForFunction(() => document.querySelector('#reset-camera span')?.textContent.trim() === 'К ПРОГУЛКЕ');
  await page.locator('#reset-camera').click();
  await page.waitForFunction(() => document.querySelector('#room-walk-toggle').getAttribute('aria-pressed') === 'true');
  const after = await page.evaluate(() => window.__keynlockDebug.host.camera.position.toArray());
  assert.ok(after.every((value, axis) => Math.abs(value - before[axis]) < .05), 'back where the walker stood');
  // The playlist lists every track and can switch to one.
  await page.locator('#lair-music-toggle').hover();
  await page.locator('#lair-music .music-controls__title').dispatchEvent('click');
  await page.locator('#lair-music .music-controls__track-button').nth(2).dispatchEvent('click');
  assert.equal(await page.locator('#lair-music .music-controls__track[aria-current="true"]').count(), 1);
  assert.match(await page.locator('#lair-music .music-controls__track[aria-current="true"]').innerText(), /си-бемоль/);
});

test('unlocked mouse movement turns the walker and real steps match the floor surface', async t => {
  const page = await openRoom(t, { startOnFoot: true, beforeLoad: page => page.addInitScript(() => {
    const files = new WeakMap(), samples = new WeakMap();
    // Stall decode so walking starts while the wooden steps are loading.
    const woodReady = new Promise(resolve => { window.releaseWoodSteps = resolve; });
    const fetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const response = await fetch(...args);
      const surface = new URL(String(args[0]), location.href).pathname.match(/\/(wood|rug)-\d[^/]*\.wav$/)?.[1];
      if (surface) {
        const read = response.arrayBuffer.bind(response);
        response.arrayBuffer = async () => {
          const bytes = await read();
          files.set(bytes, surface);
          return bytes;
        };
      }
      return response;
    };
    const decode = BaseAudioContext.prototype.decodeAudioData;
    BaseAudioContext.prototype.decodeAudioData = function (bytes, ...args) {
      return decode.call(this, bytes, ...args).then(async buffer => {
        const surface = files.get(bytes);
        if (surface === 'wood') await woodReady;
        if (surface) samples.set(buffer, surface);
        return buffer;
      });
    };
    window.stepSurfaces = [];
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      window.stepSurfaces.push(samples.get(this.buffer) || 'synthetic');
      return start.apply(this, args);
    };
  }) });
  const yaw = () => page.evaluate(() => window.__keynlockDebug.walk.getPose().yaw);
  await page.mouse.move(400, 460);
  const original = await yaw();
  await page.mouse.move(700, 460);
  assert.ok(Math.abs(await yaw() - original) > .5);
  assert.equal(await page.evaluate(() => document.pointerLockElement), null);

  const startZ = await page.evaluate(() => {
    const { walk, host } = window.__keynlockDebug;
    walk.face(0, 0);
    return host.camera.position.z;
  });
  await page.keyboard.down('KeyW');
  await page.waitForFunction(z => window.__keynlockDebug.host.camera.position.z < z - 1.25, startZ);
  assert.deepEqual(await page.evaluate(() => window.stepSurfaces), []);
  await page.evaluate(() => window.releaseWoodSteps());
  await page.waitForFunction(() => window.stepSurfaces.includes('wood'));
  await page.keyboard.up('KeyW');

  await page.evaluate(() => {
    const { camera, renderer } = window.__keynlockDebug.host;
    const rug = renderer.getUnifiedScene().getObjectByName('planning-rug');
    camera.position.x = rug.position.x - 2.5;
    camera.position.z = rug.position.z + 1.8;
  });
  await page.keyboard.down('KeyW');
  await page.waitForFunction(() => window.stepSurfaces.includes('rug'));
  await page.keyboard.up('KeyW');
  assert.ok(await page.evaluate(() => window.stepSurfaces.every(surface => surface !== 'synthetic')));
});

test('the overview camera stays inside while rotating, zooming and panning', async t => {
  const page = await openRoom(t);
  const result = await page.evaluate(async () => {
    const { camera, controls, renderer } = window.__keynlockDebug.host;
    const scene = renderer.getUnifiedScene();
    const wall = scene.getObjectByName('lair-entrance-wall');
    const ceiling = scene.getObjectByName('lair-ceiling');
    ceiling.geometry.computeBoundingBox();
    const ceilingY = ceiling.geometry.boundingBox.clone().applyMatrix4(ceiling.matrixWorld).min.y;
    const poses = [];
    const apply = async move => {
      move();
      await new Promise(resolve => requestAnimationFrame(resolve));
      poses.push(camera.position.toArray());
    };
    await apply(() => controls.dollyOut(.3));
    for (let i = 0; i < 8; i++) await apply(() => controls.rotateLeft(Math.PI * .75));
    await apply(() => controls.rotateUp(Math.PI * 2));
    await apply(() => controls.rotateUp(-Math.PI * 2));
    await apply(() => controls.pan(-5000, 2000));
    return { poses, ceilingY, entranceZ: wall.position.z - .135, entranceVisible: wall.visible };
  });
  assert.equal(result.entranceVisible, true);
  for (const [x, y, z] of result.poses) {
    assert.ok(Math.abs(x) < 8.415 && y > .0385 && y < result.ceilingY && z > -5.485 && z < result.entranceZ,
      `outside the room at ${[x, y, z]}`);
  }
  assert.ok(Math.max(...result.poses.map(pose => pose[0])) - Math.min(...result.poses.map(pose => pose[0])) > 2,
    'the camera can still move around the room');
});

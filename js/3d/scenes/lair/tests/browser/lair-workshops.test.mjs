import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clickAlchemyObject, enterAlchemy, expectSoon, openRoom, openZone, readRoom, settleAlchemyCamera } from './harness.mjs';

test('the built Lair pours reagents into a vessel on its transformed alchemy table', async t => {
  const page = await openRoom(t);
  const favicon = await page.request.get(new URL('favicon.ico', page.url()).href);
  assert.equal(favicon.status(), 200);
  assert.match(favicon.headers()['content-type'], /^image\//);
  assert.equal((await page.locator('link[rel="icon"]').getAttribute('href')), '/favicon.ico');

  await enterAlchemy(page);
  const panelTargets = await page.evaluate(() => {
    return ['lair-visual-toggle', 'atelier-visual-trigger', 'alchemy-visual-toggle'].map(id => {
      const trigger = document.getElementById(id);
      const panelId = trigger.getAttribute('aria-controls');
      const matches = [...document.querySelectorAll(`#${panelId}`)];
      return { panelId, count: matches.length };
    });
  });
  assert.deepEqual(panelTargets, [
    { panelId: 'lair-visual-panel', count: 1 },
    { panelId: 'atelier-visual-panel', count: 1 },
    { panelId: 'alchemy-visual-panel', count: 1 },
  ]);
  await settleAlchemyCamera(page);
  await clickAlchemyObject(page, 'source', 'red');
  await clickAlchemyObject(page, 'receiver', 'left');
  await page.waitForFunction(() => {
    const { receivers } = window.__keynlockDebug.workshop('alchemy').getState();
    return receivers.find(vessel => vessel.id === 'left').volume >= 24.9;
  });
  const { receivers, sources } = await page.evaluate(() => window.__keynlockDebug.workshop('alchemy').getState());
  assert.equal(receivers.find(vessel => vessel.id === 'right').volume, 0);
  assert.ok(Math.abs(sources.find(source => source.id === 'red').volume - 75) < .1);
});

test('the burner accounts for active time when returning to the lab', async t => {
  const page = await openRoom(t);
  await enterAlchemy(page);
  await page.evaluate(() => window.__keynlockDebug.workshop('alchemy').toggleBurner());
  assert.equal(await page.evaluate(() => window.__keynlockDebug.workshop('alchemy').getState().burnerOn), true);
  await page.waitForFunction(() => window.__keynlockDebug.workshop('alchemy').getState().recipeHeatSeconds > .1);
  await page.getByRole('button', { name: 'Вернуться в логово' }).click();
  assert.equal(await page.evaluate(() => window.__keynlockDebug.workshop('alchemy').lifecycle.isActive()), false);
  const pausedHeat = await page.evaluate(() => window.__keynlockDebug.workshop('alchemy').getState().recipeHeatSeconds);

  await page.waitForTimeout(600);
  assert.equal(await page.evaluate(() => window.__keynlockDebug.workshop('alchemy').getState().recipeHeatSeconds), pausedHeat);
  // Observe the first simulation step rather than sampling an arbitrary rendered frame.
  await page.evaluate(() => {
    const api = window.__keynlockDebug.workshop('alchemy');
    const host = window.__keynlockDebug.host.renderer;
    const step = host.stepWorldRuntime;
    const unsubscribe = api.status.subscribe((status, previous) => {
      if (!status.active || previous?.active !== false) return;
      unsubscribe();
      const resumedAt = performance.now();
      const previousHeat = api.getState().recipeHeatSeconds;
      host.stepWorldRuntime = now => {
        step(now);
        const heatDelta = api.getState().recipeHeatSeconds - previousHeat;
        if (heatDelta <= 0) return;
        host.stepWorldRuntime = step;
        window.firstHeatAfterResume = { heatDelta, elapsed: (performance.now() - resumedAt) / 1000 };
      };
    });
  });
  await enterAlchemy(page);
  await page.waitForFunction(() => window.firstHeatAfterResume);
  const { heatDelta, elapsed } = await page.evaluate(() => window.firstHeatAfterResume);
  assert.ok(heatDelta <= elapsed + .04, `The first step added ${heatDelta}s after only ${elapsed}s in the lab`);
});

test('an image load failure leaves the current painting editable', async t => {
  // The third painting's image fails from the very start: a request made
  // before the test reaches it (the thumbnails, a neighbour fetched ahead)
  // would otherwise leave nothing to fail. Failures are counted.
  const failures = [];
  const page = await openRoom(t, { beforeLoad: async page => {
    page.on('requestfailed', request => { if (/vangogh-self/.test(request.url())) failures.push(request.url()); });
    await page.route(/vangogh-self[^/]*\.jpg$/, route => route.abort('failed'));
  } });
  const atelier = page.locator('#atelier-embedded-app');
  await openZone(page, 'atelier');
  await page.waitForFunction(() => window.__keynlockDebug.workshop('atelier')?.bridge?.isReady());
  const bridge = await page.evaluateHandle(() => window.__keynlockDebug.workshop('atelier')?.bridge);
  const catalogue = await bridge.evaluate(api => api.catalog());
  const previous = 1;
  const broken = 2;
  // Hold the next painting's saved layer until the competing image fails.
  await page.evaluate(() => {
    const descriptor = Object.getOwnPropertyDescriptor(IDBTransaction.prototype, 'oncomplete');
    let holdNextRead = true;
    Object.defineProperty(IDBTransaction.prototype, 'oncomplete', {
      ...descriptor,
      set(handler) {
        if (holdNextRead && this.mode === 'readonly' && this.objectStoreNames.contains('paintings')) {
          holdNextRead = false;
          descriptor.set.call(this, event => { window.releaseRestorationRead = () => handler.call(this, event); });
        } else descriptor.set.call(this, handler);
      },
    });
  });
  // The collection chooses paintings in the Lair; the bridge does the same.
  // Not awaited: the held read keeps this selection pending on purpose.
  await bridge.evaluate((api, index) => { void api.showPainting(index); }, previous);
  await page.waitForFunction(index => Boolean(window.releaseRestorationRead) &&
    window.__keynlockDebug.workshop('atelier')?.bridge.snapshot().selected === index, previous);
  assert.equal(await bridge.evaluate(api => api.isReady()), false, 'the current painting must be waiting on its editable layer');

  assert.match(catalogue[broken].image, /vangogh-self/);
  const failedBefore = failures.length;
  await bridge.evaluate((api, index) => { void api.showPainting(index); }, broken);
  await expectSoon(() => failures.length > failedBefore, 'the broken painting was requested and failed');
  await page.waitForFunction(title =>
    document.querySelector('#atelier-embedded-app #art-title').textContent === title,
  catalogue[previous].title);
  assert.equal(await bridge.evaluate(api => api.snapshot().selected), previous);
  await page.evaluate(() => window.releaseRestorationRead());
  await page.waitForFunction(() => window.__keynlockDebug.workshop('atelier')?.bridge.isReady());
  await atelier.locator('[data-tool="brush"]').click();
  assert.equal(await bridge.evaluate(api => api.snapshot().tool), 'brush');
});

test('switching workshops returns the shared camera, input, and lights to the room', async t => {
  const page = await openRoom(t);
  const home = await page.evaluate(readRoom);
  assert.ok(home.roomLights.some(light => light.visible));
  assert.equal(home.atelierLights, 0);
  assert.equal(home.alchemyLights, 0);

  async function assertHome() {
    await page.waitForFunction(({ position, target, fov }) => {
      const camera = window.__keynlockDebug.host.camera;
      const controls = window.__keynlockDebug.host.controls;
      return camera.position.toArray().every((value, axis) => Math.abs(value - position[axis]) < .025) &&
        controls.target.toArray().every((value, axis) => Math.abs(value - target[axis]) < .025) &&
        Math.abs(camera.fov - fov) < .08;
    }, home);
    await page.waitForFunction(() => !window.__keynlockDebug.host.camera.view?.enabled);
    const restored = await page.evaluate(readRoom);
    assert.deepEqual(restored.controls, home.controls);
    assert.deepEqual(restored.roomLights, home.roomLights);
    assert.equal(restored.atelierLights, 0);
    assert.equal(restored.alchemyLights, 0);
    assert.equal(await page.locator('#alchemy-input-plane').isVisible(), false);
    assert.equal(await page.evaluate(() => window.__keynlockDebug.workshop('alchemy').lifecycle.isActive()), false);
  }

  const reset = page.locator('#reset-camera');
  // The planning corner is a placeholder: a panel, but no workshop to open.
  await openZone(page, 'planning');
  await page.locator('#zone-panel').waitFor();
  assert.equal(await page.locator('#panel-link').isVisible(), false, 'no workshop link without a workshop');
  assert.equal((await page.locator('#reset-camera span').innerText()).trim(), 'ОБЩИЙ ВИД');
  await reset.click();
  await assertHome();

  await openZone(page, 'atelier');
  await page.waitForFunction(position =>
    window.__keynlockDebug.host.camera.position.toArray().some((value, axis) => Math.abs(value - position[axis]) > 3),
  home.position);
  // The original/copy stepper shows only while the panel is hidden.
  await page.waitForFunction(() => window.__keynlockDebug.workshop('atelier')?.bridge?.focusEasel);
  await page.evaluate(() => window.__keynlockDebug.workshop('atelier').bridge.focusEasel('copy'));
  await page.waitForFunction(() => window.__keynlockDebug.host.controls.minDistance < 2);
  const closeUp = await page.evaluate(readRoom);
  assert.equal(closeUp.atelierLights, 0, 'the Atelier is lit by the room: no jump in brightness');
  assert.equal(closeUp.alchemyLights, 0);
  await reset.click();
  await assertHome();

  await enterAlchemy(page);
  await settleAlchemyCamera(page);
  const lab = await page.evaluate(readRoom);
  assert.equal(lab.controls.enabled, false);
  assert.deepEqual(lab.roomLights, home.roomLights, "the room lights the lab too (one set of lights)");
  assert.ok(lab.alchemyLights > 0);
  assert.equal(lab.atelierLights, 0);
  // The lab's «Размытие фона» is the shared depth blur of the Lair's outline pass.
  const blurred = () => window.__keynlockDebug.outlines.isBackgroundBlurred();
  await page.waitForFunction(blurred);
  const labApp = page.locator('#alchemy-embedded-app');
  await labApp.locator('#background-blur').dispatchEvent('click');
  await page.waitForFunction(on => window.__keynlockDebug.outlines.isBackgroundBlurred() === on, false);
  await labApp.locator('#background-blur').dispatchEvent('click');
  await page.waitForFunction(blurred);
  // «Фон мастерской» paints the Lair's right wall.
  await labApp.locator('.wall-choice[data-wall="ochre"]').dispatchEvent('click');
  assert.equal(await page.evaluate(() => window.__keynlockDebug.host.alchemy.getWallFinish()), 'ochre');
  assert.equal(await labApp.locator('.wall-choice[data-wall="ochre"]').getAttribute('aria-pressed'), 'true');
  await labApp.locator('.wall-choice[data-wall="sage"]').dispatchEvent('click');
  await page.keyboard.press('1');
  await page.locator('#lair-atelier-corner').waitFor();
  // The colours and the reset in the top right corner; the easels centred
  // above the open panel (the camera's view is lifted by half its height).
  assert.equal(await page.locator('#lair-atelier-corner .wood-pickers').count(), 1);
  assert.equal(await page.locator('#lair-atelier-corner #reset-button').count(), 1);
  await page.waitForFunction(() => window.__keynlockDebug.host.camera.view?.enabled &&
    window.__keynlockDebug.host.camera.view.offsetY > 50);
  const atelier = await page.evaluate(readRoom);
  assert.equal(atelier.controls.enabled, true);
  assert.deepEqual(atelier.roomLights, home.roomLights);
  assert.equal(atelier.atelierLights, 0);
  assert.equal(atelier.alchemyLights, 0);
  assert.equal(await page.locator('#alchemy-input-plane').isVisible(), false);

  await page.locator('#wall-collection-entry').click();
  await page.locator('#lair-gallery-controls').waitFor();
  assert.equal((await page.evaluate(readRoom)).controls.enabled, false);
  await reset.click();
  await assertHome();

  await enterAlchemy(page);
  await page.getByRole('button', { name: 'Вернуться в логово' }).click();
  await assertHome();

  const orbitPoint = await page.evaluate(() => {
    for (const y of [300, 380, 720]) {
      for (const x of [250, 500, 700]) {
        if (document.elementFromPoint(x, y)?.id === 'scene-interaction') return { x, y };
      }
    }
    return null;
  });
  assert.ok(orbitPoint, 'the room must receive pointer input after switching');
  await page.mouse.move(orbitPoint.x, orbitPoint.y);
  await page.mouse.down();
  await page.mouse.move(orbitPoint.x + 100, orbitPoint.y + 30, { steps: 8 });
  await page.mouse.up();
  await page.waitForFunction(position =>
    window.__keynlockDebug.host.camera.position.toArray().some((value, axis) => Math.abs(value - position[axis]) > .1),
  home.position);
});

test('the room hosts both workshops on one canvas through the host contract', async t => {
  const page = await openRoom(t);
  const debug = 'window.__keynlockDebug';
  await page.waitForFunction(() => window.__keynlockDebug.workshop('atelier')?.bridge?.isReady()
    && window.__keynlockDebug.workshop('atelier')?.status.get().galleryReady
    && window.__keynlockDebug.workshop('alchemy')?.status.get().ready);
  // One visible WebGL canvas: the workshops draw through the room's renderer.
  const visibleCanvases = await page.evaluate(() => [...document.querySelectorAll('canvas')].filter(canvas => {
    const box = canvas.getBoundingClientRect();
    const style = getComputedStyle(canvas);
    return box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && Number(style.opacity) > 0;
  }).length);
  assert.equal(visibleCanvases, 1, `${debug}: only the room canvas is visible`);
  // The Atelier's own angled sun would throw long stripes across the shared room.
  const atelierShadowLights = await page.evaluate(() => {
    let count = 0;
    window.__keynlockDebug.host.renderer.getUnifiedScene().getObjectByName('keynlock-world-atelier')
      .traverse(object => { if (object.isDirectionalLight && object.castShadow) count++; });
    return count;
  });
  assert.equal(atelierShadowLights, 0);
  // The room's right wall is tiled from floor to ceiling; the lab's own shorter
  // wall and its tile colour buttons (which only paint that wall) are hidden.
  assert.equal(await page.evaluate(() => window.__keynlockDebug.host.renderer.getUnifiedScene()
    .getObjectByName('extended-back-wall').visible), false);
  assert.equal(await page.locator('#alchemy-embedded-app .wall-choices').isHidden(), true);
  const supports = await page.evaluate(() => {
    const scene = window.__keynlockDebug.host.renderer.getUnifiedScene();
    scene.updateMatrixWorld(true);
    const point = scene.position.clone();
    function range(object, axis) {
      let min = Infinity, max = -Infinity;
      object.traverseVisible(mesh => {
        const positions = mesh.geometry?.getAttribute('position');
        if (!mesh.isMesh || !positions) return;
        for (let i = 0; i < positions.count; i++) {
          const coordinate = point.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld)[axis];
          min = Math.min(min, coordinate);
          max = Math.max(max, coordinate);
        }
      });
      return { min, max };
    }
    const galleryWall = scene.getObjectByName('atelier-side-wall');
    const leftWall = galleryWall.position.x;
    const gallerySpan = range(galleryWall, 'z');
    const rightWall = scene.getObjectByName('alchemy-right-wall').position.x;
    const shelf = range(scene.getObjectByName('alchemy-wall-shelf'), 'y');
    const brackets = scene.getObjectsByProperty('name', 'alchemy-shelf-bracket');
    const paintings = scene.getObjectByName('restored-frames').children;
    const alchemyFeet = scene.getObjectsByProperty('name', 'table-foot');
    const alchemyTable = scene.getObjectByName('alchemy-main-tabletop');
    const alchemyTop = range(alchemyTable, 'y').max;
    const alchemySpan = range(alchemyTable, 'z');
    const shift = 1.5 * (alchemySpan.max - alchemySpan.min);
    const center = name => scene.getObjectByName(name).getWorldPosition(point).z;
    const easelNames = ['restoration-left-easel', 'restoration-right-easel'];
    const easels = easelNames.map(name => scene.getObjectByName(name));
    const easelCenter = (center(easelNames[0]) + center(easelNames[1])) / 2;
    const insideGalleryWall = object => {
      const span = range(object, 'z');
      return span.min > gallerySpan.min && span.max < gallerySpan.max;
    };
    const galleryCeiling = range(scene.getObjectByName('lair-wall-beam-left'), 'y').min;
    const gallerySconces = scene.getObjectsByProperty('name', 'lair-wall-sconce')
      .filter(sconce => sconce.position.x < 0);
    const sconceTop = Math.max(...gallerySconces.map(sconce => {
      const glass = sconce.children.find(part => part.material?.isMeshStandardMaterial && part.material.transparent);
      return range(glass, 'y').max;
    }));
    const galleryObjects = [...paintings, scene.getObjectByName('art-history-column-headings')];
    const workbench = scene.getObjectByName('workbench-right-of-alchemy');
    const workbenchSpan = range(workbench, 'z');
    const entranceZ = center('lair-entrance-wall') - .135;
    return {
      galleryFitsBelowBeam: galleryObjects.every(object => {
        const span = range(object, 'y');
        return span.min > sconceTop && span.max < galleryCeiling;
      }),
      shelfBrackets: brackets.length === 2
        && brackets.every(bracket => range(bracket, 'x').max >= rightWall && range(bracket, 'y').max >= shelf.min),
      galleryColumns: new Set(paintings.map(painting => painting.position.x)).size,
      galleryMounted: paintings.length === 30
        && paintings.every(painting => range(painting, 'x').min <= leftWall + .001 && insideGalleryWall(painting))
        && insideGalleryWall(scene.getObjectByName('art-history-column-headings')),
      atelierTableRemoved: ['restoration-worktable', 'restoration-brush-pad', 'restoration-palette']
        .every(name => !scene.getObjectByName(name)),
      smallerEaselsOnFloor: easels.every(easel => easel.scale.x === .8 && Math.abs(range(easel, 'y').min - .0385) < .005),
      alchemyTableOnFloor: alchemyFeet.length === 4
        && alchemyFeet.every(foot => Math.abs(range(foot, 'y').min - .0385) < .005),
      alchemyTableLowered: Math.abs(alchemyTop - .0385 - .95) < .005,
      workshopSpacing: Math.abs(easelCenter - (10.35 - shift)) < .01
        && Math.abs(center('alchemy-main-tabletop') - (11.20 - shift)) < .01
        && Math.abs(center(workbench.name) - center('alchemy-main-tabletop') - 4.90) < .01
        && workbenchSpan.min - alchemySpan.max > 1 && entranceZ - workbenchSpan.max > 1,
      roomShortened: Math.abs(entranceZ - 12.90) < .01
        && Math.abs(range(scene.getObjectByName('lair-floor-base'), 'z').max - entranceZ) < .01,
    };
  });
  assert.deepEqual(supports, {
    galleryFitsBelowBeam: true, shelfBrackets: true, galleryColumns: 8, galleryMounted: true, atelierTableRemoved: true, smallerEaselsOnFloor: true,
    alchemyTableOnFloor: true, alchemyTableLowered: true, workshopSpacing: true, roomShortened: true,
  });

  // The FPS button opens the performance panel; the triangle row shows where they are.
  await page.locator('#perf-toggle').click();
  await page.waitForFunction(() => /\d/.test(document.querySelector('#perf-calls').textContent));
  await page.locator('#perf-triangles-row').hover();
  assert.ok(await page.locator('#perf-breakdown-list li').count() >= 3, 'the largest triangle owners are listed');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#perf-panel').isHidden(), true);

  // The Atelier's own tools work inside the room.
  await openZone(page, 'atelier');
  // The original/copy stepper shows only while the panel is hidden.
  await page.waitForFunction(() => window.__keynlockDebug.workshop('atelier')?.bridge?.focusEasel);
  await page.evaluate(() => window.__keynlockDebug.workshop('atelier').bridge.focusEasel('copy'));
  await page.waitForFunction(() => window.__keynlockDebug.host.controls.minDistance < 2);
  // The window's haze would wash out the paintings being restored.
  // Set by the frame loop: wait for a frame (slow software WebGL on CI).
  await page.waitForFunction(() => window.__keynlockDebug.host.renderer.getUnifiedScene()
    .getObjectByName('window-light-air').visible === false);
  for (const tool of ['brush', 'swab', 'uv', 'reagent', 'retouch']) {
    const button = page.locator(`#atelier-embedded-app [data-tool="${tool}"]`);
    await button.click();
    assert.equal(await button.getAttribute('aria-pressed'), 'true', `${tool} is selected`);
  }
  // The reagent on a spot the UV lamp has not marked: the reason shows
  // beside the cursor (the panel's status line is hidden in the Lair).
  await page.locator('#atelier-embedded-app [data-tool="reagent"]').click();
  // Choosing a tool flies to the copy: wait until the camera stands still.
  await page.evaluate(async () => {
    const camera = window.__keynlockDebug.host.camera;
    let still = 0;
    const last = camera.position.clone();
    while (still < 8) {
      await new Promise(requestAnimationFrame);
      still = camera.position.distanceTo(last) < 1e-5 ? still + 1 : 0;
      last.copy(camera.position);
    }
  });
  const spot = await page.evaluate(() => {
    const { camera, renderer } = window.__keynlockDebug.host;
    const easel = renderer.getUnifiedScene().getObjectByName('restoration-right-easel');
    let canvas;
    easel.traverse(object => { if (object.material?.uniforms?.uPainting) canvas = object; });
    const point = canvas.getWorldPosition(camera.position.clone()).project(camera);
    const bounds = document.querySelector('#scene-interaction').getBoundingClientRect();
    return {
      x: bounds.left + (point.x + 1) * bounds.width / 2,
      y: bounds.top + (1 - point.y) * bounds.height / 2,
    };
  });
  await page.mouse.move(spot.x, spot.y);
  await page.locator('#atelier-scene-feedback #restoration-cursor[data-tool="reagent"]').waitFor();
  await page.mouse.click(spot.x, spot.y);
  await page.locator('#atelier-scene-feedback #restoration-notice').filter({ hasText: 'УФ-фонарём' }).waitFor();
  // The panel in the Lair: «ВСЯ КОЛЛЕКЦИЯ» right of «В ЛОГОВО», the readiness
  // beside the likeness, no stepper while the panel is open.
  const back = await page.locator('#reset-camera').boundingBox();
  const collection = await page.locator('#lair-atelier-header #collection-footer').boundingBox();
  assert.ok(back && collection && collection.x > back.x + back.width && Math.abs(collection.y - back.y) < 2,
    'the collection button stands right of «В ЛОГОВО»');
  assert.match(await page.locator('#lair-atelier-header .collection-total').innerText(), /^\d+$/, 'the collection size is filled in');
  assert.equal(await page.locator('#atelier-embedded-app .workbench-main #restoration-progress').count(), 1);
  assert.equal(await page.locator('#lair-easel-camera-controls').isHidden(), true);
  await page.locator('#atelier-embedded-app #workbench-toggle').click();
  await page.locator('#lair-easel-camera-controls').waitFor();
  await page.locator('#atelier-embedded-app #workbench-toggle').click();

  // The painting wall opens from the room and returns to the easels.
  await page.locator('#reset-camera').click();
  await openZone(page, 'atelier');
  await page.locator('#wall-collection-entry').click();
  await page.waitForFunction(() => window.__keynlockDebug.host.atelier.galleryActive === true);
  assert.equal(await page.locator('#lair-gallery-controls').isVisible(), true);
  const gallery = await page.evaluateHandle(() => window.__keynlockDebug.workshop('atelier').gallery);
  assert.equal(await gallery.evaluate(api => api.getState().canShuffle), true);
  assert.match(await page.locator('#wall-gallery-caption').textContent(), /8 вертикальных колонок/);
  await page.locator('#gallery-switch').click();
  await page.locator('#gallery-switch').and(page.getByText('ДЕМО · 30', { exact: true })).waitFor();
  assert.equal(await gallery.evaluate(api => api.getState().canShuffle), false);
  assert.equal(await page.locator('#gallery-shuffle').isHidden(), true);
  await page.locator('#gallery-select').click();
  await page.locator('#atelier-embedded-app #collection-modal').waitFor();
  assert.equal(await gallery.evaluate(api => api.getState().collectionOpen), true);
  await page.keyboard.press('Escape');
  await page.locator('#atelier-embedded-app #collection-modal').waitFor({ state: 'hidden' });
  assert.equal(await gallery.evaluate(api => api.getState().collectionOpen), false);
  assert.equal(await gallery.evaluate(api => api.getState().active), true);
  await page.locator('#gallery-easels').click();
  await page.waitForFunction(() => window.__keynlockDebug.host.atelier.galleryActive === false);
  assert.equal(await page.locator('#lair-gallery-controls').isVisible(), false);
});

for (const [id, healthy, chunk, message] of [
  ['atelier', 'alchemy', /\/assets\/main-[\w-]+\.js$/, 'Реставрация не запустилась'],
  ['alchemy', 'atelier', /\/assets\/alchemy-[\w-]+\.js$/, 'Ошибка лаборатории'],
]) {
  test(`a failed ${id} import reports an error without blocking ${healthy}`, async t => {
    const page = await openRoom(t, { beforeLoad: page => page.route(chunk, route => route.abort()) });
    await page.waitForFunction(({ id, healthy }) => {
      const workshop = window.__keynlockDebug.workshop;
      return workshop(id)?.status.get().error && workshop(healthy)?.status.get().ready;
    }, { id, healthy });
    const failed = await page.evaluate(id => window.__keynlockDebug.workshop(id).status.get(), id);
    assert.equal(failed.ready, false);
    assert.ok(failed.error);

    await openZone(page, id);
    await page.locator(`#${id}-embedded-app`).getByRole('alert').filter({ hasText: message }).waitFor();
    await page.locator('#reset-camera').click();
    assert.equal(await page.locator(`#${id}-embedded-app`).isHidden(), true);

    if (healthy === 'alchemy') await enterAlchemy(page);
    else {
      await openZone(page, 'atelier');
      await page.locator('#lair-atelier-corner').waitFor();
    }
  });
}

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { enterAlchemy, openRoom, openZone, viewport } from './harness.mjs';

test('an English browser gets the Lair in English, with a language switch', async t => {
  const page = await openRoom(t, { locale: 'en-US' });
  assert.equal(await page.title(), "KEYNLOCK · The team's lair");
  assert.equal(await page.evaluate(() => document.documentElement.lang), 'en');
  assert.equal(await page.locator('.hotspot[data-zone="workbench"] span:last-child').innerText(), 'Workbench');
  assert.equal(await page.locator('#lair-language').inputValue(), 'en');
  assert.deepEqual(await page.locator('#lair-language option').evaluateAll(options => options.map(o => o.value)), ['ru', 'en']);
});

test('one music player follows the Lair into its workshops and switches tracks', async t => {
  const page = await openRoom(t);
  const note = page.getByRole('button', { name: 'Музыка', exact: true });
  const title = page.locator('#lair-music .music-controls__title');
  const titleText = async () => (await title.textContent()).replace(/\s*▾$/, '');
  const bounds = await note.boundingBox();
  assert.equal(bounds.width, 57);
  assert.equal(bounds.height, 57);
  assert.ok(bounds.x < 50 && viewport.height - (bounds.y + bounds.height) <= 25);
  assert.equal(await note.getAttribute('aria-expanded'), 'false');
  assert.equal(await title.isVisible(), false);
  await note.hover();
  await title.waitFor();
  assert.equal(await titleText(), 'Шопен · Ноктюрн op. 9 № 1');
  await page.locator('#lair-music').getByRole('button', { name: 'Следующий трек' }).click();
  assert.equal(await titleText(), 'Шопен · Ноктюрн op. 9 № 2');
  assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem('keynlock-archive-music-position-v1'))).track,
    'chopin-nocturne-op9-no2.mp3', 'the Key Archive resumes the same record');
  await page.locator('#lair-music').getByRole('button', { name: 'Пауза' }).click();
  assert.equal(await page.evaluate(() => localStorage.getItem('keynlock-music-stopped-v1')), '1');
  await page.mouse.move(viewport.width - 50, 115);
  await title.waitFor({ state: 'hidden' });
  assert.equal(await note.getAttribute('aria-expanded'), 'false');

  // The gramophone's panel shows the same player, with volume.
  await openZone(page, 'gramophone');
  await page.locator('#panel-music').waitFor();
  assert.equal(await page.locator('#panel-music .music-controls__title').innerText(), 'Шопен · Ноктюрн op. 9 № 2');
  assert.equal(await page.locator('#panel-music .music-controls__volume').inputValue(), '25');
  await page.locator('#panel-music').getByRole('button', { name: 'Предыдущий трек' }).click();
  assert.equal(await titleText(), 'Шопен · Ноктюрн op. 9 № 1');

  // The lab is the same page: the player and its state stay.
  await enterAlchemy(page);
  await note.hover();
  await title.waitFor();
  assert.equal(await titleText(), 'Шопен · Ноктюрн op. 9 № 1');
});

test('an English page shows the player in English', async t => {
  const page = await openRoom(t, { locale: 'en-US' });
  await page.getByRole('button', { name: 'Music', exact: true }).press('Enter');
  const title = page.locator('#lair-music .music-controls__title');
  await title.waitFor();
  assert.equal((await title.textContent()).replace(/\s*▾$/, ''), 'Chopin · Nocturne Op. 9 No. 1');
  assert.equal(await page.locator('#lair-music').getByRole('button', { name: 'Next track' }).count(), 1);
});

test('the room draws once per frame: no transmission pass and no per-frame shadow map', async t => {
  const page = await openRoom(t);
  const state = await page.evaluate(() => {
    const scene = window.__keynlockDebug.host.renderer.getUnifiedScene();
    const transmissive = [];
    scene.traverse(object => {
      const materials = [object.material].flat().filter(Boolean);
      if (object.isMesh && materials.some(material => material.transmission > 0)) transmissive.push(object.name || object.parent?.name);
    });
    return { transmissive };
  });
  // Any transmission material makes Three.js draw every opaque object again each frame.
  assert.deepEqual(state.transmissive, []);
  // The scene is drawn into the ink outline's buffer (the opaque part once
  // more for its normals) and the shadow map about once a second. Counted per
  // second, not per frame: software WebGL on CI draws only a few frames a
  // second, so one shadow refresh is spread over very few frames.
  const passes = await page.evaluate(async () => {
    const gl = document.querySelector('#scene').getContext('webgl2');
    let target = null;
    const draws = new Map();
    const bind = gl.bindFramebuffer, draw = gl.drawElements, drawArrays = gl.drawArrays;
    const count = () => draws.set(target, (draws.get(target) ?? 0) + 1);
    gl.bindFramebuffer = function (kind, framebuffer) { target = framebuffer; return bind.call(this, kind, framebuffer); };
    gl.drawElements = function (...args) { count(); return draw.apply(this, args); };
    gl.drawArrays = function (...args) { count(); return drawArrays.apply(this, args); };
    const started = performance.now();
    let frames = 0;
    while (performance.now() - started < 3000 || frames < 3) {
      await new Promise(resolve => requestAnimationFrame(resolve));
      frames++;
    }
    const seconds = (performance.now() - started) / 1000;
    Object.assign(gl, { bindFramebuffer: bind, drawElements: draw, drawArrays });
    const totals = [...draws.values()].sort((a, b) => b - a);
    const scenePass = totals[0] / frames;
    // A pass drawing a good part of the scene each frame is a scene pass:
    // colour, and normals (opaque objects only, about half). The rest is per second.
    const scenePasses = totals.filter(total => total / frames >= scenePass * .3);
    const others = totals.filter(total => total / frames < scenePass * .3).reduce((sum, total) => sum + total, 0);
    return { othersPerSecond: Math.round(others / seconds), scenePasses: scenePasses.length };
  });
  assert.ok(passes.scenePasses <= 2, `scene-sized passes per frame: ${passes.scenePasses}`);
  // One shadow refresh (~320 draws) a second, plus the screen quad.
  assert.ok(passes.othersPerSecond < 450, `other draws per second: ${passes.othersPerSecond}`);
});

test('the workshops share the room look: one gouache setting, no Atelier-only effects', async t => {
  const page = await openRoom(t);
  assert.equal(await page.locator('.atelier-effects, #atelier-toon-enabled').count(), 0, 'no separate Atelier effects');
  await page.waitForFunction(() => {
    const api = window.__keynlockDebug.workshop;
    return api('atelier')?.look?.paintedMaterials && api('alchemy')?.look?.paintedMaterials;
  });
  // Wait for the Lair to adopt them (on the workshops' ready events).
  const painted = await page.waitForFunction(() => {
    const api = window.__keynlockDebug.workshop;
    const adopted = list => list.every(material => material.customProgramCacheKey().includes('keynlock-painted'));
    return adopted(api('atelier').look.paintedMaterials()) && adopted(api('alchemy').look.paintedMaterials());
  }, null, { timeout: 30000 });
  assert.ok(await painted.jsonValue());
});

test('both sofas stand close to the corner walls and face the planning table', async t => {
  const page = await openRoom(t, { startOnFoot: true });
  const geometry = await page.waitForFunction(() => {
    const { camera, renderer } = window.__keynlockDebug.host;
    const scene = renderer.getUnifiedScene();
    const sofas = ['planning-sofa', 'planning-sofa-left'].map(name => scene.getObjectByName(name));
    if (sofas.some(sofa => !sofa)) return null;
    scene.updateMatrixWorld(true);
    const table = scene.getObjectByName('planning-main-table');
    return sofas.map(sofa => {
      // Measure the actual vertices. An axis-aligned box around the rotated
      // sofa's local box overestimates clearance needed at the corner.
      const meshes = sofa.getObjectsByProperty('isMesh', true);
      const points = meshes[0].geometry;
      points.computeBoundingBox();
      const bounds = points.boundingBox.clone().setFromObject(sofa, true);
      const toTable = table.position.clone().sub(sofa.position).setY(0).normalize();
      const sofaFront = camera.position.clone().set(0, 0, 1).transformDirection(sofa.matrixWorld);
      return { x: sofa.position.x, z: sofa.position.z, floor: bounds.min.y, scale: sofa.scale.x,
        outerSide: Math.max(bounds.max.x, -bounds.min.x), rearEdge: bounds.min.z,
        facing: sofaFront.dot(toTable), shadow: meshes.every(mesh => mesh.castShadow && mesh.receiveShadow) };
    });
  });
  const [right, left] = await geometry.jsonValue();
  assert.ok(right.x > 6.8 && right.z < -3.79);
  assert.ok(left.x < -6.48 && left.z < -3.72);
  assert.equal(right.scale, 1.23 * 1.6);
  for (const sofa of [right, left]) {
    assert.ok(sofa.outerSide < 8.24 && sofa.rearEdge > -5.33 && sofa.rearEdge < -5.20);
    assert.ok(Math.abs(sofa.floor - .0385) < .001);
    assert.ok(sofa.facing > .99);
    assert.equal(sofa.shadow, true);
  }
});

test('the added planning furniture loads and the chairs share render resources', async t => {
  const page = await openRoom(t, { startOnFoot: true });
  const placement = await page.waitForFunction(() => {
    const scene = window.__keynlockDebug.host.renderer.getUnifiedScene();
    const names = ['planning-sofa-left', 'planning-chair', 'planning-chair-right',
      'planning-armchair', 'planning-bookcase'];
    const models = names.map(name => scene.getObjectByName(name));
    const tables = ['planning-side-table', 'planning-side-table-between-seats',
      'planning-side-table-left-corner', 'planning-side-table-right-corner'].map(name => scene.getObjectByName(name));
    const vases = ['planning-vase-antique', 'planning-vase-ceramic'].map(name => scene.getObjectByName(name));
    if ([...models, ...tables, ...vases].some(model => !model)) return null;
    scene.updateMatrixWorld(true);
    const [left, chair, rightChair, armchair, bookcase] = models;
    const sofa = scene.getObjectByName('planning-sofa');
    const [front, between, leftCorner, rightCorner] = tables;
    const mesh = model => model.getObjectsByProperty('isMesh', true)[0];
    const worldBounds = model => {
      const first = mesh(model).geometry;
      first.computeBoundingBox();
      const result = first.boundingBox.clone().makeEmpty();
      model.traverse(part => {
        if (!part.isMesh) return;
        part.geometry.computeBoundingBox();
        result.union(part.geometry.boundingBox.clone().applyMatrix4(part.matrixWorld));
      });
      return result;
    };
    const width = model => {
      const bounds = mesh(model).geometry;
      bounds.computeBoundingBox();
      return (bounds.boundingBox.max.x - bounds.boundingBox.min.x) * model.scale.x;
    };
    const leftFacing = left.position.clone().set(0, 0, 1).transformDirection(left.matrixWorld);
    const armchairFacing = leftFacing.clone().set(0, 0, 1).transformDirection(armchair.matrixWorld);
    const toCoffeeTable = between.position.clone().sub(armchair.position).setY(0).normalize();
    const toMainTable = scene.getObjectByName('planning-main-table').position.clone()
      .sub(armchair.position).setY(0).normalize();
    const cabinet = worldBounds(bookcase);
    const alchemyTable = worldBounds(scene.getObjectByName('alchemy-main-tabletop'));
    const alchemyShelf = worldBounds(scene.getObjectByName('alchemy-wall-shelf'));
    const rightTrim = worldBounds(scene.getObjectByName('lair-wainscot-right-cap'));
    const vasesOnTables = vases.every((vase, i) => {
      const top = worldBounds([leftCorner, rightCorner][i]);
      const base = worldBounds(vase);
      return vase.scale.x === 1.5 && Math.abs(base.min.y - top.max.y) < .001 &&
        base.min.x > top.min.x && base.max.x < top.max.x &&
        base.min.z > top.min.z && base.max.z < top.max.z && mesh(vase).receiveShadow;
    });
    return { leftX: left.position.x, leftZ: left.position.z, widthRatio: width(left) / width(sofa),
      rightChair: rightChair.position.x > 1,
      chairScales: [chair.scale.x, rightChair.scale.x],
      armchairTurn: Math.atan2(
        toCoffeeTable.clone().cross(armchairFacing).y, toCoffeeTable.dot(armchairFacing)),
      facesMainTable: armchairFacing.dot(toMainTable) > toCoffeeTable.dot(toMainTable),
      bookcaseFits: cabinet.min.z > worldBounds(armchair).max.z &&
        cabinet.max.z < Math.min(alchemyTable.min.z, alchemyShelf.min.z) && cabinet.max.x < rightTrim.min.x &&
        Math.abs(cabinet.min.y - .0385) < .001,
      vasesOnTables,
      nightstandRemoved: !scene.getObjectByName('planning-nightstand'),
      sharedChair: mesh(chair).geometry === mesh(rightChair).geometry && mesh(chair).material === mesh(rightChair).material,
      armchairBesideSofa: armchair.scale.x === 1.4 && armchair.position.x > sofa.position.x &&
        between.position.z > sofa.position.z && between.position.z < armchair.position.z,
      roundTables: tables.every(table => {
        const box = worldBounds(table);
        const height = table === leftCorner || table === rightCorner ? 1.30 : .65;
        return Math.abs(box.max.x - box.min.x - .70) < .01 &&
          Math.abs(box.max.y - box.min.y - height) < .001 &&
          mesh(table).geometry === mesh(front).geometry;
      }) &&
        front.position.clone().sub(left.position).dot(leftFacing) > 1 &&
        leftCorner.position.z < left.position.z && rightCorner.position.z < sofa.position.z,
      allCastShadows: [...models, ...tables].every(model => mesh(model).castShadow) };
  });
  const result = await placement.jsonValue();
  assert.ok(result.leftX < -6 && result.leftZ < -3.4);
  assert.ok(Math.abs(result.widthRatio - 1.1) < .01);
  assert.ok(result.rightChair && result.sharedChair && result.allCastShadows);
  assert.ok(result.armchairBesideSofa && result.roundTables);
  assert.deepEqual(result.chairScales, [1.04 * 1.2, 1.04 * 1.2]);
  assert.ok(Math.abs(result.armchairTurn - Math.PI / 9) < .01 && result.facesMainTable);
  assert.ok(result.bookcaseFits, 'The bookcase stands between the armchair and the alchemy counter');
  assert.ok(result.vasesOnTables && result.nightstandRemoved);
});

test('the stacked books rest on the shifted planning shelf', async t => {
  const page = await openRoom(t);
  const placement = await page.waitForFunction(() => {
    const scene = window.__keynlockDebug.host.renderer.getUnifiedScene();
    const books = scene.getObjectByName('planning-shelf-books');
    if (!books) return null;
    const shelf = scene.getObjectByName('planning-wall-shelf');
    shelf.geometry.computeBoundingBox();
    const support = shelf.geometry.boundingBox.clone().applyMatrix4(shelf.matrixWorld);
    const stack = support.clone().makeEmpty();
    books.traverse(mesh => {
      if (!mesh.isMesh) return;
      mesh.geometry.computeBoundingBox();
      stack.union(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld));
    });
    return { restsOnShelf: Math.abs(stack.min.y - support.max.y) < .001,
      fitsShelf: stack.min.x >= support.min.x && stack.max.x <= support.max.x &&
        stack.min.z >= support.min.z && stack.max.z <= support.max.z,
      boxBooks: scene.getObjectByName('planning-shelf-book') != null };
  });
  assert.deepEqual(await placement.jsonValue(), { restsOnShelf: true, fitsShelf: true, boxBooks: false });
});

test('both SIKISI bird models load and the flock flies outside at different heights', async t => {
  const page = await openRoom(t, { startOnFoot: true });
  const snapshot = () => page.evaluate(() => {
    const scene = window.__keynlockDebug.host.renderer.getUnifiedScene();
    const flock = scene.getObjectByName('bird-flock');
    return flock?.children.filter(actor => actor.userData.flight).map(actor => {
      let skinned = false;
      actor.traverse(object => { skinned ||= Boolean(object.isSkinnedMesh); });
      return { position: actor.position.toArray(), skinned };
    });
  });
  await page.waitForFunction(() => {
    const flock = window.__keynlockDebug.host.renderer.getUnifiedScene().getObjectByName('bird-flock');
    const heights = flock?.children.filter(actor => actor.userData.flight).map(actor => actor.position.y);
    return heights?.length === 3 && Math.max(...heights) - Math.min(...heights) > .5;
  });
  const before = await snapshot();
  assert.ok(before.every(actor => actor.skinned && actor.position[2] < -5.755));
  await page.waitForFunction(([x, , z]) => {
    const [first] = window.__keynlockDebug.host.renderer.getUnifiedScene().getObjectByName('bird-flock').children;
    return Math.hypot(first.position.x - x, first.position.z - z) > .75;
  }, before[0].position);
});

test('the settings choose a quality level and a 60 FPS cap, and remember them', async t => {
  const page = await openRoom(t);
  await page.locator('#lair-visual-toggle').click();
  await page.locator('#quality-mode').waitFor();
  assert.deepEqual(await page.locator('#lair-visual-panel .visual-section > h3').allTextContents(), [
    'Качество и скорость', 'Язык', 'Рисовка и воздух', 'Гуашевые текстуры',
    'Металлические поверхности', 'Отделка правой стены',
  ]);
  assert.equal(await page.locator('#quality-mode').inputValue(), 'auto');
  const bufferWidth = () => page.evaluate(() => document.querySelector('#scene').width);
  await page.locator('#quality-mode').selectOption('minimal');
  await page.waitForFunction(() => /Минимальное/.test(document.querySelector('#quality-now').textContent));
  const minimal = await bufferWidth();
  await page.locator('#quality-mode').selectOption('high');
  await page.waitForFunction(() => /Высокое/.test(document.querySelector('#quality-now').textContent));
  assert.ok(await bufferWidth() > minimal, 'a higher level draws more pixels');
  await page.locator('#fps-cap').check();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('keynlock-lair-visual-v1')));
  assert.equal(saved['quality-mode'], 'high');
  assert.equal(saved['fps-cap'], true);
});

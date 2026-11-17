import * as THREE from 'three';
import { makeAlchemyTileTexture } from './wall-tiles.js';
import { atelierWallpaperSource } from '../integrations/atelier/src/painted-assets.js';

export function createMaterials() {
  const textureLoader = new THREE.TextureLoader();
  const load = (name, rx = 1, ry = 1) => {
    const texture = textureLoader.load(name.startsWith('data:') || name.startsWith('/') ? name : `/assets/${name}`);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(rx, ry);
    texture.anisotropy = 4;
    return texture;
  };
  const mat = (color, roughness = .9, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  // These are the painted wood finishes already used in the alchemy scene.
  // Their broad brushwork is deliberately quieter than the earlier swirled grain.
  const walnutMap = load('wood-gouache-walnut.webp');
  const ashMap = load('wood-gouache-ash.webp');
  const oakMap = load('wood-gouache-oak.webp');
  const plasterMap = load('atelier-wallpaper-gouache.webp', 1.3, 2.15);
  const restorationPlasterMap = load(atelierWallpaperSource, 1, 1);
  const floorMap = walnutMap.clone();
  floorMap.repeat.set(5.2, .68);
  floorMap.needsUpdate = true;
  const floorAlternateMap = floorMap.clone();
  floorAlternateMap.offset.set(.17, .14);
  floorAlternateMap.needsUpdate = true;
  const botanicalMap = makeWallpaperTexture('botanical');
  const damaskMap = makeWallpaperTexture('damask');
  for (const texture of [botanicalMap, damaskMap]) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(12.4, 5.4);
    texture.anisotropy = 4;
  }
  const materials = {
    walnut: new THREE.MeshStandardMaterial({ map: walnutMap, color: '#ffffff', roughness: .96 }),
    agedWood: new THREE.MeshStandardMaterial({ map: walnutMap, color: '#d0b8a5', roughness: .96 }),
    darkWood: new THREE.MeshStandardMaterial({ map: walnutMap, color: '#917c6e', roughness: .98 }),
    ash: new THREE.MeshStandardMaterial({ map: ashMap, color: '#ffffff', roughness: .95 }),
    oak: new THREE.MeshStandardMaterial({ map: oakMap, color: '#ffffff', roughness: .96 }),
    plaster: new THREE.MeshStandardMaterial({ map: plasterMap, color: '#e0d8d0', roughness: 1 }),
    restorationWall: new THREE.MeshStandardMaterial({ map: restorationPlasterMap, color: '#ffffff', roughness: 1, side: THREE.DoubleSide }),
    // Preserve the tile's physical size after mirroring the 30m gallery wing.
    alchemyTile: new THREE.MeshStandardMaterial({ map: makeAlchemyTileTexture(THREE, { width: 105, height: 29, textureWidth: 2048, textureHeight: 1024 }), roughness: 1, metalness: 0, side: THREE.DoubleSide }),
    wallpaperBotanical: new THREE.MeshStandardMaterial({ map: botanicalMap, color: '#e8e6d8', roughness: .99, side: THREE.DoubleSide }),
    wallpaperDamask: new THREE.MeshStandardMaterial({ map: damaskMap, color: '#f1e9d6', roughness: .99, side: THREE.DoubleSide }),
    floor: new THREE.MeshStandardMaterial({ map: floorMap, color: '#fff4e8', roughness: 1 }),
    floorAlternate: new THREE.MeshStandardMaterial({ map: floorAlternateMap, color: '#e0c5b7', roughness: 1 }),
    brass: mat('#b49459', .36, .63),
    oldBrass: mat('#806e4d', .56, .52),
    copper: mat('#986547', .46, .64),
    iron: mat('#46514d', .54, .7),
    blackMetal: mat('#252f2b', .59, .48),
    paper: mat('#ddceb0', 1),
    paperDark: mat('#bca986', 1),
    canvas: mat('#cdbca0', .96),
    linen: mat('#d4c6b0', 1),
    leather: mat('#4b372d', 1),
    ruby: mat('#843f35', .81),
    green: mat('#435d4a', .93),
    slate: mat('#4e6468', .89),
    charcoal: mat('#242b28', .99),
    glass: new THREE.MeshPhysicalMaterial({ color: '#e9edcf', metalness: .05, roughness: .1, transmission: .48, transparent: true, opacity: .48, thickness: .13, depthWrite: false }),
    glassBlue: new THREE.MeshPhysicalMaterial({ color: '#c9dedc', roughness: .1, transmission: .28, transparent: true, opacity: .52, depthWrite: false }),
    liquidGreen: new THREE.MeshStandardMaterial({ color: '#758e71', emissive: '#526444', emissiveIntensity: .16, roughness: .3, transparent: true, opacity: .87 }),
    liquidAmber: new THREE.MeshStandardMaterial({ color: '#b87f41', emissive: '#6d3d1d', emissiveIntensity: .21, roughness: .27, transparent: true, opacity: .88 }),
    liquidBlue: new THREE.MeshStandardMaterial({ color: '#668b8c', emissive: '#3b696d', emissiveIntensity: .18, roughness: .25, transparent: true, opacity: .87 }),
  };
  // Share one pair of uniforms across every painted wood/plaster finish. These
  // modify the real Three.js fragment shader, with no texture regeneration.
  const pigment = { saturation: { value: 1 }, contrast: { value: 1 } };
  const painted = ['walnut', 'agedWood', 'darkWood', 'ash', 'oak', 'plaster',
    'restorationWall', 'floor', 'floorAlternate', 'alchemyTile', 'wallpaperBotanical', 'wallpaperDamask'];
  for (const name of painted) {
    const material = materials[name];
    const oldCompile = material.onBeforeCompile;
    material.onBeforeCompile = function (shader, ...args) {
      oldCompile.call(this, shader, ...args);
      shader.uniforms.uPigmentSaturation = pigment.saturation;
      shader.uniforms.uPigmentContrast = pigment.contrast;
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
        #include <map_fragment>
        float pigmentGray = dot(diffuseColor.rgb, vec3(.2126, .7152, .0722));
        diffuseColor.rgb = mix(vec3(pigmentGray), diffuseColor.rgb, uPigmentSaturation);
        diffuseColor.rgb = clamp((diffuseColor.rgb - vec3(.5)) * uPigmentContrast + vec3(.5), 0.0, 2.0);
      `).replace('void main() {', `
        uniform float uPigmentSaturation;
        uniform float uPigmentContrast;
        void main() {
      `);
    };
    material.customProgramCacheKey = () => 'keynlock-painted-v1';
  }
  const scaledTextures = [walnutMap, ashMap, oakMap, plasterMap, restorationPlasterMap,
    floorMap, floorAlternateMap, botanicalMap, damaskMap];
  const originalRepeats = scaledTextures.map(map => map.repeat.clone());
  function setPaintSettings({ saturation = 100, contrast = 100, scale = 100 } = {}) {
    pigment.saturation.value = THREE.MathUtils.clamp(saturation / 100, .35, 1.75);
    pigment.contrast.value = THREE.MathUtils.clamp(contrast / 100, .55, 1.6);
    const factor = THREE.MathUtils.clamp(scale / 100, .5, 2.25);
    scaledTextures.forEach((texture, i) => texture.repeat.copy(originalRepeats[i]).multiplyScalar(1 / factor));
  }
  const metalNames = ['brass', 'oldBrass', 'copper', 'iron', 'blackMetal'];
  const metalBases = metalNames.map(name => ({
    material: materials[name], roughness: materials[name].roughness,
    metalness: materials[name].metalness, color: materials[name].color.clone(),
  }));
  const metalPalettes = {
    original: null,
    copper: ['#b77e57', '#95664f', '#c17b50', '#81675d', '#3d3837'],
    silver: ['#b1b5b3', '#848d8c', '#a6a8a5', '#737d81', '#384348'],
  };
  function setMetalSettings({ roughness = 50, metalness = 65, palette = 'original' } = {}) {
    const colors = metalPalettes[palette] || null;
    metalBases.forEach((base, i) => {
      base.material.roughness = THREE.MathUtils.clamp(base.roughness + (roughness - 50) * .009, .07, 1);
      base.material.metalness = THREE.MathUtils.clamp(base.metalness + (metalness - 65) * .012, 0, 1);
      if (colors) base.material.color.set(colors[i]);
      else base.material.color.copy(base.color);
    });
  }
  return { materials, load, textureLoader, visual: { setPaintSettings, setMetalSettings } };
}

export function canvasTexture(draw, width = 1024, height = 1024) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Small seamless-feeling painterly papers for the optional right-wall finishes. */
export function makeWallpaperTexture(kind = 'botanical') {
  return canvasTexture((ctx, w, h) => {
    const botanical = kind === 'botanical';
    const ground = ctx.createLinearGradient(0, 0, w, h);
    if (botanical) {
      ground.addColorStop(0, '#526a5a'); ground.addColorStop(.5, '#425c4d'); ground.addColorStop(1, '#344e45');
    } else {
      ground.addColorStop(0, '#54483e'); ground.addColorStop(.5, '#423b36'); ground.addColorStop(1, '#352f2c');
    }
    ctx.fillStyle = ground; ctx.fillRect(0, 0, w, h);
    let seed = botanical ? 678 : 512;
    const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 1600; i++) {
      ctx.fillStyle = random() < .5 ? 'rgba(243,223,183,.026)' : 'rgba(9,20,17,.052)';
      ctx.fillRect(random() * w, random() * h, 1 + random() * 22, 1 + random() * 14);
    }
    for (const cy of [84, 256, 428]) for (const cx of [84, 256, 428]) {
      ctx.strokeStyle = botanical ? 'rgba(183,180,129,.48)' : 'rgba(192,151,106,.42)';
      ctx.lineWidth = botanical ? 3 : 4;
      ctx.beginPath(); ctx.moveTo(cx, cy + 55);
      ctx.bezierCurveTo(cx - 40, cy + 12, cx + 42, cy - 8, cx, cy - 58);
      ctx.stroke();
      for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
        const x = cx + side * (18 + i * 9), y = cy + 30 - i * 27;
        ctx.save(); ctx.translate(x, y); ctx.rotate(side * (.64 + i * .12));
        ctx.beginPath(); ctx.ellipse(0, 0, botanical ? 8 : 11, botanical ? 22 : 27, 0, 0, Math.PI * 2);
        ctx.fillStyle = botanical ? 'rgba(157,177,119,.30)' : 'rgba(180,135,105,.23)';
        ctx.fill(); ctx.stroke(); ctx.restore();
      }
      ctx.fillStyle = botanical ? '#b0ac79' : '#b38c65';
      for (let k = 0; k < 5; k++) {
        const angle = k * Math.PI * 2 / 5;
        ctx.beginPath(); ctx.ellipse(cx + Math.cos(angle) * 9, cy - 59 + Math.sin(angle) * 9, 6, 10, angle, 0, Math.PI * 2);ctx.fill();
      }
      ctx.fillStyle = '#d1b887'; ctx.beginPath(); ctx.arc(cx, cy - 59, 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = botanical ? 'rgba(26,48,38,.35)' : 'rgba(214,168,105,.13)';
    ctx.lineWidth = 2;
    for (let x = 0; x < w; x += 172) { ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke(); }
  }, 512, 512);
}

export function makeCityWindowTexture() {
  return canvasTexture((ctx, w, h) => {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#67818b'); sky.addColorStop(.42, '#b2a79c');
    sky.addColorStop(.68, '#d0a478'); sky.addColorStop(1, '#526c72');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    let seed = 13; const rnd = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 60; i++) {
      const x = rnd() * w, y = 160 + rnd() * 270;
      ctx.strokeStyle = `rgba(255,231,184,${.02 + rnd() * .08})`;
      ctx.lineWidth = 1 + rnd() * 6; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + rnd() * 70, y + rnd() * 12); ctx.stroke();
    }
    const silhouette = (back, low, high) => {
      ctx.fillStyle = back;
      let x = -20;
      while (x < w + 30) {
        const width = 32 + rnd() * 80, top = high + rnd() * low;
        ctx.fillRect(x, top, width, 630 - top);
        ctx.beginPath(); ctx.moveTo(x - 5, top); ctx.lineTo(x + width / 2, top - 25 - rnd() * 50); ctx.lineTo(x + width + 5, top); ctx.fill();
        for (let k = 0; k < 3; k++) {
          ctx.fillStyle = rnd() > .55 ? 'rgba(247,200,120,.58)' : 'rgba(43,62,65,.65)';
          ctx.fillRect(x + 8 + k * 15, top + 28, 5, 12);
        }
        ctx.fillStyle = back;
        x += width + 3;
      }
    };
    silhouette('#687779', 170, 380);
    silhouette('#43585a', 130, 460);
    const water = ctx.createLinearGradient(0, 590, 0, h);
    water.addColorStop(0, '#637f7d'); water.addColorStop(1, '#2c5057');
    ctx.fillStyle = water; ctx.fillRect(0, 598, w, h);
    ctx.strokeStyle = '#374e50'; ctx.lineWidth = 30; ctx.beginPath(); ctx.moveTo(-50, 665); ctx.quadraticCurveTo(460, 595, w + 40, 668); ctx.stroke();
    for (let i = 0; i < 110; i++) {
      const x = rnd() * w, y = 630 + rnd() * 390;
      ctx.strokeStyle = `rgba(${rnd() > .45 ? '242,190,124' : '169,205,205'},${.08 + rnd() * .34})`;
      ctx.lineWidth = .5 + rnd() * 4; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + rnd() * 75, y); ctx.stroke();
    }
    // Painterly, uneven contours retain the watercolor character of the workshops.
    for (let i = 0; i < 700; i++) {
      ctx.fillStyle = `rgba(255,240,220,${.01 + rnd() * .045})`;
      ctx.fillRect(rnd() * w, rnd() * h, .8 + rnd() * 16, .5 + rnd() * 3);
    }
  });
}

/** Woven, painterly linen. The texture stays fixed while the cloth mesh deforms. */
export function makeCurtainLinenTexture() {
  return canvasTexture((ctx, w, h) => {
    const ground = ctx.createLinearGradient(0, 0, w, 0);
    ground.addColorStop(0, '#3e5959');
    ground.addColorStop(.22, '#69817e');
    ground.addColorStop(.49, '#93a49b');
    ground.addColorStop(.73, '#647d79');
    ground.addColorStop(1, '#405958');
    ctx.fillStyle = ground;
    ctx.fillRect(0, 0, w, h);
    let seed = 322;
    const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
    for (let x = 0; x < w; x += 3) {
      ctx.fillStyle = `rgba(227,225,195,${.025 + random() * .085})`;
      ctx.fillRect(x, 0, 1, h);
    }
    for (let y = 0; y < h; y += 4) {
      ctx.fillStyle = `rgba(25,49,48,${.012 + random() * .05})`;
      ctx.fillRect(0, y, w, 1);
    }
    for (let i = 0; i < 550; i++) {
      ctx.fillStyle = random() < .45 ? 'rgba(215,216,182,.045)' : 'rgba(28,53,51,.046)';
      ctx.fillRect(random() * w, random() * h, 2 + random() * 18, 6 + random() * 72);
    }
    // A thicker sewn hem catches the light around the bottom edge.
    ctx.fillStyle = 'rgba(28,53,51,.17)'; ctx.fillRect(0, h - 28, w, 8);
    ctx.fillStyle = 'rgba(221,217,175,.22)'; ctx.fillRect(0, h - 19, w, 3);
  }, 512, 1024);
}

/** Transparent city silhouettes on two physically separated parallax planes. */
export function makeCityDepthTexture(layer = 'middle') {
  return canvasTexture((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    let seed = layer === 'near' ? 776 : 241;
    const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
    const near = layer === 'near';
    const drawBuilding = (x, width, top, index) => {
      const paint = near
        ? ['#62564c', '#635f58', '#675b50', '#4c5654'][index % 4]
        : ['#798183', '#778184', '#6b7578', '#897d73'][index % 4];
      ctx.globalAlpha = near ? .98 : .84;
      ctx.fillStyle = paint;
      ctx.fillRect(x, top, width, h - top);
      ctx.beginPath();
      ctx.moveTo(x - 7, top + 3);
      ctx.lineTo(x + width * (.42 + random() * .18), top - 29 - random() * 44);
      ctx.lineTo(x + width + 7, top + 3);
      ctx.closePath();
      ctx.fillStyle = near ? '#594237' : '#786b66'; ctx.fill();
      ctx.strokeStyle = near ? 'rgba(198,159,118,.32)' : 'rgba(234,208,169,.38)';
      ctx.lineWidth = near ? 5 : 3;
      ctx.beginPath(); ctx.moveTo(x + 5, top + 5); ctx.lineTo(x + width - 5, top + 5); ctx.stroke();
      // Irregular luminous sash windows, arranged in quiet stacked rows.
      for (let row = 0; row < 4; row++) for (let col = 0; col < Math.floor((width - 12) / 25); col++) {
        const wx = x + 11 + col * 25, wy = top + 28 + row * (near ? 70 : 62);
        if (wy > h - 23) continue;
        const lit = random() > .43;
        ctx.fillStyle = lit ? 'rgba(239,195,128,.56)' : 'rgba(38,58,60,.72)';
        ctx.fillRect(wx, wy, near ? 11 : 9, near ? 21 : 17);
        ctx.fillStyle = 'rgba(49,48,43,.64)'; ctx.fillRect(wx + 5, wy, 2, near ? 21 : 17);
      }
      ctx.globalAlpha = 1;
    };
    if (near) {
      // Two nearby buildings frame the canal; the center remains clear.
      drawBuilding(-15, 184, 204, 0);
      drawBuilding(163, 136, 279, 1);
      drawBuilding(800, 142, 236, 2);
      drawBuilding(929, 121, 291, 3);
      ctx.strokeStyle = 'rgba(55,62,56,.72)'; ctx.lineWidth = 7;
      for (const x of [80, 222, 863, 977]) {
        ctx.beginPath(); ctx.moveTo(x, 164); ctx.lineTo(x, 211); ctx.stroke();
      }
    } else {
      let x = -23, index = 0;
      while (x < w + 25) {
        const width = 70 + random() * 82;
        const top = 215 + random() * 130;
        drawBuilding(x, width, top, index++);
        x += width + 9 + random() * 24;
      }
      // Pier posts and an occasional tower create landmarks while panning.
      ctx.fillStyle = '#697578'; ctx.fillRect(510, 148, 30, 380);
      ctx.beginPath(); ctx.moveTo(496, 148); ctx.lineTo(525, 102); ctx.lineTo(554, 148); ctx.fill();
    }
    // Fine guache flecks soften the edges without hiding the transparent sky.
    ctx.fillStyle = near ? 'rgba(231,197,155,.1)' : 'rgba(235,225,189,.13)';
    for (let i = 0; i < 220; i++) {
      const x = random() * w, y = 320 + random() * (h - 340);
      ctx.fillRect(x, y, 1 + random() * 10, 1 + random() * 3);
    }
  }, 1024, 768);
}

export function makeMapTexture() {
  return canvasTexture((ctx, w, h) => {
    ctx.fillStyle = '#d1c19e'; ctx.fillRect(0, 0, w, h);
    let s = 87; const rnd = () => ((s = (1664525 * s + 1013904223) >>> 0) / 4294967296);
    ctx.strokeStyle = '#8a795e'; ctx.lineCap = 'round';
    for (let i = 0; i < 24; i++) {
      const y = 60 + i * 36 + rnd() * 20;
      ctx.lineWidth = 3 + rnd() * 6; ctx.beginPath(); ctx.moveTo(12, y);
      for (let x = 25; x < w; x += 100) ctx.lineTo(x, y + Math.sin(x * .01 + i) * 25);
      ctx.stroke();
    }
    for (let i = 0; i < 26; i++) {
      const x = 40 + i * 39;
      ctx.lineWidth = 2 + rnd() * 4; ctx.beginPath(); ctx.moveTo(x, 0); ctx.bezierCurveTo(x + 30, 300, x - 40, 650, x + 20, h); ctx.stroke();
    }
    ctx.strokeStyle = '#6f8d91'; ctx.lineWidth = 57; ctx.beginPath(); ctx.moveTo(260, -25); ctx.bezierCurveTo(410, 330, 450, 690, 700, h + 50); ctx.stroke();
    ctx.strokeStyle = '#a7b7ad'; ctx.lineWidth = 3; ctx.stroke();
    for (let i = 0; i < 7; i++) {
      const x = 130 + rnd() * 720, y = 100 + rnd() * 760;
      ctx.strokeStyle = '#9c4338'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(x, y, 13, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#9c4338'; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#463d30'; ctx.font = 'bold 52px Georgia'; ctx.fillText('KIENLOCK', 305, 82);
    ctx.font = '20px Georgia'; ctx.fillText('ПЛАН ГОРОДА · КАНАЛЫ И КВАРТАЛЫ', 230, 116);
  });
}

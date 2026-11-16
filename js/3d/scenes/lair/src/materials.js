import * as THREE from 'three';

export function createMaterials() {
  const textureLoader = new THREE.TextureLoader();
  const load = (name, rx = 1, ry = 1) => {
    const texture = textureLoader.load(`/assets/${name}`);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(rx, ry);
    texture.anisotropy = 4;
    return texture;
  };
  const mat = (color, roughness = .9, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const walnutMap = load('wood-walnut-gouache-v2.webp');
  const ashMap = load('wood-ash-gouache-v2.webp');
  const oakMap = load('wood-oak-gouache-v2.webp');
  const plasterMap = load('atelier-wallpaper-gouache.webp', 1.5, 1.2);
  const materials = {
    walnut: new THREE.MeshStandardMaterial({ map: walnutMap, color: '#a08a6e', roughness: .93 }),
    agedWood: new THREE.MeshStandardMaterial({ map: walnutMap, color: '#766048', roughness: .92 }),
    darkWood: new THREE.MeshStandardMaterial({ map: walnutMap, color: '#514330', roughness: .94 }),
    ash: new THREE.MeshStandardMaterial({ map: ashMap, color: '#bba88e', roughness: .94 }),
    oak: new THREE.MeshStandardMaterial({ map: oakMap, color: '#aa916c', roughness: .94 }),
    plaster: new THREE.MeshStandardMaterial({ map: plasterMap, color: '#c7b8a5', roughness: 1 }),
    floor: new THREE.MeshStandardMaterial({ map: walnutMap, color: '#9b7857', roughness: .89 }),
    floorAlternate: new THREE.MeshStandardMaterial({ map: walnutMap, color: '#80674c', roughness: .9 }),
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
  return { materials, load, textureLoader };
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

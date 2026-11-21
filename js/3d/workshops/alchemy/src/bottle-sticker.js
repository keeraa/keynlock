// @ts-check
// The seven supplied illustrated crests replace the old text labels. All
// decals share one curved mesh following the actual rounded glass silhouette.
export const BOTTLE_STICKER_IMAGES = Object.freeze({
  stannum: new URL('./assets/label-stannum.png', import.meta.url).href,
  plumbum: new URL('./assets/label-plumbum.png', import.meta.url).href,
  aurum: new URL('./assets/label-aurum.png', import.meta.url).href,
  cuprum: new URL('./assets/label-cuprum.png', import.meta.url).href,
  hydrargyrum: new URL('./assets/label-hydrargyrum.png', import.meta.url).href,
  argentum: new URL('./assets/label-argentum.png', import.meta.url).href,
  ferrum: new URL('./assets/label-ferrum.png', import.meta.url).href
});

export function createBottleStickerGeometry(THREE, bottleProfile) {
  const lowerY = .315, upperY = .825;
  const halfAngle = .45;
  const horizontalSegments = 32, verticalSegments = 24;
  const clearance = .013;
  const positions = [], uvs = [], indices = [];
  function radiusAt(y) {
    for (let i = 1; i < bottleProfile.length; i++) {
      const [r0, y0] = bottleProfile[i - 1];
      const [r1, y1] = bottleProfile[i];
      if (y1 > y0 && y >= y0 && y <= y1) {
        const t = (y - y0) / (y1 - y0);
        return r0 + (r1 - r0) * t + clearance;
      }
    }
    throw new Error('Sticker lies outside the bottle surface');
  }
  for (let row = 0; row <= verticalSegments; row++) {
    const v = row / verticalSegments;
    const y = lowerY + (upperY - lowerY) * v;
    const radius = radiusAt(y);
    for (let col = 0; col <= horizontalSegments; col++) {
      const u = col / horizontalSegments;
      const angle = (u * 2 - 1) * halfAngle;
      positions.push(Math.sin(angle) * radius, y, Math.cos(angle) * radius);
      uvs.push(u, v);
    }
  }
  const stride = horizontalSegments + 1;
  for (let row = 0; row < verticalSegments; row++) {
    for (let col = 0; col < horizontalSegments; col++) {
      const a = row * stride + col;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.name = 'curved-gouache-bottle-sticker';
  return geometry;
}

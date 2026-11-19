import * as THREE from 'three';
import { createDistrictLayer } from './district-layer.js';

/**
 * Connects the agreed seven-district zoning plan to a Three.js editor viewport.
 *
 * This adapter has no dependency on the city editor's state or geometry.
 * Usage from the live editor:
 *
 *   const districts = mountCityDistricts({
 *     viewport: sceneViewport, canvas: renderer.domElement, camera,
 *     mapWidth: 2640, mapHeight: 1800,
 *     sampleHeight: (x, z) => terrain.heightAt(x, z),
 *     onSelect: id => focusDistrict(id),
 *   });
 *   // Inside the existing render loop:
 *   districts.update();
 *
 * Geographic orientation can be overridden with mapUvToWorld(u, v).
 */
export function mountCityDistricts({
  viewport,
  canvas,
  camera,
  mapWidth = 2640,
  mapHeight = 1800,
  sampleHeight = () => 0,
  mapUvToWorld = (u, v) => ({ x: (u - .5) * mapWidth, z: (v - .5) * mapHeight }),
  onSelect = () => {},
  initiallyVisible = true,
} = {}) {
  if (!viewport || !canvas || !camera) {
    throw new Error('mountCityDistricts requires viewport, canvas, and camera');
  }
  const dimensions = { width: mapWidth, height: mapHeight };
  const projected = new THREE.Vector3();

  function project({ x, z }) {
    const u = x / mapWidth + .5;
    const v = z / mapHeight + .5;
    const world = mapUvToWorld(u, v);
    if (!world || !Number.isFinite(world.x) || !Number.isFinite(world.z)) return null;
    const y = Number.isFinite(world.y) ? world.y : sampleHeight(world.x, world.z) + .25;
    projected.set(world.x, y, world.z).project(camera);
    const width = canvas.clientWidth || 1, height = canvas.clientHeight || 1;
    return {
      x: (projected.x * .5 + .5) * width,
      y: (-projected.y * .5 + .5) * height,
      visible: projected.z >= -1 && projected.z <= 1,
    };
  }

  const layer = createDistrictLayer({
    host: viewport,
    project,
    dimensions,
    heightAt: () => 0,
    onSelect,
    initiallyVisible,
  });

  return layer;
}

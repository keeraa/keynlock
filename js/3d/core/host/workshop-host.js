// @ts-check
/**
 * The contract between the Lair (the host) and the workshops it mounts.
 *
 * The Lair and the workshop packages are bundled into one module graph, so
 * this module is shared state, not a global: the Lair fills the host before it
 * imports a workshop, and a workshop that runs as its own site finds no host.
 * Every member is optional for the workshop: it reads them when it needs them,
 * so the Lair may add a member later (for example once a view is created).
 *
 * The workbench is still developed separately and opens in an iframe; it finds
 * the shared renderer through `window.__keynlockRendererHost` instead.
 */

/**
 * @typedef {object} RendererHost The Lair's one WebGLRenderer, shared by all workshops
 *   (see js/3d/scenes/lair/src/shared-renderer-host.js).
 * @property {(station: string, canvas: HTMLCanvasElement) => any} createRenderer
 * @property {(station: string, world: { scene: any, camera: any, additionalScenes?: any[], slot?: string }) => any} registerWorldScene
 * @property {(station: string, workshop: { enter?: () => void, exit?: () => void, update?: (now: number) => void }, options?: object) => () => void} [registerWorldWorkshop]
 * @property {() => any} [getUnifiedScene]
 * @property {() => string | null} [current]
 */

/**
 * @typedef {object} AtelierHost What the Lair offers the Atelier.
 * @property {HTMLElement} [root] Where the Atelier's markup is mounted.
 * @property {(pose: { side: string, position: number[], target: number[], fov: number }) => void} [focusArtwork]
 *   Fly the room camera to a painting.
 * @property {() => void} [focusEasels] Return the room camera to both easels.
 * @property {(info: { label: string, x: number, y: number } | null) => void} [hoverGalleryArtwork]
 *   Show or hide the room's caption for a gallery painting.
 * @property {boolean} [galleryActive] True while the room shows the painting wall.
 */

/**
 * @typedef {object} AlchemyHost What the Lair offers the laboratory.
 * @property {HTMLElement} [root] Where the laboratory's markup is mounted.
 * @property {HTMLElement} [inputPlane] The element that receives pointer input over the lab.
 * @property {(gesture: { zoom?: number, panX?: number, panY?: number, rotateX?: number, rotateY?: number }) => void} [manipulate]
 *   Move the room camera around the lab.
 * @property {() => void} [resetCamera] Return the room camera to the lab's start view.
 */

/**
 * @typedef {object} WorkshopHost
 * @property {RendererHost} [renderer]
 * @property {any} [camera] The room's camera (THREE.PerspectiveCamera).
 * @property {any} [controls] The room's OrbitControls.
 * @property {HTMLElement} [interactionElement] The element that receives pointer input over the room.
 * @property {AtelierHost} atelier
 * @property {AlchemyHost} alchemy
 */

/** @type {WorkshopHost | null} */
let host = null;
/** @type {Map<string, Record<string, any>>} */
const published = new Map();

/** The Lair calls this once, before it imports any workshop. */
export function setWorkshopHost(/** @type {WorkshopHost} */ value) {
  host = value;
  return value;
}

/** A workshop calls this to find out whether it runs inside the Lair. */
export function getWorkshopHost() {
  return host;
}

/**
 * A workshop offers the Lair an API under its station id ('restoration',
 * 'alchemy'). Several calls for the same id are merged.
 */
export function publishWorkshopApi(/** @type {string} */ id, /** @type {Record<string, any>} */ api) {
  published.set(id, { ...published.get(id), ...api });
}

/** The Lair reads a workshop's API; null until the workshop has published it. */
export function getWorkshopApi(/** @type {string} */ id) {
  return published.get(id) ?? null;
}

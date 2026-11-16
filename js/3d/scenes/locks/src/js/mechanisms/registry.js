// @ts-check
/** One predictable lifecycle for the three permanently mounted lock studies. */
/** @typedef {import('../types/contracts.js').MechanismHandle} MechanismHandle */
/** @typedef {import('../types/contracts.js').MechanismFrame} MechanismFrame */
/** @typedef {import('../types/contracts.js').LockMode} LockMode */
/**
 * @param {{name:LockMode,model:unknown,group:{visible:boolean},
 *   update:(frame:MechanismFrame)=>void,reset?:()=>void,dispose?:()=>void}} options
 * @returns {MechanismHandle}
 */
export function createMechanismHandle({ name, model, group, update, reset = () => {},
  dispose = () => {} }) {
  if (!name || !group || typeof update !== 'function')
    throw new Error('Mechanism requires a name, group and update(frame).');
  let disposed = false;
  return {
    name, group,
    create() { return model; },
    update(frame) { if (!disposed) update(frame); },
    reset() { if (!disposed) reset(); },
    dispose() {
      if (disposed) return;
      disposed = true;
      dispose();
    },
    get disposed() { return disposed; },
  };
}

/** @param {Record<LockMode, MechanismHandle>} handles */
export function createMechanismRegistry(handles) {
  const entries = new Map(Object.entries(handles));
  /** @type {LockMode|null} */
  let active = null;
  if (!entries.size) throw new Error('At least one lock mechanism is required.');
  for (const [name, handle] of entries) {
    if (handle.name !== name) throw new Error(`Mechanism name mismatch: ${name}`);
  }
  return {
    /** @param {LockMode} name */
    activate(name) {
      if (!entries.has(name)) throw new Error(`Unknown lock mechanism: ${name}`);
      for (const [id, handle] of entries) handle.group.visible = id === name;
      active = name;
    },
    /** @param {MechanismFrame} frame */
    update(frame) { if (active) entries.get(active)?.update(frame); },
    /** @param {LockMode|null} [name] */
    reset(name = active) { if (name) entries.get(name)?.reset(); },
    dispose() { for (const handle of entries.values()) handle.dispose(); },
    get activeMode() { return active; },
    /** @param {LockMode} name */
    get(name) { return entries.get(name); },
  };
}

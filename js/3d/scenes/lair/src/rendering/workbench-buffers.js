const bufferTypes = {
  Float32Array, Float16Array: globalThis.Float16Array, Uint16Array, Int16Array, Uint32Array,
  Int32Array, Int8Array, Uint8Array, Uint8ClampedArray,
};

function adoptAttribute(attribute) {
  const buffer = attribute?.isInterleavedBufferAttribute ? attribute.data : attribute;
  const array = buffer?.array;
  const Type = bufferTypes[array?.constructor.name];
  if (Type && !(array instanceof Type)) {
    // Three.js checks the typed array's constructor in the renderer's window.
    // Reuse the same bytes so edits by the iframe's simulation stay visible.
    buffer.array = new Type(array.buffer, array.byteOffset, array.length);
  }
}

/** Prepare geometry created in the workbench iframe for the shared renderer. */
export function adoptWorkbenchBuffers(scene) {
  scene.traverseVisible(object => {
    const geometry = object.geometry;
    if (!geometry) return;
    adoptAttribute(geometry.index);
    for (const attribute of Object.values(geometry.attributes)) adoptAttribute(attribute);
    if (object.isInstancedMesh) {
      adoptAttribute(object.instanceMatrix);
      adoptAttribute(object.instanceColor);
    }
  });
}

import * as THREE from 'three';

/** Outline tube resolution: segments along the silhouette, sides around it, rim segments. */
const OUTLINE_ALONG = 56, OUTLINE_AROUND = 6, RIM_SEGMENTS = 64;

// The old vertical tube strokes would show through transparent vessels from
// above. Fade only those strokes, replacing them with a real 3D silhouette.
export function sideContourVisibility(elevation) {
  return 1 - THREE.MathUtils.smoothstep(elevation, .59, .97);
}

function makeOverheadOutlineMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(0x253439) },
      uWidth: { value: 1 },
      uOpacity: { value: 0 }
    },
    extensions: { derivatives: true },
    transparent: true, depthTest: true, depthWrite: false,
    side: THREE.FrontSide, toneMapped: false,
    vertexShader: `
      varying vec3 vViewNormal;
      varying vec3 vViewPosition;
      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = viewPosition.xyz;
        vViewNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uWidth;
      uniform float uOpacity;
      varying vec3 vViewNormal;
      varying vec3 vViewPosition;
      void main() {
        // Grazing-angle geometry forms the actual contour at ANY camera pitch.
        // Its fwidth is screen-space, keeping the stroke thin at every zoom.
        float facing = abs(dot(normalize(vViewNormal), normalize(-vViewPosition)));
        float pixelWidth = max(fwidth(facing), .0005) * max(.4, uWidth) * 1.75;
        float ink = 1.0 - smoothstep(0.0, pixelWidth, facing);
        if (ink < .015) discard;
        gl_FragColor = vec4(uColor, uOpacity * ink);
        #include <colorspace_fragment>
      }
    `
  });
}

// Explicit camera-facing contour strokes stay readable on translucent glass.
// A back-face outline shell would fill the vessel because its front glass
// deliberately does not write to the depth buffer.
export function createGlassContour(parent, profile, rimRadius, rimY, { thicknessScale = 1, drawRim = true, silhouetteGeometry = null } = {}) {
  const group = new THREE.Group();
  parent.add(group);
  const material = new THREE.MeshBasicMaterial({
    color: 0x253439, transparent: true, opacity: .83,
    // Glass itself never writes opaque depth. Test against actual opaque
    // objects without bias so a stroke vanishes only when truly occluded.
    depthWrite: false, depthTest: true, toneMapped: false
  });
  const outside = profile.slice(0, -2);
  const lines = [-1, 1].map(side => {
    const curve = new THREE.CatmullRomCurve3(outside.map(([radius, height]) =>
      new THREE.Vector3(side * radius * 1.008, height, 0)), false, 'centripetal');
    // The solid-object outline shader uses screen-space pixels. At the
    // default tabletop camera a .007 world-radius tube reads as about 1 px.
    // Six sides still keep it continuous at shallow camera angles (ten were
    // indistinguishable at this size and cost 40 % more triangles).
    const line = new THREE.Mesh(new THREE.TubeGeometry(curve, OUTLINE_ALONG, .007 * thicknessScale, OUTLINE_AROUND, false), material);
    line.renderOrder = 11;
    line.castShadow = line.receiveShadow = false;
    group.add(line);
    return { curve, line };
  });
  const rimMaterial = material.clone();
  const rim = drawRim ? new THREE.Mesh(new THREE.TorusGeometry(rimRadius, .0064 * thicknessScale, OUTLINE_AROUND, RIM_SEGMENTS), rimMaterial) : null;
  if (rim) {
    rim.position.y = rimY + .006;
    rim.rotation.x = Math.PI / 2;
    rim.renderOrder = 11;
    rim.castShadow = rim.receiveShadow = false;
    group.add(rim);
  }

  // The geometry-based edge follows the bottle's actual shoulders and neck.
  // Unlike the two old vertical strokes it cannot cross the open top when
  // the camera rises above the table.
  const surfaceGeometry = silhouetteGeometry || new THREE.LatheGeometry(
    profile.map(([radius, height]) => new THREE.Vector2(radius, height)), 64
  );
  const overheadMaterial = makeOverheadOutlineMaterial();
  const silhouette = new THREE.Mesh(surfaceGeometry, overheadMaterial);
  silhouette.name = 'angle-aware-glass-outline';
  silhouette.renderOrder = 11.5;
  silhouette.castShadow = silhouette.receiveShadow = false;
  group.add(silhouette);

  let thickness = 1;
  return {
    group, material,
    updateCamera(camera) {
      parent.updateWorldMatrix(true, false);
      const eye = parent.worldToLocal(camera.getWorldPosition(new THREE.Vector3()));
      group.rotation.y = Math.atan2(eye.x, eye.z);
      const elevation = Math.atan2(Math.max(0, eye.y - rimY * .5), Math.hypot(eye.x, eye.z));
      const visibleSides = sideContourVisibility(elevation);
      material.opacity = .83 * visibleSides;
      for (const { line } of lines) line.visible = visibleSides > .02;
      overheadMaterial.uniforms.uOpacity.value = .91 * THREE.MathUtils.smoothstep(elevation, .45, .85);
    },
    setStyle(active, width, color) {
      group.visible = active;
      material.color.copy(color);
      rimMaterial.color.copy(color);
      overheadMaterial.uniforms.uColor.value.copy(color);
      overheadMaterial.uniforms.uWidth.value = width * thicknessScale;
      if (!active || Math.abs(width - thickness) < .01) return;
      thickness = width;
      const radius = .007 * width * thicknessScale;
      for (const { curve, line } of lines) {
        line.geometry.dispose();
        line.geometry = new THREE.TubeGeometry(curve, OUTLINE_ALONG, radius, OUTLINE_AROUND, false);
      }
      if (rim) {
        rim.geometry.dispose();
        rim.geometry = new THREE.TorusGeometry(rimRadius, radius * .92, OUTLINE_AROUND, RIM_SEGMENTS);
      }
    }
  };
}

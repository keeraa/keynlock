// The approved building geometry stays untouched. A slight pigment gradient at
// the actual base of its existing surfaces joins plaster/stone to the ground.
export const FOUNDATION_SHADE=Object.freeze({strength:.17,fadeStart:.04,fadeEnd:.76});
export const BUILDING_GHOST_RENDER_ORDER=4; // Pavement is order 2; selection outline is order 5.

export function createFoundationShadedMaterial(source){
  const material=source.clone();
  const previousCompile=source.onBeforeCompile;
  const previousCacheKey=source.customProgramCacheKey?.()||'';
  material.onBeforeCompile=shader=>{
    previousCompile?.call(source,shader);
    if(!shader.vertexShader.includes('#include <begin_vertex>')||
       !shader.fragmentShader.includes('#include <tonemapping_fragment>'))return;
    shader.uniforms??={};
    shader.uniforms.uFoundationBase={value:material.userData.foundationBase||0};
    material.userData.foundationUniform=shader.uniforms.uFoundationBase;
    shader.vertexShader=`uniform float uFoundationBase;\nvarying float vFoundationHeight;\n${shader.vertexShader}`;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n vFoundationHeight = (modelMatrix * vec4(transformed, 1.0)).y - uFoundationBase;');
    shader.fragmentShader=`varying float vFoundationHeight;\n${shader.fragmentShader}`;
    shader.fragmentShader=shader.fragmentShader.replace('#include <tonemapping_fragment>',
      `gl_FragColor.rgb *= 1.0 - ${FOUNDATION_SHADE.strength.toFixed(3)} * `+
      `(1.0 - smoothstep(${FOUNDATION_SHADE.fadeStart.toFixed(3)}, `+
      `${FOUNDATION_SHADE.fadeEnd.toFixed(3)}, vFoundationHeight));\n`+
      '#include <tonemapping_fragment>');
  };
  material.customProgramCacheKey=()=>`keynlock-foundation-wash-1:${previousCacheKey}`;
  return material;
}

export function setFoundationBase(material,base){
  material.userData.foundationBase=base;
  if(material.userData.foundationUniform)material.userData.foundationUniform.value=base;
}

// Depth-only ground silhouette: paths lose their depth test below a building
// preview, while its translucent painted geometry remains visible above it.
// This one two-triangle mesh is reused as the cursor moves.
export function createPlacementRoadCutout(THREE,width,depth){
  const geometry=new THREE.PlaneGeometry(Math.max(.1,width-.18),Math.max(.1,depth-.18));
  const material=new THREE.MeshBasicMaterial({
    colorWrite:false,depthTest:true,depthWrite:true,side:THREE.DoubleSide,
  });
  const plane=new THREE.Mesh(geometry,material);
  plane.rotation.x=-Math.PI/2;
  plane.position.y=.09; // Above the paving (.065), below the preview base (.14).
  plane.renderOrder=1;
  plane.userData.noOutline=true;
  plane.castShadow=false;
  return plane;
}

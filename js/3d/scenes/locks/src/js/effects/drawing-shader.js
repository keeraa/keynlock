/** Two optional illustration layers, composited after the ordinary 3D render. */
export const drawingVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export const drawingFragmentShader = `
  uniform sampler2D tColor;
  uniform sampler2D tDepth;
  uniform sampler2D tNormal;
  uniform vec2 uTexel;
  uniform float uNear;
  uniform float uFar;
  uniform float uToon;
  uniform float uBands;
  uniform float uOutline;
  uniform float uOutlineWidth;
  varying vec2 vUv;

  float eyeDepth(vec2 uv) {
    float z = texture2D(tDepth, uv).r * 2.0 - 1.0;
    return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
  }

  float inkLuma(vec3 c) {
    return dot(c, vec3(.2126, .7152, .0722));
  }

  // Flatten each lighting band, but feather its transition to avoid hard flickering.
  float paintedBand(float light, float bands) {
    float steps = max(1.0, bands - 1.0);
    float position = clamp(light, 0.0, 1.0) * steps;
    return (floor(position) + smoothstep(.36, .64, fract(position))) / steps;
  }

  float inkEdge(vec2 uv) {
    float centerZ = texture2D(tDepth, uv).r;
    float centerDistance = eyeDepth(uv);
    vec4 centerN = texture2D(tNormal, uv);
    vec4 center = texture2D(tColor, uv);
    float edge = 0.0;
    for (int i = 0; i < 4; i++) {
      vec2 axis = i == 0 ? vec2(1.0, 0.0) : i == 1 ? vec2(-1.0, 0.0) :
        i == 2 ? vec2(0.0, 1.0) : vec2(0.0, -1.0);
      vec2 otherUv = clamp(uv + axis * uTexel * uOutlineWidth, vec2(0.0), vec2(1.0));
      float nextZ = texture2D(tDepth, otherUv).r;
      float otherDistance = eyeDepth(otherUv);
      vec4 nextN = texture2D(tNormal, otherUv);
      vec4 nextColor = texture2D(tColor, otherUv);
      float depthDelta = otherDistance - centerDistance;
      float distanceChange = abs(depthDelta);
      float threshold = max(.035, min(centerDistance, otherDistance) * .012);
      // Favor the near side of a silhouette; its far side receives a softer ink wash.
      float nearSide = mix(.48, 1.0, step(0.0, depthDelta));
      float depthEdge = smoothstep(threshold, threshold * 3.2, distanceChange) *
        nearSide * (1.0 - step(.9999, min(centerZ, nextZ)));
      // Suppress normal edges on broad curved surfaces and reflective shading.
      float normalEdge = smoothstep(.23, .67, length(centerN.rgb - nextN.rgb)) *
        min(centerN.a, nextN.a) * step(centerZ, .9999) * step(nextZ, .9999) *
        (1.0 - smoothstep(threshold * 3.0, threshold * 7.0, distanceChange));
      // Keep only strong material boundaries, not every glint and colour grain.
      float colorEdge = smoothstep(.22, .46,
        abs(inkLuma(center.rgb) - inkLuma(nextColor.rgb))) *
        min(center.a, nextColor.a) * .34;
      edge = max(edge, max(depthEdge, max(normalEdge, colorEdge)));
    }
    return edge;
  }

  void main() {
    vec4 center = texture2D(tColor, vUv);
    gl_FragColor = center;
    #include <tonemapping_fragment>
    vec3 paint = gl_FragColor.rgb;

    if (uToon > 0.0) {
      float light = inkLuma(paint);
      float flatLight = paintedBand(light, uBands);
      float paintedLight = mix(light, flatLight, uToon * .86);
      paint *= clamp(paintedLight / max(light, .075), .60, 1.32);
      float highlight = smoothstep(.22, .83, light);
      vec3 coolShadow = vec3(.958, .976, 1.018);
      vec3 warmLight = vec3(1.018, 1.009, .984);
      paint *= mix(vec3(1.0), mix(coolShadow, warmLight, highlight), uToon);
      paint = mix(vec3(inkLuma(paint)), paint, 1.0 + uToon * .07);
    }

    float edge = 0.0;
    if (uOutline > 0.0) edge = inkEdge(vUv) * uOutline;
    vec3 ink = vec3(.018, .030, .035);
    gl_FragColor = vec4(mix(clamp(paint, 0.0, 1.0), ink, edge * .96),
      max(center.a, edge * .95));
    #include <colorspace_fragment>
  }
`;

export const WATERCOLOR_PALETTE = Object.freeze([
  '#369a93',
  '#e47b62',
  '#e2b64e',
  '#4b91c6',
  '#cc6389',
  '#6d9c65',
  '#9680c4',
]);
export function createWatercolorPigments(THREE, colors = WATERCOLOR_PALETTE) {
  return colors.map((hex) => {
    if (!/^#[\da-f]{6}$/i.test(hex)) throw new TypeError('Palette uses #RRGGBB');
    const n = parseInt(hex.slice(1), 16);
    return new THREE.Vector3(
      ...[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => -Math.log(Math.max(0.04, v / 255))),
    );
  });
}
export const PAPER_RECONSTRUCTION_GLSL = `vec4 weights(float f){vec4 n=vec4(1.,2.,3.,4.)-f;vec4 s=n*n*n;return vec4(s.x,s.y-4.*s.x,s.z-4.*s.y+6.*s.x,6.-s.z+3.*s.y-3.*s.x)/6.;}
vec4 reconstruct(sampler2D image,vec2 uv){vec2 pos=uv/texel-.5,base=floor(pos),f=fract(pos);vec4 x=weights(f.x),y=weights(f.y);vec2 sx=vec2(x.x+x.y,x.z+x.w),sy=vec2(y.x+y.y,y.z+y.w);vec2 px=(base.x+vec2(-1.+x.y/sx.x,1.+x.w/sx.y)+.5)*texel.x,py=(base.y+vec2(-1.+y.y/sy.x,1.+y.w/sy.y)+.5)*texel.y;return texture2D(image,vec2(px.x,py.x))*sx.x*sy.x+texture2D(image,vec2(px.y,py.x))*sx.y*sy.x+texture2D(image,vec2(px.x,py.y))*sx.x*sy.y+texture2D(image,vec2(px.y,py.y))*sx.y*sy.y;}
`;
// The same paper, optical pigment and pale wet rim are used by paper and smoke.
export const WATERCOLOR_APPEARANCE_GLSL = `
vec3 watercolorPaper(vec2 uv,sampler2D grainTex,sampler2D parchmentTex,bool hasParchment,vec2 screen,float aspect){
 float grain=texture2D(grainTex,uv*screen/256.).r;
 vec3 color=vec3(.955,.946,.925)*(.994+grain*.009);
 if(hasParchment)color=mix(vec3(.97,.93,.82),texture2D(parchmentTex,uv*vec2(aspect,1.)*.85).rgb,.32);
 return color;
}
vec3 watercolorPaint(vec3 ink,vec3 paperColor,float coverage,float edgePixels,float wetness){
 float concentration=max(ink.r,max(ink.g,ink.b));
 float neutral=min(ink.r,min(ink.g,ink.b))*.45;
 vec3 optical=max(ink-neutral,vec3(0.));optical/=max(max(optical.r,max(optical.g,optical.b)),.0001);
 float amount=.16+.85*smoothstep(.001,.36,concentration);
 float wetEdge=exp(-max(edgePixels,0.)/3.)*smoothstep(.005,.12,wetness);
 amount*=1.-wetEdge*.60;
 vec3 painted=paperColor*exp(-optical*amount*1.35);
 return mix(paperColor,painted,coverage);
}`;

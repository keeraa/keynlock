import { PAPER_RECONSTRUCTION_GLSL, WATERCOLOR_APPEARANCE_GLSL } from './watercolor-appearance.js';
export const vertex = 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
// RGB pigment and its material-detail mass are reconstructed with the same filter.
export const softenFragment = `varying vec2 vUv;uniform sampler2D source;uniform vec2 texel;uniform float radius;
void main(){vec2 d=texel*radius;vec4 c=texture2D(source,vUv);vec4 soft=c*.25;
soft+=(texture2D(source,vUv+vec2(d.x,0.))+texture2D(source,vUv-vec2(d.x,0.))+texture2D(source,vUv+vec2(0.,d.y))+texture2D(source,vUv-vec2(0.,d.y)))*.125;
soft+=(texture2D(source,vUv+d)+texture2D(source,vUv-d)+texture2D(source,vUv+vec2(d.x,-d.y))+texture2D(source,vUv+vec2(-d.x,d.y)))*.0625;
float load=max(c.r,max(c.g,c.b));float edge=1.-smoothstep(.08,.42,load);gl_FragColor=mix(c,soft,.55+edge*.4);}`;
export const WASH_FIELD_GLSL = `float wcHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float wcCloud(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(wcHash(i),wcHash(i+vec2(1.,0.)),f.x),mix(wcHash(i+vec2(0.,1.)),wcHash(i+vec2(1.)),f.x),f.y);}
// Boundary follows the transported pigment; no paper-fixed UV distortion.
vec2 washSampleUV(vec2 uv,vec2 texel,vec2 screen){return uv;}
float washThreshold(vec2 uv,vec2 screen){return .006;}
`;
// Material detail is transported in pigment alpha as concentration-weighted detail mass.
export const washDisplayFragment = `varying vec2 vUv;uniform sampler2D pigment,paperTex,parchment;uniform bool hasParchment;uniform vec2 screen,texel;
${WASH_FIELD_GLSL}
void main(){
 float paperGrain=texture2D(paperTex,vUv*screen/256.).r;
 vec3 paper=vec3(.947,.923,.876)*(.986+paperGrain*.018);
 if(hasParchment)paper=mix(vec3(.97,.93,.82),texture2D(parchment,vUv*vec2(screen.x/screen.y,1.)*.85).rgb,.32);
 vec4 field=texture2D(pigment,vUv);vec3 ink=max(field.rgb,vec3(0.));
 float density=max(ink.r,max(ink.g,ink.b));
 float detail=clamp(field.a/max(dot(ink,vec3(1./3.)),.00001),0.,1.);
 float neutral=min(ink.r,min(ink.g,ink.b))*.45;
 vec3 optical=max(ink-neutral,vec3(0.));optical/=max(max(optical.r,max(optical.g,optical.b)),.0001);
 float coverage,amount;

  float edgeField=density-washThreshold(vUv,screen);
  float slope=max(length(vec2(dFdx(edgeField),dFdy(edgeField))),.00001);
  float edgePixels=edgeField/slope;
  float mask=smoothstep(-.65,.85,edgePixels);
  float paleEdge=exp(-max(edgePixels,0.)/3.);
  amount=(.16+.85*smoothstep(.001,.12,density))*(.78+.32*detail);
  amount*=1.-paleEdge*.52;
  coverage=mask*(1.-exp(-density*55.));
 vec3 painted=paper*exp(-optical*amount*1.35);
 gl_FragColor=vec4(mix(paper,painted,coverage),1.);
 #include <colorspace_fragment>
}`;
export const smokeDisplayFragment = `varying vec2 vUv;uniform sampler2D pigment,paperTex,parchment;uniform bool hasParchment;uniform vec2 screen,texel;
${PAPER_RECONSTRUCTION_GLSL}
${WATERCOLOR_APPEARANCE_GLSL}
void main(){
 vec3 ink=max(reconstruct(pigment,vUv).rgb,vec3(0.));
 float density=max(ink.r,max(ink.g,ink.b));
 float opacity=1.-exp(-density*18.);
 float edgeField=opacity-.035;
 float slope=max(length(vec2(dFdx(edgeField),dFdy(edgeField))),.000001);
 float coverage=smoothstep(-.65,.85,edgeField/slope)*pow(clamp(opacity,0.,1.),.8);
 vec3 paperColor=watercolorPaper(vUv,paperTex,parchment,hasParchment,screen,screen.x/screen.y);
 gl_FragColor=vec4(watercolorPaint(ink,paperColor,coverage,edgeField/slope,density),1.);
 #include <colorspace_fragment>
}`;
export function makePaperTexture(T) {
  const data = new Uint8Array(256 * 256 * 4);
  let seed = 9281;
  for (let i = 0; i < data.length; i += 4) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const n = seed >>> 24;
    data[i] = data[i + 1] = data[i + 2] = n;
    data[i + 3] = 255;
  }
  const t = new T.DataTexture(data, 256, 256, T.RGBAFormat);
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.minFilter = t.magFilter = T.LinearFilter;
  t.needsUpdate = true;
  return t;
}

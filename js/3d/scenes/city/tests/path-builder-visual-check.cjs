// Optional browser-level visual regression. Run in a Chromium environment;
// KEYNLOCK_REQUIRE_WEBGL=1 additionally requires an actual 3D context.
const assert=require('node:assert/strict');
const {createServer}=require('node:http');
const {existsSync}=require('node:fs');
const {readFile,mkdir}=require('node:fs/promises');
const path=require('node:path');
const {chromium}=require('playwright');

const base=path.resolve(process.env.KEYNLOCK_PREVIEW_ROOT||path.resolve(__dirname,'..'));
const chromiumPath=process.env.KEYNLOCK_CHROMIUM_PATH||
  (existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined);
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css',
  '.webp':'image/webp','.woff2':'font/woff2','.png':'image/png'};
const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  const pathname=url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname;
  const file=path.resolve(base,'.'+decodeURIComponent(pathname));
  if(!file.startsWith(base+path.sep)){res.writeHead(403);res.end();return;}
  try{const content=await readFile(file);
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(content);
  }catch{res.writeHead(404);res.end();}
});

(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,executablePath:chromiumPath,args:[
    '--no-sandbox','--disable-dev-shm-usage','--enable-webgl',
    '--use-gl=angle','--use-angle=swiftshader',
  ]});
  try{
    const url=`http://127.0.0.1:${server.address().port}/path-builder/`;
    const page=await browser.newPage({viewport:{width:1460,height:930},deviceScaleFactor:1});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(url,{waitUntil:'networkidle'});
    await page.waitForFunction(()=>typeof window.__keynlockPathBuilder?.getMode==='function',{timeout:25000});
    const mode=await page.evaluate(()=>window.__keynlockPathBuilder.getMode());
    if(process.env.KEYNLOCK_REQUIRE_WEBGL==='1')assert.equal(mode,'webgl','GPU regression requires Three.js');
    assert.ok(['canvas','webgl'].includes(mode));
    assert.ok(await page.locator('canvas#pathCanvas').isVisible());
    const result=await page.evaluate(async()=>{
      const {createGroundSurface,GROUND_MAP}=await import('/js/path-builder/ground-art.js');
      const painted=createGroundSurface();
      const settings={district:'old',grass:85,grassSaturation:80,moisture:30,wear:25};
      const noRoads={paths:[],plazas:[]};
      painted.setPlan([{id:'reference',type:'palace',x:0,z:0,width:12,depth:12,rotation:0}],noRoads,settings);
      const context=painted.decalsCanvas.getContext('2d');
      const pixels=context.getImageData(0,0,painted.decalsCanvas.width,painted.decalsCanvas.height).data;
      const originX=GROUND_MAP.width*GROUND_MAP.pixelsPerMetre/2;
      const originY=GROUND_MAP.depth*GROUND_MAP.pixelsPerMetre/2;
      // Follow adjacent atlas pixels along the centre of one edge. At 0.8
      // px/m, sub-metre offsets can reuse a texel, and averaging 22 rows
      // would mostly sample pixels outside this 12-metre foundation.
      const edge=Math.floor(originX+6*GROUND_MAP.pixelsPerMetre);
      const row=Math.floor(originY);
      const gradient=Array.from({length:5},(_,i)=>
        context.getImageData(edge-1+i,row,1,1).data[3]);
      const dirtyBefore=painted.setPlan([],noRoads,settings);
      const cleanAfter=painted.setPlan([],noRoads,settings);
      const canvas=painted.canvas.getContext('2d');
      const mean=()=>{
        const data=canvas.getImageData(0,0,painted.canvas.width,painted.canvas.height).data;
        let sum=0,n=0;
        for(let i=0;i<data.length;i+=4*137){sum+=data[i]*.25+data[i+1]*.6+data[i+2]*.15;n++;}
        return sum/n;
      };
      painted.setPlan([],noRoads,{...settings,grass:0,grassSaturation:0,moisture:0,wear:0});
      const dry=mean();
      painted.setPlan([],noRoads,{...settings,grass:100,grassSaturation:100,moisture:100,wear:0});
      const wet=mean();
      const joinedRivers={rivers:[
        {id:'horizontal',width:10,points:[[-26,0],[26,0]]},
        {id:'vertical',width:12,points:[[0,-24],[0,24]]}],hills:[],bridges:[]};
      painted.setPlan([],noRoads,settings,'auto',joinedRivers);
      const sampleAlpha=(surface,x,z)=>{
        const px=Math.round((x+GROUND_MAP.width/2)*GROUND_MAP.pixelsPerMetre);
        const py=Math.round((z+GROUND_MAP.depth/2)*GROUND_MAP.pixelsPerMetre);
        return surface.getContext('2d').getImageData(px,py,1,1).data[3];
      };
      const confluence={centre:sampleAlpha(painted.waterCanvas,0,0),
        branch:sampleAlpha(painted.waterCanvas,0,8),
        outside:sampleAlpha(painted.waterCanvas,8,8)};
      painted.dispose();
      return {gradient,dirtyBefore,cleanAfter,dry,wet,confluence};
    });
    assert.ok(result.gradient[1]>result.gradient[2]&&result.gradient[2]>result.gradient[3],
      `Foundation shade must fade at the edge: ${result.gradient}`);
    assert.ok(result.gradient[2]>result.gradient.at(-1)+7,
      `Foundation fade must transition to clear lawn: ${result.gradient}`);
    assert.ok(result.gradient.every((value,i,array)=>i===0||array[i-1]-value<75),
      `No abrupt rectangular edge allowed: ${result.gradient}`);
    assert.deepEqual(result.cleanAfter,{baseChanged:false,decalsChanged:false,waterChanged:false},
      'Identical settings must not dirty either GPU texture');
    assert.ok(Math.abs(result.dry-result.wet)>5,
      `Grass/moisture controls must change painted ground: ${result.dry} vs ${result.wet}`);
    assert.ok(result.confluence.centre>240&&result.confluence.branch>240&&result.confluence.outside<10,
      `Intersecting rivers must form one connected water mask: ${JSON.stringify(result.confluence)}`);
    await mkdir(path.join(base,'qa'),{recursive:true});
    await page.locator('[data-view="top"]').click();
    await page.waitForTimeout(700);
    await page.locator('canvas#pathCanvas').screenshot({path:path.join(base,`qa/path-builder-${mode}-top.png`)});
    assert.equal(errors.length,0,`Page errors: ${errors.join('; ')}`);
    console.log(`Path-builder ${mode}: soft foundation fade ${result.gradient.join(' → ')}, ground contrast OK`);
    await page.close();
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>server.close());

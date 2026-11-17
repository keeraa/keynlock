// Optional GPU smoke test: captures the landmark editor from three angles.
const {createServer}=require('node:http');
const {readFile,mkdir}=require('node:fs/promises');
const path=require('node:path');
const {chromium}=require('playwright');

const base=path.resolve(__dirname,'..');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.webp':'image/webp'};
const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  const file=path.resolve(base,'.'+decodeURIComponent(url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname));
  if(!file.startsWith(base+path.sep)){res.writeHead(403);res.end();return;}
  try{const content=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(content);}
  catch{res.writeHead(404);res.end();}
});

(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:[
    '--no-sandbox','--disable-dev-shm-usage','--enable-webgl','--use-gl=angle',
    '--use-angle=swiftshader','--disable-web-security',
  ]});
  try{
    const page=await browser.newPage({viewport:{width:1550,height:960},deviceScaleFactor:1});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/landmark-lab/`,{waitUntil:'networkidle'});
    await mkdir(path.join(base,'qa'),{recursive:true});
    for(const id of ['church','theater','museum','townhall','palace','tower']){
      await page.locator(`[data-landmark="${id}"]`).click();
      for(const view of ['theater','museum','townhall'].includes(id)?['front','side','three-quarter']:['three-quarter']){
        await page.locator(`[data-view="${view}"]`).click();
        await page.waitForTimeout(350);
        await page.locator('.stage').screenshot({path:path.join(base,`qa/landmark-${id}-${view}.png`)});
      }
      const info={title:await page.locator('#modelTitle').innerText(),triangles:await page.locator('#passportTriangles').innerText()};
      if(!info.title||info.triangles==='—')throw new Error(`${id}: missing model information`);
      if(['theater','museum','townhall'].includes(id)&&await page.locator('#landmarkChimneys').isChecked())
        throw new Error(`${id}: chimney is enabled by default`);
    }
    await page.locator('[data-landmark="palace"]').click();
    await page.locator('[data-lod="low"]').click();
    await page.locator('.stage').screenshot({path:path.join(base,'qa/landmark-palace-low.png')});
    const low=Number((await page.locator('#passportTriangles').innerText()).replace(/\s/g,''));
    if(low>2800)throw new Error(`Palace LOD is too heavy: ${low}`);
    await page.locator('[data-landmark="townhall"]').click();
    await page.locator('#landmarkChimneys').check();
    if(!await page.locator('#landmarkChimneys').isChecked())throw new Error('Cannot enable chimney');
    await page.locator('#landmarkChimneys').uncheck();
    const mobile=await browser.newPage({viewport:{width:430,height:850},deviceScaleFactor:1});
    await mobile.goto(`http://127.0.0.1:${server.address().port}/landmark-lab/`,{waitUntil:'networkidle'});
    await mobile.screenshot({path:path.join(base,'qa/landmark-mobile.png'),fullPage:true});
    await mobile.close();
    if(errors.length)throw new Error(errors.join('\n'));
    console.log('Landmark editor: theater, museum, town hall and per-building chimney controls OK');
    await page.close();
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});

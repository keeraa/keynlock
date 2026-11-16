const {createServer}=require('node:http');
const {readFile,mkdir}=require('node:fs/promises');
const path=require('node:path');
const {chromium}=require('playwright');

const base=path.resolve(__dirname,'..');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.webp':'image/webp'};
const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');const file=path.resolve(base,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
  if(!file.startsWith(base+path.sep)){res.writeHead(403);res.end();return;}
  try{const content=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(content);}
  catch{res.writeHead(404);res.end();}
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--disable-web-security']});
  await mkdir(path.resolve(base,'qa'),{recursive:true});
  try{
    for(const [label,width,height] of [['desktop',1440,900],['mobile',430,830]]){
      const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
      const errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
      await page.goto(url,{waitUntil:'networkidle'});
      await page.waitForFunction(()=>Boolean(window.__keynlockWorld),{timeout:20000});
      await page.waitForTimeout(1300);
      await page.screenshot({path:path.resolve(base,`qa/map-${label}-3d.png`),fullPage:true});
      const stats=await page.evaluate(()=>window.__keynlockWorld.getStats());
      console.log(label,JSON.stringify({errors,stats,canvas:await page.locator('canvas').count()}));
      if(errors.length)process.exitCode=1;
      if(label==='desktop'){
        await page.locator('#visualButton').click();
        await page.locator('#outlineToggle').click();
        await page.locator('#toonBands').evaluate(input=>{input.value='5';input.dispatchEvent(new Event('input',{bubbles:true}));});
        await page.locator('[data-roof="jade"]').click();
        await page.locator('[data-time="dusk"]').click();
        await page.screenshot({path:path.resolve(base,'qa/map-settings.png')});
      }
      await page.close();
    }
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});

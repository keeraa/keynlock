const {createServer}=require('node:http');
const {readFile,mkdir}=require('node:fs/promises');
const path=require('node:path');
const {chromium}=require('playwright');

const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  const file=path.resolve(root,'.'+decodeURIComponent(url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  try{res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(await readFile(file));}
  catch{res.writeHead(404);res.end();}
});

(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${server.address().port}/landmark-lab/`;
  const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--enable-webgl','--use-gl=angle','--use-angle=swiftshader']});
  await mkdir(path.resolve(root,'qa'),{recursive:true});
  try{
    const page=await browser.newPage({viewport:{width:1512,height:960},deviceScaleFactor:1});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
    await page.goto(url,{waitUntil:'networkidle'});
    await page.waitForTimeout(1700);
    for(const [id,name] of [['church','Церковь'],['theater','Театр'],['museum','Музей'],['townhall','Ратуша'],['palace','Дворец']]){
      await page.locator(`[data-landmark="${id}"]`).click();
      await page.waitForTimeout(500);
      await page.screenshot({path:path.resolve(root,`qa/landmark-${id}.png`)});
      const info={title:await page.locator('#modelTitle').innerText(),triangles:await page.locator('#passportTriangles').innerText(),fps:await page.locator('#fpsValue').innerText()};
      console.log(id,JSON.stringify(info));
      if(!info.title.includes(name)||info.triangles==='—')process.exitCode=1;
    }
    await page.locator('[data-lod="low"]').click();
    await page.waitForTimeout(350);
    await page.screenshot({path:path.resolve(root,'qa/landmark-palace-low.png')});
    const low=await page.locator('#passportTriangles').innerText();
    if(Number(low.replace(/\s/g,''))>2500)process.exitCode=1;
    console.log('low-palace',low,'browser errors',errors);
    if(errors.length)process.exitCode=1;
    await page.close();
    const mobile=await browser.newPage({viewport:{width:430,height:850},deviceScaleFactor:1});
    await mobile.goto(url,{waitUntil:'networkidle'});
    await mobile.waitForTimeout(800);
    await mobile.screenshot({path:path.resolve(root,'qa/landmark-mobile.png'),fullPage:true});
    await mobile.close();
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});

// oxlint-disable-next-line no-unused-expressions -- trusted Playwright function.
async page=>{
 const base='http://127.0.0.1:5173/',check=(v,m)=>{if(!v)throw Error(m)},errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.addInitScript(()=>{
  Object.defineProperty(navigator,'deviceMemory',{configurable:true,value:8});
  window.__full={requests:[],decodes:0,live:0,peak:0};const fetchOriginal=fetch,decode=createImageBitmap.bind(window);
  window.fetch=(...args)=>{if(/\/frames\/.*\.webp/.test(String(args[0])))window.__full.requests.push(String(args[0]));return fetchOriginal(...args)};
  window.createImageBitmap=async(...args)=>{const image=await decode(...args),m=window.__full;m.decodes++;const bytes=image.width*image.height*4;m.live+=bytes;m.peak=Math.max(m.peak,m.live);const close=image.close.bind(image);let closed=false;image.close=()=>{if(!closed){closed=true;m.live-=bytes}close()};return image};
 });
 const result=[];
 for(const width of [1440,375]){
  await page.setViewportSize({width,height:width===375?812:900});
  for(const cache of ['cold','warm']){
   await page.goto(base,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>document.querySelector('#home')?.dataset.preparing==='false',null,{timeout:60000});
   const start=await page.evaluate(()=>({...window.__full,hero:{...document.querySelector('#home').dataset},canvas:{...document.querySelector('canvas').dataset}}));
   const count=width===375?60:72;
   check(start.hero.static==='false'&&start.decodes===count&&+start.hero.cacheSize===count,'Incomplete retained sequence at reveal');
   check(start.requests.length===count,'Repeated frame download during preparation');
   check(start.requests.every(url=>url.includes(width===375?'/mobile/':'/desktop/')),'Both profiles fetched');
   check(start.canvas.ready==='true','Canvas not prepared before reveal');
   await page.waitForTimeout(1700);
   check(await page.locator('h1').evaluate(n=>getComputedStyle(n).opacity==='1'),'Entrance did not follow reveal');
   // Any request after reveal would now fail; every distant/reverse seek must still render.
   let extra=0;await page.route('**/frames/**/*.webp*',r=>{extra++;return r.abort()});
   for(const p of [0,.25,.65,.95,1,.1,.9,.3,0]){
    await page.evaluate(p=>{const h=document.querySelector('#home'),v=document.querySelector('.hero-viewport');scrollTo(0,h.offsetTop+(h.offsetHeight-v.offsetHeight)*p)},p);
    await page.waitForFunction(expected=>+document.querySelector('canvas').dataset.paintedFrame===expected,Math.round(p*(count-1))+1);
   }
   const after=await page.evaluate(()=>({...window.__full,render:document.querySelector('canvas').dataset.renderCount}));
   await page.waitForTimeout(200);
   check(extra===0&&after.decodes===count,'Scrolling fetched or redecoded retained frames');
   check(await page.locator('canvas').getAttribute('data-render-count')===after.render,'Idle canvas moved');
   await page.unrouteAll({behavior:'wait'});
   await page.screenshot({path:`artifacts/full-frame-preloader/ready-${width}-${cache}.png`});
   result.push({width,cache,start,after});
  }
 }
 await page.route('**/frames/**/*.webp*',async r=>{await new Promise(resolve=>setTimeout(resolve,70));await r.continue()});
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>+document.querySelector('#home').dataset.decodedReady>=3);
 check(await page.locator('#home').getAttribute('data-preparing')==='true','Still revealed after only three frames');
 check(await page.locator('h1').evaluate(n=>getComputedStyle(n).opacity==='0'),'Entrance ran behind loader');
 await page.screenshot({path:'artifacts/full-frame-preloader/progress-mobile.png'});
 await page.getByRole('link',{name:'Continue without the film'}).click();
 await page.waitForFunction(()=>document.querySelector('#home').dataset.static==='true');
 check(await page.evaluate(()=>window.__full.live)===0,'Bypass leaked decoded frames');
 await page.unrouteAll({behavior:'wait'});
 let failed=0;await page.route('**/frames/**/frame_0005.webp*',r=>{failed++;return r.abort()});
 await page.goto(base);
 await page.waitForFunction(()=>document.querySelector('#home').dataset.static==='true');
 check(failed===2,'Failed frame did not receive exactly one retry');
 check(await page.evaluate(()=>window.__full.live)===0,'Failure leaked prepared frames');
 await page.unrouteAll({behavior:'wait'});
 await page.addInitScript(()=>Object.defineProperty(navigator,'deviceMemory',{configurable:true,value:2}));
 await page.goto(base);await page.waitForFunction(()=>document.querySelector('#home').dataset.static==='true');
 check(await page.evaluate(()=>window.__full.requests.length)===0,'Memory-constrained device downloaded sequence');
 await page.goto(base+'#properties');
 check(await page.locator('#home').getAttribute('data-preparing')==='false','Deep link blocked');
 check(await page.evaluate(()=>window.__full.requests.length)===0,'Deep link downloaded sequence');
 check(errors.length===0,errors.join('\n'));
 return {result,failedRetries:failed,lowMemoryPoster:true,anchorBypass:true,errors};
}

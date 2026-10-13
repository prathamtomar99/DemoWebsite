// oxlint-disable-next-line no-unused-expressions -- playwright-cli evaluates this file as a function expression.
async page => {
  const base='http://127.0.0.1:5173/',check=(v,m)=>{if(!v)throw Error(m)},errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.addInitScript(()=>{
    Object.defineProperty(navigator,'connection',{configurable:true,value:Object.assign(new EventTarget(),{effectiveType:'4g',downlink:10,rtt:50,saveData:false})});
    const native=fetch,active=new Set();window.__preparationAudit={duplicates:[],requests:[],peak:0,decoded:0,activeDecodes:0,peakDecodes:0};
    window.fetch=async(...args)=>{
      const url=String(args[0]),frame=/\/frames\/.*\.webp/.test(url),m=window.__preparationAudit;
      if(frame){if(active.has(url))m.duplicates.push(url);active.add(url);m.requests.push(url);m.peak=Math.max(m.peak,active.size)}
      try {const response=await native(...args);if(frame&&response.body){const getReader=response.body.getReader.bind(response.body);response.body.getReader=(...args)=>{const reader=getReader(...args),read=reader.read.bind(reader);reader.read=async(...args)=>{try{const value=await read(...args);if(value.done)active.delete(url);return value}catch(error){active.delete(url);throw error}};return reader}}if(frame){const blob=response.blob.bind(response);response.blob=async()=>{try{return await blob()}finally{active.delete(url)}}}return response}
      catch(e){active.delete(url);throw e}
    };
    if(window.createImageBitmap){const decode=createImageBitmap;window.createImageBitmap=async(...args)=>{const m=window.__preparationAudit;m.decoded++;m.activeDecodes++;m.peakDecodes=Math.max(m.peakDecodes,m.activeDecodes);try{return await decode(...args)}finally{m.activeDecodes--}}}
  });
  const outcomes=[];
  for(const width of [1440,375]){
    await page.setViewportSize({width,height:width===375?812:900});
    // Delayed responses make the real preparation screen observable without a fake minimum delay.
    await page.route('**/frames/**/*.webp*',async r=>{await new Promise(r=>setTimeout(r,200));await r.continue()});
    await page.goto(base,{waitUntil:'domcontentloaded'});
    await page.waitForSelector('[data-preparation="loading"]');
    check(await page.locator('h1').evaluate(n=>Number(getComputedStyle(n).opacity))===0,'Entrance ran behind preparation');
    await page.screenshot({path:`artifacts/cinematic-preloader/preparing-${width}.png`});
    await page.waitForFunction(()=>document.querySelector('#home').dataset.preparing==='false');
    const reveal=await page.evaluate(()=>({time:performance.now(),decoded:window.__preparationAudit.decoded,cache:+document.querySelector('#home').dataset.cacheSize,ready:document.querySelector('canvas').dataset.ready}));
    check(reveal.ready==='true'&&reveal.cache===(width===375?60:72),'Revealed before initial decode window');
    await page.waitForTimeout(1700);
    check(await page.locator('h1').evaluate(n=>getComputedStyle(n).opacity==='1'),'Entrance failed after reveal');
    await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
    await page.waitForTimeout(250);
    const stopped=await page.evaluate(()=>window.__preparationAudit.requests.length);
    await page.waitForTimeout(250);
    check(await page.evaluate(()=>window.__preparationAudit.requests.length)===stopped,'Pagehide kept speculative queue running');
    await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
    await page.unrouteAll({behavior:'wait'});
    await page.waitForFunction(()=>+document.querySelector('#home').dataset.compressedReady===+document.querySelector('canvas').dataset.frameCount,null,{timeout:20000});
    const warmed=await page.evaluate(()=>({...window.__preparationAudit,cache:+document.querySelector('#home').dataset.cacheSize,frames:+document.querySelector('canvas').dataset.frameCount}));
    check(warmed.duplicates.length===0&&warmed.peak===4&&warmed.peakDecodes<=2,'Duplicate/concurrent requests');
    check(warmed.decoded===warmed.frames&&warmed.cache===warmed.frames,'Full sequence was not retained');
    check(warmed.requests.every(u=>u.includes(width===375?'/mobile/':'/desktop/')),'Fetched wrong profile');
    await page.screenshot({path:`artifacts/cinematic-preloader/revealed-${width}.png`});
    await page.reload();await page.waitForFunction(()=>document.querySelector('#home').dataset.preparing==='false');
    await page.waitForFunction(()=>document.querySelector('canvas').dataset.ready==='true');
    outcomes.push({width,reveal,warmed});
  }
  await page.route('**/frames/**/manifest.json',async r=>{await new Promise(r=>setTimeout(r,3500));await r.continue()});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#home').dataset.preparing==='false');
  const deadline=await page.evaluate(()=>performance.now());
  check(deadline>=3500&&deadline<10000,'Slow manifest revealed prematurely or preparation stalled');
  check(await page.locator('.hero-poster').evaluate(n=>n.complete&&n.naturalWidth>0),'Deadline lost poster');
  await page.waitForTimeout(1700);check(await page.locator('h1').evaluate(n=>getComputedStyle(n).opacity==='1'),'Timeout stranded entrance');
  await page.unrouteAll({behavior:'wait'});
  await page.route('**/frames/**/*.webp*',r=>r.abort());await page.goto(base);
  await page.waitForFunction(()=>document.querySelector('#home').dataset.static==='true');
  check(await page.locator('#home').getAttribute('data-preparing')==='false','Failure retained loader');
  await page.unrouteAll({behavior:'wait'});
  await page.goto(base+'#properties');check(await page.locator('#home').getAttribute('data-preparing')==='false','Deep link overlay');
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto(base);
  await page.waitForTimeout(300);
  check(await page.evaluate(()=>window.__preparationAudit.requests.length)===0,'Reduced motion downloaded sequence');
  check(await page.locator('#home').getAttribute('data-preparing')==='false','Reduced motion overlay');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.addInitScript(()=>Object.defineProperty(navigator,'connection',{configurable:true,value:Object.assign(new EventTarget(),{saveData:true})}));
  await page.goto(base);await page.waitForTimeout(300);
  check(await page.evaluate(()=>window.__preparationAudit.requests.length)===0,'Save-Data downloaded sequence');
  check(await page.locator('#home').getAttribute('data-preparing')==='false','Save-Data overlay');
  check(errors.length===0,errors.join('\n'));
  return {outcomes,timeoutMs:deadline,failedFrames:true,deepLinks:true,reducedMotion:true,saveData:true,errors};
}

// oxlint-disable-next-line no-unused-expressions -- playwright-cli evaluates this file as a function expression.
async page => {
  const base = 'http://127.0.0.1:5173/';
  const check = (test, message) => { if (!test) throw new Error(message); };
  const manifest = await (await page.request.get(base+'frames/manifest.json')).json();
  const count=manifest.frameCount;
  const at=p=>Math.round(p*(count-1))+1;
  const missing='**'+manifest.filenamePattern.replace('%04d',String(at(.5)).padStart(4,'0'))+'*';
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.__heroMetrics = { openBitmaps: 0, peakBitmaps: 0, watchPaints: false, stalePaints: [], maxInflight: 0, cls: 0 };
    const metrics = window.__heroMetrics;
    const original = window.createImageBitmap.bind(window);
    window.createImageBitmap = async (...args) => {
      const bitmap = await original(...args);
      metrics.openBitmaps++;
      metrics.peakBitmaps = Math.max(metrics.peakBitmaps, metrics.openBitmaps);
      const close = bitmap.close.bind(bitmap);
      let closed = false;
      bitmap.close = () => { if (!closed) { metrics.openBitmaps--; closed = true; } close(); };
      return bitmap;
    };
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) if (!entry.hadRecentInput) metrics.cls += entry.value;
    }).observe({type:'layout-shift',buffered:true});
    addEventListener('DOMContentLoaded', () => {
      new MutationObserver(records => {
        const c = document.querySelector('canvas');
        const s = document.querySelector('#home');
        if (s) metrics.maxInflight = Math.max(metrics.maxInflight,Number(s.dataset.inflight)||0);
        if (metrics.watchPaints && records.some(r=>r.attributeName==='data-render-count') && c) {
          const v=document.querySelector('.hero-viewport'),p=Math.max(0,Math.min(1,-s.getBoundingClientRect().top/(s.offsetHeight-v.offsetHeight)));
          const position=p*(Number(c.dataset.frameCount)-1),lo=Math.floor(position)+1,hi=Math.min(lo+1,Number(c.dataset.frameCount));
          const base=Number(c.dataset.blendBase||c.dataset.paintedFrame),next=Number(c.dataset.blendNext||0);
          if ((base!==lo && base!==hi) || (next && (base!==lo || next!==hi))) metrics.stalePaints.push({...c.dataset});
        }
      }).observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['data-inflight','data-render-count']});
    });
  });
  const seek = async p => page.evaluate(progress => {
    const s=document.querySelector('#home'); const v=document.querySelector('.hero-viewport');
    scrollTo(0,s.offsetTop+(s.offsetHeight-v.offsetHeight)*progress);
  },p);
  const waitFrame = n => page.waitForFunction(frame => document.querySelector('canvas').dataset.paintedFrame === String(frame),n);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.setViewportSize({width:1440,height:900});
  await page.route('**/frames/**/*.webp*', async route => { await new Promise(r=>setTimeout(r,350)); await route.continue(); });
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => document.querySelector('.hero-poster').naturalWidth>0);
  const cold = await page.evaluate(() => ({poster:document.querySelector('.hero-poster').naturalWidth,heading:document.querySelector('h1').innerText,ready:document.querySelector('canvas').dataset.ready}));
  check(cold.poster>0 && cold.heading.length>0,'Cold load lacks poster/text');
  await page.screenshot({path:'artifacts/hero-slow-load.png'});
  await waitFrame(1);
  await page.evaluate(()=>window.__heroMetrics.watchPaints=true);
  await seek(.5);
  await page.waitForTimeout(70);
  await seek(.9);
  await page.waitForTimeout(70);
  await seek(.1);
  await waitFrame(at(.1));
  await page.waitForTimeout(500);
  check(await page.locator('canvas').getAttribute('data-painted-frame')===String(at(.1)),'Stale load overwrote current target');
  check(await page.evaluate(()=>window.__heroMetrics.stalePaints.length)===0,'Stale asynchronous paint observed');
  await page.evaluate(()=>window.__heroMetrics.watchPaints=false);
  await page.unroute('**/frames/**/*.webp*');
  const resize = [];
  for(const [width,height] of [[375,812],[812,375],[1440,900]]) {
    await page.setViewportSize({width,height});
    await page.waitForTimeout(150);
    await page.waitForFunction(()=>document.querySelector('canvas').dataset.ready==='true' && document.querySelector('canvas').dataset.paintedFrame===document.querySelector('canvas').dataset.wantedFrame);
    resize.push(await page.evaluate(()=>({width:innerWidth,height:innerHeight,canvasWidth:document.querySelector('canvas').width,canvasHeight:document.querySelector('canvas').height,capacity:document.querySelector('#home').dataset.cacheCapacity,overflow:document.documentElement.scrollWidth>innerWidth})));
  }
  check(resize.every(r=>!r.overflow && r.canvasWidth>0),'Resize caused overflow or empty canvas');
  check(resize[0].capacity===String(count),'Resize changed the latched full-sequence memory ceiling');
  await page.goto(base);
  await waitFrame(1);
  // Many distant seeks exercise eviction, reversal, and decoded-resource release.
  for (const p of [.1,.8,.2,.7,.3,.6,.4,.9,.05,.95,1,0]) {
    await seek(p); await waitFrame(at(p));
  }
  const memory = await page.evaluate(()=>({...window.__heroMetrics,cache:Number(document.querySelector('#home').dataset.cacheSize)}));
  check(memory.openBitmaps===count && memory.peakBitmaps<=count && memory.maxInflight<=10,'Unbounded decoded cache or concurrency');
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(()=>window.__heroMetrics.openBitmaps===0,null,{timeout:5000});
  check(await page.evaluate(()=>window.__heroMetrics.openBitmaps)===0,'Bitmap leak after disabling sequence');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.goto(base);
  await waitFrame(1);
  let failures = 0;
  await page.route(missing, async route => { failures++; await route.fulfill({status:404,body:'Missing test frame'}); });
  await page.goto(base);
  await page.waitForFunction(()=>document.querySelector('#home').dataset.static==='true');
  const held=await page.locator('canvas').getAttribute('data-painted-frame');
  const missingState=await page.locator('canvas').evaluate(c=>({...c.dataset}));
  check(missingState.ready!=='true' && failures===2,'Incomplete sequence was revealed or retry was unbounded');
  await page.unroute(missing);
  await page.goto(base); await waitFrame(1); await seek(1); await waitFrame(count);
  await page.route('**/frames/manifest.json',route=>route.fulfill({status:200,contentType:'application/json',body:'{"frameCount":0}'}));
  await page.goto(base);
  await page.waitForFunction(()=>document.querySelector('#home').dataset.static==='true');
  check(await page.locator('h1').isVisible(),'Invalid manifest hid HTML');
  await page.getByRole('link',{name:'Continue',exact:true}).click();
  check(await page.locator('#handoff-heading').isVisible(),'Fallback navigation broken');
  await page.unroute('**/frames/manifest.json');
  await page.route('**/frames/**/*.webp*',route=>route.fulfill({status:200,contentType:'image/webp',body:'invalid WebP test'}));
  await page.goto(base);
  await page.waitForFunction(()=>document.querySelector('#home').dataset.static==='true');
  check(await page.evaluate(()=>document.querySelector('.hero-poster').naturalWidth)>0,'Decode failure lost poster');
  await page.unroute('**/frames/**/*.webp*');
  await page.goto(base);
  await waitFrame(1);
  // Make the temporary verification section taller to test a truly distant hero.
  await page.locator('#after-hero').evaluate(el=>el.style.minHeight='300vh');
  await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));
  await page.waitForTimeout(150);
  const distantBefore=await page.locator('canvas').getAttribute('data-render-count');
  await page.waitForTimeout(350);
  const distantAfter=await page.locator('canvas').getAttribute('data-render-count');
  check(distantBefore===distantAfter,'Offscreen rendering continued');
  await seek(0); await waitFrame(1);
  await page.route('**/frames/**/*.webp*',async route=>{await new Promise(r=>setTimeout(r,200));await route.continue()});
  await seek(.7); await page.waitForTimeout(30);
  await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
  await page.waitForTimeout(300);
  check(await page.locator('#home').getAttribute('data-inflight')==='0','Pagehide did not stop pending fetch/retry work');
  const hiddenRenders=await page.locator('canvas').getAttribute('data-render-count');
  await page.waitForTimeout(250);
  check(hiddenRenders===await page.locator('canvas').getAttribute('data-render-count'),'Pagehide kept rendering');
  await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
  await waitFrame(at(.7));
  await page.unroute('**/frames/**/*.webp*');
  check(errors.length===0,errors.join('\n'));
  return {cold,rapidSeek:at(.1),resize,memory,bitmapRelease:true,missingFrame:{held,retries:failures},invalidManifest:true,decodeFailure:true,offscreenIdle:true,pageLifecycle:true,errors};
}

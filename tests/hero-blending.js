// oxlint-disable-next-line no-unused-expressions -- Browser test function loaded by the local runner.
async page => {
  const base='http://127.0.0.1:4173/',check=(ok,message)=>{if(!ok)throw Error(message)},errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const seek=async position=>{
    await page.evaluate(pos=>{const h=document.querySelector('#home'),v=document.querySelector('.hero-viewport'),n=+document.querySelector('canvas').dataset.frameCount;scrollTo(0,h.offsetTop+(h.offsetHeight-v.offsetHeight)*pos/(n-1))},position);
    await page.waitForTimeout(70);
  };
  const state=()=>page.locator('canvas').evaluate(c=>({...c.dataset,alpha:c.getContext('2d').globalAlpha}));
  const settled=()=>page.waitForFunction(()=>{const c=document.querySelector('canvas');return c.dataset.ready==='true'&&c.dataset.blendAvailable==='true'&&c.dataset.wantedFrame===c.dataset.paintedFrame});
  const results=[];
  for(const width of [1440,375]){
    await page.setViewportSize({width,height:width===1440?900:812});await page.goto(base);await settled();
    const n=+(await state()).frameCount;check(n===(width===1440?72:60),'Profile changed');
    const p=Math.floor(n*.45)+.5;await seek(p);await settled();
    const mid=await state();check(+mid.blendAlpha>.3&&+mid.blendAlpha<.7&&+mid.blendNext===+mid.blendBase+1,'Missing adjacent blend');check(mid.alpha===1,'Canvas alpha leaked');
    const before=await page.locator('canvas').evaluate(c=>({pixels:c.toDataURL(),renders:c.dataset.renderCount}));
    await page.waitForTimeout(250);await page.evaluate(()=>{dispatchEvent(new Event('scroll'));dispatchEvent(new Event('scroll'))});await page.waitForTimeout(80);
    const idle=await page.locator('canvas').evaluate(c=>({pixels:c.toDataURL(),renders:c.dataset.renderCount}));
    check(before.pixels===idle.pixels&&before.renders===idle.renders,'Stopped blend drifted or repainted');
    await seek(p+3);await settled();await seek(p);await settled();
    check(before.pixels===await page.locator('canvas').evaluate(c=>c.toDataURL()),'Reverse did not reproduce identical pixels');
    await seek(n-1);await settled();check((await state()).paintedFrame===String(n)&&(await state()).blendAlpha==='0','Last frame incomplete');
    await seek(0);await settled();check((await state()).paintedFrame==='1'&&(await state()).blendAlpha==='0','First frame incomplete');
    for(const pos of [n*.8,n*.1,n*.7,2])await seek(pos);
    await settled();check((await state()).ready==='true','Rapid seeks blanked Canvas');
    results.push({width,count:n,mid,freeze:true,reversePixelIdentity:true,endpoints:true});
  }
  // Verify a valid adjacent fallback, then the existing painted image when neither pair member loads.
  await page.setViewportSize({width:1440,height:900});
  for(const both of [false,true]){
    await page.goto(base);await settled();
    await page.route('**/frames/v2/desktop/*.webp*',route=>{
      const path=new URL(route.request().url()).pathname;
      if(path.endsWith('frame_0022.webp')||(both&&path.endsWith('frame_0021.webp')))return route.fulfill({status:404,body:'intentional missing frame'});
      return route.continue();
    });
    await seek(20.5);await page.waitForTimeout(500);const missing=await state();
    check(missing.ready==='true'&&missing.blendAlpha==='0','Missing pair blanked or blended');
    check(missing.paintedFrame===(both?'1':'21'),'Incorrect missing-frame fallback');
    results.push({bothMissing:both,missing});await page.unroute('**/frames/v2/desktop/*.webp*');
  }
  // Fresh arrival mid-hero: a failed nearest image must not discard a pending valid companion.
  await page.route('**/frames/manifest.json',async r=>{await new Promise(resolve=>setTimeout(resolve,500));await r.continue()});
  await page.route('**/frame_0022.webp*',r=>r.fulfill({status:404,body:'intentional nearest failure'}));
  await page.route('**/frame_0021.webp*',async r=>{await new Promise(resolve=>setTimeout(resolve,600));await r.continue()});
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('#home').waitFor();
  await page.evaluate(()=>{const h=document.querySelector('#home'),v=document.querySelector('.hero-viewport');scrollTo(0,h.offsetTop+20.55/71*(h.offsetHeight-v.offsetHeight))});
  await page.waitForFunction(()=>document.querySelector('canvas').dataset.paintedFrame==='21');
  check(await page.locator('#home').getAttribute('data-static')==='false','Failed nearest image prematurely discarded valid companion');
  await page.unrouteAll({behavior:'wait'});
  // A fast second frame must not replace a delayed first frame at progress zero.
  await page.route('**/frame_0001.webp*',async r=>{await new Promise(resolve=>setTimeout(resolve,600));await r.continue()});
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.evaluate(()=>scrollTo(0,0));
  await page.waitForTimeout(200);
  const opening=await state();check(opening.paintedFrame===undefined||opening.paintedFrame==='1','Wrong opening composition while first image loads');
  await page.waitForFunction(()=>document.querySelector('canvas').dataset.paintedFrame==='1');
  await page.unrouteAll({behavior:'wait'});
  results.push({freshMidHeroFallback:true,delayedFirstFrame:true});
  check(!errors.length,errors.join('\n'));return {results,errors};
}

// oxlint-disable-next-line no-unused-expressions -- playwright-cli function expression.
async page => {
 const context=await page.context().browser().newContext({viewport:{width:375,height:812},isMobile:true,hasTouch:true,deviceScaleFactor:2})
 const tab=await context.newPage(),errors=[]
 tab.on('pageerror',e=>errors.push(e.message))
 await tab.addInitScript(()=>{
  const native=createImageBitmap.bind(window);window.__soak={live:0,peak:0}
  window.createImageBitmap=async(...args)=>{const b=await native(...args);window.__soak.live++;window.__soak.peak=Math.max(window.__soak.peak,window.__soak.live);const close=b.close.bind(b);let closed=false;b.close=()=>{if(!closed){closed=true;window.__soak.live--}close()};return b}
 })
 try {
  await tab.goto('http://127.0.0.1:4173/')
  await tab.waitForFunction(()=>document.querySelector('canvas').dataset.ready==='true')
  const start=Date.now(),samples=[]
  for(let i=0;i<40;i++){
   const p=[0,.2,.8,.4,1,.6,.1,.95][i%8]
   if(i===20)await tab.setViewportSize({width:812,height:375})
   await tab.evaluate(p=>scrollTo(0,(document.querySelector('#home').offsetHeight-document.querySelector('.hero-viewport').offsetHeight)*p),p)
   await tab.waitForFunction(p=>+document.querySelector('canvas').dataset.paintedFrame===Math.round(p*59)+1,p)
   const sample=await tab.evaluate(()=>({cache:+document.querySelector('#home').dataset.cacheSize,capacity:+document.querySelector('#home').dataset.cacheCapacity,...window.__soak}))
   if(sample.cache!==60||sample.capacity!==60||sample.live!==60||sample.peak>60)throw new Error('Soak cache/bitmap growth')
   samples.push(sample)
   const renders=await tab.locator('canvas').getAttribute('data-render-count')
   await tab.waitForTimeout(3000)
   if(renders!==await tab.locator('canvas').getAttribute('data-render-count'))throw new Error('Idle rendering during soak')
  }
  await tab.emulateMedia({reducedMotion:'reduce'});await tab.waitForTimeout(100)
  if(await tab.evaluate(()=>window.__soak.live)!==0)throw new Error('Soak teardown leaked bitmaps')
  if(errors.length)throw new Error(errors.join('\n'))
  return {seconds:(Date.now()-start)/1000,seeks:40,orientation:true,maxCached:Math.max(...samples.map(s=>s.cache)),peakBitmaps:Math.max(...samples.map(s=>s.peak)),teardownReleased:true,errors}
 } finally {await context.close()}
}

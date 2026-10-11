// Complement the traversal audit with identical distant seeks after a fixed reading interval.
import {createRequire} from 'node:module'
import {writeFileSync} from 'node:fs'
const {chromium}=createRequire(import.meta.url)('/opt/homebrew/lib/node_modules/@playwright/cli/node_modules/playwright')
const browser=await chromium.launch({channel:'chrome',headless:true}),results=[]
for(const [label,url]of[['before','http://127.0.0.1:4182/'],['after','http://127.0.0.1:4173/']])for(const width of [1440,375]){
 const context=await browser.newContext({viewport:{width,height:width===375?812:900}})
 await context.addInitScript(()=>{
  Object.defineProperty(navigator,'connection',{configurable:true,value:Object.assign(new EventTarget(),{effectiveType:'4g',downlink:10,rtt:80,saveData:false})})
  window.__startup={reveal:null,decodedAtReveal:0,lcp:0}
  new MutationObserver(()=>{const h=document.querySelector('#home');if(h&&h.dataset.preparing==='false'&&window.__startup.reveal===null){window.__startup.reveal=performance.now();window.__startup.decodedAtReveal=+h.dataset.cacheSize||0}}).observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:['data-preparing']})
  new PerformanceObserver(l=>window.__startup.lcp=l.getEntries().at(-1).startTime).observe({type:'largest-contentful-paint',buffered:true})
 })
 const page=await context.newPage(),cdp=await context.newCDPSession(page)
 await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:80,downloadThroughput:1250000,uploadThroughput:125000});await cdp.send('Emulation.setCPUThrottlingRate',{rate:4})
 for(const cache of ['cold','warm']){
  if(cache==='cold')await cdp.send('Network.clearBrowserCache')
  await page.goto(url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.ready==='true')
  await page.evaluate(async()=>{await new Promise(r=>setTimeout(r,Math.max(0,12000-performance.now())))})
  const startup=await page.evaluate(()=>({...window.__startup,downloaded:+document.querySelector('#home').dataset.compressedReady||0,cacheSize:+document.querySelector('#home').dataset.cacheSize,frameCount:+document.querySelector('canvas').dataset.frameCount}))
  await page.mouse.wheel(0,1)
  const seeks=await page.evaluate(async()=>{
   const h=document.querySelector('#home'),v=document.querySelector('.hero-viewport'),c=document.querySelector('canvas'),samples=[]
   for(const p of [.65,.25,.95,.1,.8,0,1]){
    const expected=Math.round(p*(+c.dataset.frameCount-1))+1,start=performance.now();scrollTo(0,h.offsetTop+(h.offsetHeight-v.offsetHeight)*p)
    await new Promise(resolve=>{const tick=()=>{if(+c.dataset.paintedFrame===expected||performance.now()-start>3000)resolve();else requestAnimationFrame(tick)};requestAnimationFrame(tick)})
    samples.push({p,ms:performance.now()-start,expected,painted:+c.dataset.paintedFrame,ready:c.dataset.ready});await new Promise(r=>setTimeout(r,100))
   }return samples
  })
  const frames=await page.evaluate(()=>performance.getEntriesByType('resource').filter(e=>/\/frames\/.*\.webp/.test(e.name)).map(e=>({transfer:e.transferSize,bytes:e.encodedBodySize})))
  results.push({label,width,cache,startup,seeks,completedCalls:frames.length,cacheHits:frames.filter(e=>e.transfer===0).length,transferred:frames.reduce((s,e)=>s+e.transfer,0)})
  writeFileSync('artifacts/cinematic-preloader/seeks.json',JSON.stringify(results,null,2));console.log(label,width,cache,seeks.map(s=>Math.round(s.ms)))
 }
 await context.close()
}
await browser.close()

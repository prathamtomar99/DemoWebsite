// Controlled production audit: the Network Information API is explicitly matched to the link.
import {createRequire} from 'node:module'
import {writeFileSync} from 'node:fs'
const {chromium}=createRequire(import.meta.url)('/opt/homebrew/lib/node_modules/@playwright/cli/node_modules/playwright')
const browser=await chromium.launch({channel:'chrome',headless:true}),results=[]
for(const [label,url] of [['before','http://127.0.0.1:4182/'],['after','http://127.0.0.1:4173/']]) for(const mobile of [false,true]) for(const slow of [false,true]) {
 if(process.env.PREP_LABEL && label!==process.env.PREP_LABEL)continue
 if(process.env.PREP_NETWORK==='suitable' && slow)continue
 const context=await browser.newContext({viewport:mobile?{width:375,height:812}:{width:1440,height:900},deviceScaleFactor:mobile?2:1})
 await context.addInitScript(({slow})=>{
  Object.defineProperty(navigator,'connection',{configurable:true,value:Object.assign(new EventTarget(),{saveData:false,effectiveType:slow?'3g':'4g',downlink:slow?1.6:10,rtt:slow?300:80})})
  const m=window.__prep={reveal:null,readyAtReveal:0,downloadedAtReveal:0,firstCanvas:null,lcp:null,longTasks:[],decodes:[],live:0,peak:0,lag:[],stalls:0}
  const bitmap=createImageBitmap.bind(window)
  window.createImageBitmap=async(...args)=>{const start=performance.now(),image=await bitmap(...args);m.decodes.push(performance.now()-start);const bytes=image.width*image.height*4;m.live+=bytes;m.peak=Math.max(m.peak,m.live);const close=image.close.bind(image);let closed=false;image.close=()=>{if(!closed){closed=true;m.live-=bytes}close()};return image}
  const draw=CanvasRenderingContext2D.prototype.drawImage
  CanvasRenderingContext2D.prototype.drawImage=function(...args){m.firstCanvas??=performance.now();return draw.apply(this,args)}
  new PerformanceObserver(l=>{m.lcp=l.getEntries().at(-1).startTime}).observe({type:'largest-contentful-paint',buffered:true})
  new PerformanceObserver(l=>m.longTasks.push(...l.getEntries().map(e=>e.duration))).observe({type:'longtask',buffered:true})
  new MutationObserver(()=>{const h=document.querySelector('#home'),c=document.querySelector('canvas');if(h&&c&&m.reveal===null&&h.dataset.preparing!=='true'&&c.dataset.ready==='true'){m.reveal=performance.now();m.readyAtReveal=+h.dataset.cacheSize;m.downloadedAtReveal=+h.dataset.compressedReady||m.readyAtReveal}}).observe(document,{childList:true,subtree:true,attributes:true,attributeFilter:['data-preparing','data-ready']})
 },{slow})
 const page=await context.newPage(),cdp=await context.newCDPSession(page)
 await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:slow?100:80,downloadThroughput:slow?200000:1250000,uploadThroughput:125000});await cdp.send('Emulation.setCPUThrottlingRate',{rate:4})
 for(const cache of ['cold','warm']) {
  if(cache==='cold')await cdp.send('Network.clearBrowserCache')
  const network={calls:0,bodyBytes:0,cacheHits:0,failed:0},ids=new Set()
  const request=e=>{if(/\/frames\/.*\.webp/.test(e.request.url)){network.calls++;ids.add(e.requestId)}}
  const data=e=>{if(ids.has(e.requestId))network.bodyBytes+=e.encodedDataLength}
  const response=e=>{if(ids.has(e.requestId)&&e.response.fromDiskCache)network.cacheHits++}
  const failed=e=>{if(ids.has(e.requestId))network.failed++}
  cdp.on('Network.requestWillBeSent',request);cdp.on('Network.dataReceived',data);cdp.on('Network.responseReceived',response);cdp.on('Network.loadingFailed',failed)
  await page.goto(url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.ready==='true',null,{timeout:30000})
  // Fixed reading interval from navigation, identical before/after; not waiting for warmer completion.
  await page.evaluate(async()=>{await new Promise(r=>setTimeout(r,Math.max(0,9000-performance.now())))})
  const beforeScroll=await page.evaluate(()=>({time:performance.now(),completed:+document.querySelector('#home').dataset.compressedReady||0,decoded:window.__prep.decodes.length,lcp:window.__prep.lcp,resources:performance.getEntriesByType('resource').filter(e=>/\/frames\/.*\.webp/.test(e.name)).length}))
  await page.evaluate(async()=>{
   const h=document.querySelector('#home'),v=document.querySelector('.hero-viewport'),c=document.querySelector('canvas'),m=window.__prep
   let lastPaint=-1,held=0
   for(const [from,to,duration] of [[0,1,6000],[1,0,3000]]){const start=performance.now();await new Promise(resolve=>{const tick=()=>{const p=Math.min(1,(performance.now()-start)/duration);scrollTo(0,h.offsetTop+(h.offsetHeight-v.offsetHeight)*(from+(to-from)*p));const wanted=+c.dataset.wantedFrame,painted=+c.dataset.paintedFrame;m.lag.push(Math.abs(wanted-painted));if(wanted!==painted&&painted===lastPaint){held++;if(held===6)m.stalls++}else held=0;lastPaint=painted;if(p<1)requestAnimationFrame(tick);else resolve()};requestAnimationFrame(tick)})}
   for(const p of [.8,.2,1,0]){scrollTo(0,h.offsetTop+(h.offsetHeight-v.offsetHeight)*p);await new Promise(r=>setTimeout(r,350))}
  })
  const metrics=await page.evaluate(()=>{const m=window.__prep,sort=a=>[...a].sort((a,b)=>a-b),p95=a=>sort(a)[Math.floor(a.length*.95)]||0;return{reveal:m.reveal,readyAtReveal:m.readyAtReveal,downloadedAtReveal:m.downloadedAtReveal,firstCanvas:m.firstCanvas,lcp:m.lcp,longTasks:m.longTasks,peakDecoded:m.peak,decodeP95:p95(m.decodes),lagP95:p95(m.lag),stalls:m.stalls,cache:{...document.querySelector('#home').dataset}}})
  results.push({label,mobile,slow,cache,network,beforeScroll,metrics});writeFileSync(process.env.PREP_OUTPUT||'artifacts/cinematic-preloader/controlled.json',JSON.stringify(results,null,2));console.log(label,mobile,slow,cache,metrics.lagP95)
  cdp.off('Network.requestWillBeSent',request);cdp.off('Network.dataReceived',data);cdp.off('Network.responseReceived',response);cdp.off('Network.loadingFailed',failed)
 }
 await context.close()
}
await browser.close()

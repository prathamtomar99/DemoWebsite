// Local-only audit harness. Uses an existing Playwright installation; adds no runtime dependency.
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/homebrew/lib/node_modules/@playwright/cli/node_modules/playwright')
const base = process.env.HERO_URL || 'http://127.0.0.1:4173/'
const label = process.env.HERO_LABEL || 'baseline'
const output = 'artifacts/hero-optimization'
mkdirSync(output,{recursive:true})
const browser = await chromium.launch({headless:true,channel:"chrome"})
const results=[]
for (const mobile of (process.env.HERO_DEVICE==='mobile'?[true]:process.env.HERO_DEVICE==='desktop'?[false]:[false,true])) {
  const context = await browser.newContext({viewport:mobile?{width:375,height:812}:{width:1440,height:900},deviceScaleFactor:mobile?2:1})
  await context.addInitScript(() => {
    const m=window.__audit={decode:[],draw:[],liveBytes:0,peakBytes:0,longTasks:[],firstCanvas:null,firstPosterPaint:null,lag:[],blank:0}
    new PerformanceObserver(list=>{for(const e of list.getEntries())if(e.identifier==='audit-hero-poster')m.firstPosterPaint??=e.renderTime||e.loadTime}).observe({type:'element',buffered:true})
    const posterObserver=new MutationObserver(()=>{const poster=document.querySelector('.hero-poster');if(poster){poster.setAttribute('elementtiming','audit-hero-poster');posterObserver.disconnect()}})
    posterObserver.observe(document,{subtree:true,childList:true})
    const decode=createImageBitmap.bind(window)
    window.createImageBitmap=async (...args)=>{
      const start=performance.now(),bitmap=await decode(...args)
      m.decode.push(performance.now()-start)
      const bytes=bitmap.width*bitmap.height*4;m.liveBytes+=bytes;m.peakBytes=Math.max(m.peakBytes,m.liveBytes)
      const close=bitmap.close.bind(bitmap);let closed=false
      bitmap.close=()=>{if(!closed){closed=true;m.liveBytes-=bytes}close()};return bitmap
    }
    const draw=CanvasRenderingContext2D.prototype.drawImage
    CanvasRenderingContext2D.prototype.drawImage=function(...args){const t=performance.now();const result=draw.apply(this,args);m.draw.push(performance.now()-t);m.firstCanvas??=performance.now();return result}
    new PerformanceObserver(list=>m.longTasks.push(...list.getEntries().map(e=>e.duration))).observe({type:'longtask',buffered:true})
  })
  const page=await context.newPage()
  const cdp=await context.newCDPSession(page)
  await cdp.send('Network.enable')
  for(const cache of ['cold','warm']) {
    if(cache==='cold')await cdp.send('Network.clearBrowserCache')
    const network={requests:0,frames:0,transferred:0,frameTransferred:0,frameBodyTransferred:0,failedFrames:0,cached:0};const frames=new Set()
    const request=e=>{network.requests++;if(/\/frames\/.*\.(jpg|webp)/.test(e.request.url)){network.frames++;frames.add(e.requestId)}}
    const finish=e=>{network.transferred+=e.encodedDataLength;if(frames.has(e.requestId))network.frameTransferred+=e.encodedDataLength}
    const data=e=>{if(frames.has(e.requestId))network.frameBodyTransferred+=e.encodedDataLength}
    const failed=e=>{if(frames.has(e.requestId))network.failedFrames++}
    const response=e=>{if(e.response.fromDiskCache)network.cached++}
    cdp.on('Network.requestWillBeSent',request);cdp.on('Network.loadingFinished',finish);cdp.on('Network.responseReceived',response);cdp.on('Network.dataReceived',data);cdp.on('Network.loadingFailed',failed)
    if(process.env.HERO_THROTTLE==='1'){
      await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:100,downloadThroughput:200000,uploadThroughput:100000})
      await cdp.send('Emulation.setCPUThrottlingRate',{rate:4})
    }
    await page.goto(base,{waitUntil:'domcontentloaded'})
    await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.ready==='true',{},{timeout:30000})
    await page.waitForTimeout(1600)
    const initial=await page.evaluate(()=>({firstCanvas:window.__audit.firstCanvas,posterPaint:window.__audit.firstPosterPaint,poster:performance.getEntriesByType('resource').find(e=>e.name.includes('hero-poster'))?.responseEnd,frameRequests:performance.getEntriesByType('resource').filter(e=>/\/frames\/.*\.(jpg|webp)/.test(e.name)).length}))
    // 12 seconds forward, six reverse, then distant jumps. Frame state sampled every rAF.
    if(process.env.HERO_STARTUP_ONLY!=='1') await page.evaluate(async()=>{
      const hero=document.querySelector('#home'),canvas=document.querySelector('canvas'),v=document.querySelector('.hero-viewport')
      const seek=p=>scrollTo(0,hero.offsetTop+(hero.offsetHeight-v.offsetHeight)*p)
      for(const [from,to,duration] of [[0,1,12000],[1,0,6000]]){
        const start=performance.now()
        await new Promise(resolve=>{const tick=()=>{const p=Math.min(1,(performance.now()-start)/duration);seek(from+(to-from)*p)
          const wanted=+canvas.dataset.wantedFrame,painted=+canvas.dataset.paintedFrame
          if(wanted&&painted)window.__audit.lag.push(Math.abs(wanted-painted));if(canvas.dataset.ready!=='true')window.__audit.blank++
          if(p<1)requestAnimationFrame(tick);else resolve()};requestAnimationFrame(tick)})
      }
      for(const p of [.8,.2,1,0]){seek(p);await new Promise(r=>setTimeout(r,300))}
    })
    await page.waitForTimeout(500)
    const metrics=await page.evaluate(()=>{
      const m=window.__audit,summary=a=>{const sorted=[...a].sort((a,b)=>a-b);return {n:a.length,median:sorted[Math.floor(a.length*.5)]??0,p95:sorted[Math.floor(a.length*.95)]??0,max:Math.max(0,...a)}}
      return {decodeMs:summary(m.decode),drawSubmissionMs:summary(m.draw),lagFrames:summary(m.lag),peakDecodedBytes:m.peakBytes,retainedDecodedBytes:m.liveBytes,longTasks:summary(m.longTasks),blankSamples:m.blank,canvas:{...document.querySelector('canvas').dataset},cache:{...document.querySelector('#home').dataset}}
    })
    results.push({label,base,mobile,cache,throttled:process.env.HERO_THROTTLE==='1',initial,network,metrics})
    writeFileSync(`${output}/${label}.json`,JSON.stringify(results,null,2))
    console.log(JSON.stringify(results.at(-1)))
    cdp.off('Network.requestWillBeSent',request);cdp.off('Network.loadingFinished',finish);cdp.off('Network.responseReceived',response);cdp.off('Network.dataReceived',data);cdp.off('Network.loadingFailed',failed)
  }
  await context.close()
}
await browser.close()

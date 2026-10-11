// Scope long-task observation strictly to a scrolling interval after preparation.
import {createRequire} from 'node:module'
import {writeFileSync} from 'node:fs'
const {chromium}=createRequire(import.meta.url)('/opt/homebrew/lib/node_modules/@playwright/cli/node_modules/playwright')
const browser=await chromium.launch({channel:'chrome',headless:true}),results=[]
for(const [label,url]of[['before','http://127.0.0.1:4183/'],['after','http://127.0.0.1:4173/']])for(const width of [1440,375]){
 const context=await browser.newContext({viewport:{width,height:width===375?812:900}}),page=await context.newPage()
 await page.goto(url);await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.ready==='true');await page.waitForTimeout(1700)
 const result=await page.evaluate(async()=>{
  const resources=performance.getEntriesByType('resource').filter(e=>/\/frames\/.*\.webp/.test(e.name)),downloadStart=Math.min(...resources.map(e=>e.startTime)),downloadEnd=Math.max(...resources.map(e=>e.responseEnd));
  const longTasks=[],observer=new PerformanceObserver(list=>longTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration}))))
  observer.observe({type:'longtask'})
  const start=performance.now(),h=document.querySelector('#home'),v=document.querySelector('.hero-viewport'),c=document.querySelector('canvas'),lags=[]
  for(const [from,to,duration]of[[0,1,5000],[1,0,3000]]){const t=performance.now();await new Promise(resolve=>{const tick=()=>{const p=Math.min(1,(performance.now()-t)/duration);scrollTo(0,h.offsetTop+(h.offsetHeight-v.offsetHeight)*(from+(to-from)*p));lags.push(Math.abs(+c.dataset.wantedFrame-+c.dataset.paintedFrame));if(p<1)requestAnimationFrame(tick);else resolve()};requestAnimationFrame(tick)})}
  await new Promise(r=>setTimeout(r,100));observer.disconnect();lags.sort((a,b)=>a-b)
  return {duration:performance.now()-start,startupDownloads:{count:resources.length,start:downloadStart,end:downloadEnd,span:downloadEnd-downloadStart,aggregateRequestMs:resources.reduce((s,e)=>s+e.duration,0)},longTasks,lagP95:lags[Math.floor(lags.length*.95)],frames:+c.dataset.frameCount,retained:+h.dataset.cacheSize}
 })
 results.push({label,width,...result});await context.close()
}
await browser.close();writeFileSync('artifacts/full-frame-preloader/scroll-stalls.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2))

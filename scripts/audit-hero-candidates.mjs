import {createRequire} from 'node:module'
import {readFileSync,writeFileSync} from 'node:fs'
const require=createRequire(import.meta.url)
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'/opt/homebrew/lib/node_modules/@playwright/cli/node_modules/playwright')
const browser=await chromium.launch({headless:true,channel:'chrome'})
const page=await browser.newPage()
await page.goto('http://127.0.0.1:4176/')
const result=[]
for(const id of ['original','desktop-a','desktop-b','desktop-c','mobile-a','mobile-b','mobile-c']){
 const manifest=JSON.parse(readFileSync(id==='original'?'artifacts/hero-optimization/original/frames/manifest.json':`artifacts/hero-optimization/candidates/${id}/manifest.json`))
 await page.goto(id==='original'?'http://127.0.0.1:4175/':'http://127.0.0.1:4176/')
 const decoded=await page.evaluate(async m=>{
  const times=[];let bytes=0
  // Sequential decode avoids contention and closes each bitmap immediately.
  for(let i=0;i<m.frameCount;i++){
   const blob=await(await fetch(m.filenamePattern.replace('%04d',String(i+1).padStart(4,'0')))).blob();bytes+=blob.size
   const t=performance.now(),bitmap=await createImageBitmap(blob);times.push(performance.now()-t)
   if(bitmap.width!==m.width||bitmap.height!==m.height)throw new Error('Dimensions mismatch');bitmap.close()
  }
  times.sort((a,b)=>a-b)
  return {requests:m.frameCount,bytes,medianDecodeMs:times[Math.floor(times.length*.5)],p95DecodeMs:times[Math.floor(times.length*.95)],totalDecodeMs:times.reduce((a,b)=>a+b,0)}
 },manifest)
 result.push({id,frameCount:manifest.frameCount,width:manifest.width,height:manifest.height,sequenceBytes:manifest.sequenceBytes,...decoded})
 console.log(result.at(-1))
}
writeFileSync('artifacts/hero-optimization/candidate-decodes.json',JSON.stringify(result,null,2))
await browser.close()

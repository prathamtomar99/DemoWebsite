import {createRequire} from 'node:module'
import {writeFileSync} from 'node:fs'
const pw=createRequire(import.meta.url)('/opt/homebrew/lib/node_modules/@playwright/cli/node_modules/playwright'),results=[]
for(const engine of ['chromium','firefox','webkit']){
 const browser=await pw[engine].launch({headless:true,...engine==='chromium'?{channel:'chrome'}:{}}),context=await browser.newContext({reducedMotion:'reduce'}),page=await context.newPage()
 await page.goto('https://demo-website-nine-tan.vercel.app/',{waitUntil:'load'})
 const result=await page.evaluate(async()=>{
  const manifest=await(await fetch('/frames/manifest.json')).json(),url=manifest.firstFrame+'?v='+manifest.assetVersion
  const first=await fetch(url,{cache:'force-cache'}),headers=Object.fromEntries(first.headers),blob=await first.blob()
  const second=await fetch(url,{cache:'force-cache'}),again=await second.blob()
  // This is the actual fetch/blob/createImageBitmap path used by the Canvas loader.
  const image=await createImageBitmap(again),size=[image.width,image.height];image.close()
  return {url,headers,bytes:blob.size,decodedSize:size,entries:performance.getEntriesByName(location.origin+url).map(e=>({duration:e.duration,transferSize:e.transferSize,encodedBodySize:e.encodedBodySize,deliveryType:e.deliveryType}))}
 })
 results.push({engine,...result});await browser.close()
}
writeFileSync('artifacts/cinematic-preloader/live-cache.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2))

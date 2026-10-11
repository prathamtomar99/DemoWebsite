// Local visual evidence only; no app dependency or runtime switch.
import {createRequire} from 'node:module'
import {mkdirSync,writeFileSync} from 'node:fs'
const require=createRequire(import.meta.url)
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'/opt/homebrew/lib/node_modules/@playwright/cli/node_modules/playwright')
const output='artifacts/hero-blending'
mkdirSync(output,{recursive:true})
const browser=await chromium.launch({headless:true,channel:'chrome'}),results=[]
for(const width of [1440,375])for(const [mode,port] of [['off',4180],['narrow',4173],['continuous',4181]]){
 const context=await browser.newContext({viewport:{width,height:width===1440?900:812},deviceScaleFactor:1})
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto(`http://127.0.0.1:${port}/`);await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.ready==='true')
 await page.waitForTimeout(1500)
 const n=await page.locator('canvas').evaluate(c=>+c.dataset.frameCount)
 for(const [stage,ratio] of [['entrance',.45],['interior',.67]])for(const fraction of [.4,.5,.6]){
  const position=Math.floor(n*ratio)+fraction
  await page.evaluate(pos=>{const h=document.querySelector('#home'),v=document.querySelector('.hero-viewport'),n=+document.querySelector('canvas').dataset.frameCount;scrollTo(0,h.offsetTop+pos/(n-1)*(h.offsetHeight-v.offsetHeight))},position)
  await page.waitForFunction(()=>{const c=document.querySelector('canvas'),h=document.querySelector('#home'),v=document.querySelector('.hero-viewport'),expected=Math.round((-h.getBoundingClientRect().top/(h.offsetHeight-v.offsetHeight))*(+c.dataset.frameCount-1))+1;return +c.dataset.paintedFrame===expected&&c.dataset.wantedFrame===c.dataset.paintedFrame&&(c.dataset.blendAvailable===undefined||c.dataset.blendAvailable==='true')})
  await page.waitForTimeout(120)
  const file=`${output}/${mode}-${width}-${stage}-${fraction}.png`
  await page.screenshot({path:file})
  results.push({mode,width,stage,position,file,state:await page.locator('canvas').evaluate(c=>({...c.dataset}))})
 }
 if(errors.length)throw Error(errors.join('\n'))
 await context.close()
}
writeFileSync(`${output}/visuals.json`,JSON.stringify(results,null,2));await browser.close()

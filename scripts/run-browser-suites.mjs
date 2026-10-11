// Execute the existing playwright-cli function files with installed Playwright browsers.
import {createRequire} from 'node:module'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
const require=createRequire(import.meta.url)
const pw=require(process.env.PLAYWRIGHT_PATH||'/opt/homebrew/lib/node_modules/@playwright/cli/node_modules/playwright')
const engine=process.env.BROWSER||'chromium'
const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{channel:'chrome'}:{})})
const names=process.argv.slice(2)
const results=[]
mkdirSync('artifacts/hero-optimization',{recursive:true})
for(const name of names){
 const context=await browser.newContext(name==='hero-touch'?{...pw.devices['iPhone 13'],defaultBrowserType:undefined}:{viewport:{width:1440,height:900}})
 const page=await context.newPage();page.setDefaultTimeout(15000)
 // oxlint-disable-next-line no-eval -- Executes trusted repository-owned browser test functions, never user input.
 try {const fn=eval(`(${readFileSync(`tests/${name}.js`,'utf8').replaceAll('http://127.0.0.1:5173/', process.env.SUITE_URL || 'http://127.0.0.1:5173/')})`);const result=await fn(page);results.push({name,pass:true,result});console.log(`${name}: PASS`)}
 catch(error){results.push({name,pass:false,error:String(error),stack:error.stack});console.error(`${name}: FAIL ${error}`)}
 await context.close()
 writeFileSync(`artifacts/hero-optimization/${process.env.SUITE_REPORT || `suites-${engine}`}.json`,JSON.stringify(results,null,2))
}
await browser.close()
if(results.some(r=>!r.pass))process.exitCode=1

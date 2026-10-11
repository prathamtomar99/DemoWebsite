// oxlint-disable-next-line no-unused-expressions -- playwright-cli function expression.
async page => {
 const check=(v,m)=>{if(!v)throw new Error(m)}
 const results=[]
 for(const [width,count,profile] of [[1440,72,'desktop'],[375,60,'mobile']]){
  const context=await page.context().browser().newContext({viewport:{width,height:812}})
  const tab=await context.newPage(),requests=[]
  tab.on('request',r=>{if(/\/frames\/.*\.webp/.test(r.url()))requests.push(r.url())})
  await tab.goto('http://127.0.0.1:4173/')
  await tab.waitForFunction(()=>document.querySelector('canvas').dataset.ready==='true')
  check(await tab.locator('canvas').getAttribute('data-frame-count')===String(count),'Incorrect initial profile')
  check(await tab.locator('#home').getAttribute('data-cache-capacity')===String(count),'Incorrect full retained cache')
  for(const p of [0,.5,1,.1,.9,0]){
   await tab.evaluate(p=>scrollTo(0,(document.querySelector('#home').offsetHeight-document.querySelector('.hero-viewport').offsetHeight)*p),p)
   await tab.waitForFunction(n=>+document.querySelector('canvas').dataset.paintedFrame===n,Math.round(p*(count-1))+1)
  }
  await tab.setViewportSize({width:width===375?1440:375,height:900})
  await tab.waitForTimeout(200)
  check(await tab.locator('canvas').getAttribute('data-frame-count')===String(count),'Resize switched profile')
  check(requests.every(url=>url.includes(`/v2/${profile}/`)),'Fetched another profile')
  check(await tab.locator('canvas').getAttribute('data-ready')==='true','Resize blanked Canvas')
  results.push({width,profile,count,requests:requests.length,resizeStable:true})
  await context.close()
 }
 return results
}

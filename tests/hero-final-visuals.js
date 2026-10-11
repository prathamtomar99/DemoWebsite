// oxlint-disable-next-line no-unused-expressions -- playwright-cli function expression.
async page => {
 const results=[]
 for(const [width,height] of [[1440,900],[768,1024],[375,812]]){
  await page.setViewportSize({width,height});await page.goto('http://127.0.0.1:4173/')
  await page.waitForTimeout(1700)
  for(const p of [0,.25,.65,.95,1]){
   await page.evaluate(p=>{document.activeElement?.blur();scrollTo(0,(document.querySelector('#home').offsetHeight-document.querySelector('.hero-viewport').offsetHeight)*p)},p)
   await page.waitForFunction(p=>document.querySelector('canvas').dataset.ready==='true'&&+document.querySelector('canvas').dataset.paintedFrame===Math.round(p*(+document.querySelector('canvas').dataset.frameCount-1))+1,p)
   await page.screenshot({path:`artifacts/hero-optimization/final-${width}-${Math.round(p*100)}.png`})
  }
  await page.getByRole('link',{name:'Explore Our Collection',exact:true}).click()
  await page.waitForFunction(()=>document.querySelector('#properties').getBoundingClientRect().top<100 && +getComputedStyle(document.querySelector('.section-introduction')).opacity>.99)
  await page.locator('.property-card img').first().evaluate(img=>img.decode())
  await page.screenshot({path:`artifacts/hero-optimization/properties-${width}.png`,animations:'disabled'})
  results.push({width,height,stages:true,cta:true})
 }
 return results
}

// oxlint-disable-next-line no-unused-expressions -- playwright-cli function expression.
async page => {
 const check=(v,m)=>{if(!v)throw new Error(m)}
 await page.setViewportSize({width:375,height:812})
 const cdp=await page.context().newCDPSession(page)
 await cdp.send('Network.enable')
 await cdp.send('Network.clearBrowserCache')
 await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:100,downloadThroughput:200000,uploadThroughput:100000})
 await cdp.send('Emulation.setCPUThrottlingRate',{rate:4})
 await page.goto('http://127.0.0.1:4173/')
 await page.waitForFunction(()=>document.querySelector('canvas').dataset.ready==='true',null,{timeout:60000})
 const seek=p=>page.evaluate(p=>scrollTo(0,(document.querySelector('#home').offsetHeight-document.querySelector('.hero-viewport').offsetHeight)*p),p)
 const samples=[]
 for(let cycle=0;cycle<3;cycle++){
  for(const p of [0,.25,.65,.95,1,.65,.25,0]){
   await seek(p)
   await page.waitForFunction(p=>+document.querySelector('canvas').dataset.paintedFrame===Math.round(p*59)+1,p,{timeout:15000})
   const state=await page.locator('canvas').evaluate(n=>({...n.dataset}))
   check(state.ready==='true','Blank slow-network Canvas')
   check(await page.locator('#home').evaluate(n=>+n.dataset.cacheSize===60&&+n.dataset.inflight<=2),'Resource budget exceeded')
   samples.push({cycle,p,frame:state.paintedFrame})
  }
 }
 await cdp.detach()
 return {network:'1.6 Mbps / 100ms latency',cpu:4,cycles:3,samples,finalFrameReached:true,reverse:true}
}

// oxlint-disable-next-line no-unused-expressions -- trusted Playwright function.
async page=>{
 const check=(v,m)=>{if(!v)throw Error(m)};
 await page.clock.install();
 await page.route('**/frames/manifest.json',()=>{});
 await page.goto('http://127.0.0.1:5173/',{waitUntil:'domcontentloaded'});
 await page.waitForSelector('[data-preparation="loading"]');
 await page.clock.fastForward(3000);
 check(await page.locator('#home').getAttribute('data-preparing')==='true','Old early timeout still revealed an incomplete sequence');
 await page.clock.fastForward(43000);
 await page.waitForFunction(()=>document.querySelector('#home').dataset.static==='true');
 check(await page.locator('#home').getAttribute('data-preparation-failure')==='safety-timeout','Safety timeout reason missing');
 check(await page.locator('#home').getAttribute('data-preparing')==='false','Loader remained after deadline');
 await page.clock.runFor(100);
 check(await page.locator('h1').evaluate(n=>getComputedStyle(n).opacity==='1'),'Timeout stranded opening copy');
 await page.unrouteAll({behavior:'ignoreErrors'});
 return {deadlineMs:45000,partialReveal:false,posterFallback:true};
}

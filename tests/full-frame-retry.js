// oxlint-disable-next-line no-unused-expressions -- trusted Playwright function.
async page=>{
 let attempts=0;
 await page.route('**/frames/**/frame_0005.webp*',r=>++attempts===1?r.abort():r.continue());
 await page.goto('http://127.0.0.1:5173/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('#home')?.dataset.preparing==='false',null,{timeout:60000});
 const state=await page.locator('#home').evaluate(n=>({...n.dataset}));
 if(attempts!==2||state.static!=='false'||state.decodedReady!=='72'||state.cacheSize!=='72')throw Error('Transient failure did not recover into a complete retained sequence');
 await page.unrouteAll({behavior:'wait'});
 return {attempts,completeRetainedSequence:true,state};
}

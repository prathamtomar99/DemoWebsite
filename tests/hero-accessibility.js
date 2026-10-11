// oxlint-disable-next-line no-unused-expressions -- playwright-cli evaluates this file as a function expression.
async page => {
  const check = (test,message) => {if(!test) throw new Error(message);};
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.setViewportSize({width:1440,height:900});
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('.hero-skip').waitFor({state:'visible'});
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const focused=await page.evaluate(()=>({text:document.activeElement.textContent,outline:getComputedStyle(document.activeElement).outlineStyle}));
  check(focused.text.includes('Skip the film') && focused.outline!=='none',`Skip link not keyboard reachable/visible: ${JSON.stringify(focused)}`);
  await page.keyboard.press('Enter');
  const skip=await page.evaluate(()=>({focus:document.activeElement.id,y:scrollY,headingCount:document.querySelectorAll('h1').length}));
  check(skip.focus==='after-hero' && skip.y>0 && skip.headingCount===1,'Keyboard skip/focus/headings failed');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await page.waitForFunction(()=>scrollY===0);
  const layouts=[];
  for(const [width,height] of [[320,568],[720,450],[1440,720]]) {
    await page.setViewportSize({width,height});
    await page.waitForTimeout(100);
    layouts.push(await page.evaluate(()=>{
      const h=document.querySelector('h1').getBoundingClientRect();
      const a=document.querySelector('.hero-skip').getBoundingClientRect();
      return {width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,headingFits:h.left>=0&&h.right<=innerWidth&&h.top>=0&&h.bottom<=innerHeight,skipFits:a.top>=0&&a.bottom<=innerHeight};
    }));
  }
  check(layouts.every(x=>!x.overflow && x.headingFits && x.skipFits),'Compact/zoom-equivalent layout clipped');
  const dataPage=await page.context().newPage();
  await dataPage.addInitScript(()=>{
    if(navigator.connection) Object.defineProperty(navigator.connection,'saveData',{value:true});
    else Object.defineProperty(navigator,'connection',{value:Object.assign(new EventTarget(),{saveData:true})});
  });
  const requests=[];
  dataPage.on('request',r=>{if(r.url().includes('/frames/'))requests.push(r.url());});
  await dataPage.goto('http://127.0.0.1:5173/');
  await dataPage.waitForTimeout(200);
  check(await dataPage.locator('#home').getAttribute('data-static')==='true' && requests.length===0,'Save-Data fetched sequence');
  await dataPage.close();
  const broken=await page.context().newPage();
  await broken.route('**/frames/**',r=>r.fulfill({status:404,body:'unavailable'}));
  await broken.route('**/media/hero-poster.webp',r=>r.fulfill({status:404,body:'unavailable'}));
  await broken.goto('http://127.0.0.1:5173/');
  await broken.waitForFunction(()=>document.querySelector('#home').dataset.static==='true');
  check(await broken.locator('h1').isVisible(),'Total media failure hid content');
  await broken.getByRole('link',{name:'Continue',exact:true}).click();
  check(await broken.evaluate(()=>document.activeElement.id)==='after-hero','Total media failure blocked navigation');
  await broken.close();
  return {focused,skip,layouts,saveDataRequests:requests.length,totalMediaFailure:true};
}

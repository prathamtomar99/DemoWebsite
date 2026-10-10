// oxlint-disable-next-line no-unused-expressions -- playwright-cli evaluates this file as a function expression.
async page => {
  const check=(v,m)=>{if(!v)throw new Error(m)};
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.setViewportSize({width:1440,height:900});
  await page.goto('http://127.0.0.1:5173/');
  // Scroll away before the entrance finishes, then return without remounting.
  await page.evaluate(()=>scrollTo(0,2520));
  await page.waitForTimeout(1700);
  await page.evaluate(()=>scrollTo(0,0));
  await page.waitForTimeout(100);
  check(await page.locator('h1').evaluate(n=>getComputedStyle(n).opacity==='1'),'Interrupted entrance did not recover');
  await page.locator('.hero-topline nav a:last-child').focus();
  await page.keyboard.press('Tab');
  check(await page.evaluate(()=>document.activeElement.textContent.includes('Explore Properties')),'Intro keyboard target');
  await page.locator('.hero-topline nav a:last-child').focus();
  await page.evaluate(()=>scrollTo(0,2520));
  await page.waitForTimeout(100);
  await page.keyboard.press('Tab');
  check(await page.evaluate(()=>!document.activeElement.closest('[data-story]')),'Keyboard reached hidden CTA');
  await page.getByRole('link',{name:'Back to the residence'}).click();
  await page.evaluate(()=>scrollTo(0,3600));
  await page.waitForTimeout(150);
  await page.getByRole('link',{name:'Explore Our Collection',exact:true}).focus();
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForTimeout(150);
  const live=await page.evaluate(()=>({focus:document.activeElement.textContent,opacity:getComputedStyle(document.activeElement).opacity,static:document.querySelector('#home').dataset.static}));
  check(live.static==='true'&&live.focus.includes('Continue')&&live.opacity==='1','Live preference stranded finale focus');
  await page.emulateMedia({reducedMotion:'no-preference'});
  const layouts=[];
  for(const [width,height] of [[320,568],[390,664],[720,450],[1440,720]]){
    await page.setViewportSize({width,height});await page.goto('http://127.0.0.1:5173/');await page.waitForTimeout(1700);
    for(const p of [0,.25,.65,.95]){
      await page.evaluate(p=>scrollTo(0,innerHeight*4*p),p);await page.waitForTimeout(100);
      const result=await page.locator('[data-active="true"]').evaluateAll(ns=>ns.every(n=>[...n.querySelectorAll('h1,h2,p,a')].every(c=>{const r=c.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth})));
      check(result,`Compact clipping ${width}x${height} ${p}`);
    }
    layouts.push({width,height});
  }
  return {interruptedEntrance:true,keyboardTabOrder:true,livePreferenceFocus:live,layouts};
}

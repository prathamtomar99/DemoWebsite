// oxlint-disable-next-line no-unused-expressions -- playwright-cli evaluates this file as a function expression.
async page => {
  const check=(condition,message)=>{if(!condition)throw new Error(message)};
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(['warning','error'].includes(m.type()))errors.push(m.text())});
  await page.emulateMedia({reducedMotion:'no-preference'});
  const state=()=>page.locator('[data-story]').evaluateAll(ns=>ns.map(n=>({id:n.dataset.story,opacity:Number(getComputedStyle(n).opacity),hidden:n.getAttribute('aria-hidden'),inert:n.inert,tab:n.querySelector('a')?.tabIndex,visible:n.dataset.active})));
  const seek=async p=>{
    await page.evaluate(p=>scrollTo(0,(document.querySelector('#home').offsetHeight-document.querySelector('.hero-viewport').offsetHeight)*p),p);
    await page.waitForFunction(p=>Number(document.querySelector('canvas').dataset.paintedFrame)===Math.round(p*(Number(document.querySelector('canvas').dataset.frameCount)-1))+1,p);
    await page.waitForTimeout(70);
    return state();
  };
  const screenshots=[];
  for(const [width,height] of [[1440,900],[768,1024],[375,812]]){
    await page.setViewportSize({width,height});
    await page.goto('http://127.0.0.1:5173/');
    const initial=await page.locator('h1').evaluate(n=>Number(getComputedStyle(n).opacity));
    await page.waitForTimeout(1750);
    check(await page.locator('h1').evaluate(n=>Number(getComputedStyle(n).opacity))===1,'Intro stuck invisible');
    const samples=[];
    for(const [p,id] of [[0,'intro'],[.25,'right'],[.65,'left'],[.95,'finale']]){
      const stages=await seek(p);
      check(stages.filter(s=>s.opacity>.001).length===1 && stages.find(s=>s.id===id).opacity>.9,`Stage mismatch ${width} ${p}`);
      check(stages.filter(s=>s.opacity===0).every(s=>s.inert && s.hidden==='true' && (s.tab===undefined||s.tab===-1)),'Hidden controls reachable');
      const fits=await page.locator(`[data-story="${id}"]`).evaluate(n=>{
        const children=[...n.querySelectorAll('h1,h2,p,a')];
        return children.every(c=>{const r=c.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth});
      });
      check(fits,`Text clipping at ${width} ${p}`);
      check(await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth),'Horizontal overflow');
      const path=`artifacts/story-${width}-${Math.round(p*100)}.png`;
      await page.screenshot({path});screenshots.push(path);samples.push({p,stages});
    }
    check((await seek(1)).find(s=>s.id==='finale').opacity===1,'Finale faded before release');
    for(const p of [.87,.5,.14])check((await seek(p)).every(s=>s.opacity<.001),`Stage gap overlap ${p}`);
    for(const [p,id] of [[.7,'left'],[.25,'right'],[0,'intro']])check((await seek(p)).find(s=>s.id===id).opacity===1,`Reverse/jump ${p}`);
    check(await page.locator('h1').evaluate(n=>Number(getComputedStyle(n).opacity))===1,'Return intro invisible');
    if(width===1440){
      const intro=page.locator('.story-intro').getByRole('link',{name:'Explore Properties',exact:true});
      await intro.focus();
      check((await seek(.65)).find(s=>s.id==='intro').opacity===1,'Focused CTA disappeared');
      check(await intro.evaluate(n=>n===document.activeElement),'Focus stranded');
      await page.locator('.hero-skip').focus();
      await page.waitForTimeout(70);
      check((await state()).find(s=>s.id==='left').opacity===1,'Timeline did not reconcile after blur');
    }
    await seek(0); await page.locator('.story-intro').getByRole('link',{name:'Explore Properties',exact:true}).click();
    check(await page.evaluate(()=>document.activeElement.id)==='properties','Intro CTA destination');
    await page.getByRole('link',{name:'Back to the residence'}).click();
    await seek(1); await page.getByRole('link',{name:'Explore Our Collection',exact:true}).click();
    check(await page.evaluate(()=>document.activeElement.id)==='properties','Final CTA destination');
    screenshots.push({width,initial,samples});
  }
  // A stalled manifest cannot freeze text progress or delay the entrance.
  await page.setViewportSize({width:1440,height:900});
  await page.route('**/frames/**/manifest.json',async r=>{await new Promise(resolve=>setTimeout(resolve,2500));await r.continue()});
  await page.goto('http://127.0.0.1:5173/');
  await page.waitForTimeout(1700);
  check(await page.locator('h1').evaluate(n=>getComputedStyle(n).opacity==='1'),'Loading blocked intro');
  await page.evaluate(()=>{const h=document.querySelector('#home'),v=document.querySelector('.hero-viewport');scrollTo(0,h.offsetTop+(h.offsetHeight-v.offsetHeight)*.7)});await page.waitForTimeout(100);
  check((await state()).find(s=>s.id==='left').opacity===1,'Loading blocked story progress');
  await page.unrouteAll({behavior:'wait'});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('http://127.0.0.1:5173/');
  check(await page.locator('h1').evaluate(n=>getComputedStyle(n).opacity==='1'&&getComputedStyle(n).transform==='none'),'Static intro animated');
  await page.locator('.story-intro').getByRole('link',{name:'Explore Properties',exact:true}).click();
  check(await page.evaluate(()=>document.activeElement.id)==='properties','Static CTA broken');
  check(errors.length===0,errors.join('\n'));
  return {screenshots,focusRetention:true,ctaDestinations:true,slowManifest:true,staticIntro:true,errors};
}

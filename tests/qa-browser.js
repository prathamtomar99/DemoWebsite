// oxlint-disable-next-line no-unused-expressions -- playwright-cli evaluates this file as a function expression.
async page => {
 const check=(v,m)=>{if(!v)throw new Error(m)};
 const base='http://127.0.0.1:4173';
 const engine=page.context().browser().browserType().name();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.setViewportSize({width:1440,height:900});await page.goto(base);await page.waitForTimeout(1800);
 const seek=async p=>{
  await page.evaluate(p=>{document.activeElement?.blur();scrollTo(0,(document.querySelector('#home').offsetHeight-document.querySelector('.hero-viewport').offsetHeight)*p)},p);
  await page.waitForFunction(p=>Number(document.querySelector('canvas').dataset.paintedFrame)===Math.round(p*(Number(document.querySelector('canvas').dataset.frameCount)-1))+1,p);
  check(await page.locator('canvas').getAttribute('data-ready')==='true','Blank canvas');
  check(await page.locator('#home').evaluate(n=>+n.dataset.cacheSize<=+n.dataset.cacheCapacity),'Cache overflow');
 };
 const frames=[];
 for(const p of [0,.25,.65,.95,1,.65,.25,0]){await seek(p);frames.push({p,frame:await page.locator('canvas').getAttribute('data-painted-frame')});if(engine==='chromium')await page.screenshot({path:`artifacts/qa-hero-${Math.round(p*100)}.png`})}
 await seek(.65);await page.reload();await page.waitForTimeout(1800);
 check(await page.evaluate(()=>{const s=document.querySelector('#home'),v=document.querySelector('.hero-viewport');const p=Math.min(1,Math.max(0,-s.getBoundingClientRect().top/(s.offsetHeight-v.offsetHeight)));return +document.querySelector('canvas').dataset.paintedFrame===Math.round(p*(Number(document.querySelector('canvas').dataset.frameCount)-1))+1}),'Refresh desynchronization');
 await page.goto(base+'/?qa-deep#properties');await page.waitForTimeout(700);
 check(await page.locator('#properties').evaluate(n=>n.getBoundingClientRect().top<innerHeight),'Cold fragment navigation');
 await page.goto(base+'/?qa-history');await page.goBack();await page.waitForTimeout(700);
 check(await page.evaluate(()=>location.hash==='#properties'&&document.querySelector('#properties').getBoundingClientRect().top<innerHeight),'Back navigation');
 await page.goto(base);await seek(1);await page.evaluate(()=>scrollBy(0,450));await page.waitForTimeout(100);
 check(await page.locator('.hero-viewport').evaluate(n=>n.getBoundingClientRect().top<0),'Sticky release');await seek(.25);
 const layouts=[];
 for(const [width,height] of [[1920,1080],[1440,900],[1024,768],[768,1024],[390,844],[375,812],[320,568],[844,390]]){
  await page.setViewportSize({width,height});await seek(.65);
  check(await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth),`Overflow ${width}`);
  for(const id of ['properties','about','approach','contact']){await page.locator('#'+id).scrollIntoViewIfNeeded();await page.waitForTimeout(500)}
  await page.locator('#properties').scrollIntoViewIfNeeded();
  await page.getByRole('button',{name:'Explore Residence: The Woodland Residence'}).click();
  check(await page.getByRole('dialog').isVisible(),'Dialog missing');
  check(await page.locator('dialog').evaluate(n=>n.scrollWidth===n.clientWidth),`Dialog overflow ${width}`);
  await page.getByRole('button',{name:'Request a Viewing',exact:true}).click();
  check(await page.getByLabel('Property of interest').inputValue()==='woodland','Wrong selection');
  await page.getByRole('button',{name:'Complete demo request'}).click();
  check(await page.getByLabel('Full name',{exact:true}).evaluate(n=>n===document.activeElement),'Invalid focus');
  for(let i=0;i<12;i++){await page.keyboard.press('Tab');check(await page.evaluate(()=>Boolean(document.activeElement.closest('dialog'))),'Focus escaped')}
  await page.keyboard.press('Escape');await page.waitForTimeout(100);
  check(await page.getByRole('button',{name:'Explore Residence: The Woodland Residence'}).evaluate(n=>n===document.activeElement),'Focus restore');
  check(await page.evaluate(()=>document.documentElement.style.overflow)==='','Scroll lock retained');
  if(engine==='chromium'){
   await page.screenshot({path:`artifacts/qa-layout-${width}.png`,animations:'disabled'});
   if([1440,375].includes(width)){
    await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(500);
    await page.screenshot({path:`artifacts/qa-full-${width}.png`,fullPage:true,animations:'disabled'});
   }
  }
  layouts.push({width,height,overflow:false,dialog:true});
 }
 await page.setViewportSize({width:375,height:812});await page.goto(base);await page.locator('.hero-topline .menu-toggle').click();
 await page.getByRole('dialog').getByRole('link',{name:'About',exact:true}).click();await page.waitForTimeout(100);
 check(await page.evaluate(()=>document.activeElement.id)==='about','Menu target focus');
 for(const mode of ['reduced','save-data']){
  const context=await page.context().browser().newContext({reducedMotion:mode==='reduced'?'reduce':'no-preference'});
  if(mode==='save-data')await context.addInitScript(()=>Object.defineProperty(navigator,'connection',{configurable:true,value:{saveData:true,addEventListener(){},removeEventListener(){}}}));
  const tab=await context.newPage();let sequence=0;tab.on('request',r=>{if(r.url().includes('/frames/'))sequence++});
  await tab.goto(base);await tab.waitForTimeout(600);
  check(await tab.locator('#home').getAttribute('data-static')==='true',`${mode} not static`);check(sequence===0,`${mode} requested frames`);await context.close();
 }
 check(errors.length===0,errors.join('\n'));
 return {engine,frames,refresh:true,history:true,release:true,layouts,menu:true,reducedMotion:true,saveData:true,errors};
}

// oxlint-disable-next-line no-unused-expressions -- playwright-cli evaluates this file as a function expression.
async page => {
 const check=(v,m)=>{if(!v)throw new Error(m)};
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(['error','warning'].includes(m.type()))errors.push(m.text())});
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.setViewportSize({width:1440,height:1000});await page.goto('http://127.0.0.1:5173/');await page.reload();await page.waitForTimeout(1800);
 await page.getByRole('link',{name:'Explore Properties',exact:true}).first().click();
 check(await page.evaluate(()=>document.activeElement.id)==='properties','Hero target/focus');
 check(await page.locator('.property-card').count()===3,'Card count');
 await page.waitForTimeout(550);await page.screenshot({animations:'disabled',path:'artifacts/website-properties.png'});
 const titles=['The Woodland Residence','The Horizon House','The Courtyard Estate'];
 for(const title of titles){
  const trigger=page.getByRole('button',{name:`Explore Residence: ${title}`});await trigger.click();
  await page.getByRole('dialog').waitFor();check(await page.getByRole('dialog').getByRole('heading',{name:title}).count()===1,'Wrong property');
  check(await page.locator('dialog img').evaluate(n=>n.complete&&n.naturalWidth>0),'Missing dialog image');
  if(title===titles[0])await page.screenshot({animations:'disabled',path:'artifacts/website-property-dialog.png'});
  await page.keyboard.press('Escape');await page.waitForTimeout(80);check(await trigger.evaluate(n=>n===document.activeElement),'Focus not restored');
 }
 await page.getByRole('button',{name:`Explore Residence: ${titles[1]}`}).click();await page.getByRole('button',{name:'Request a Viewing',exact:true}).click();
 check(await page.locator('dialog[open]').count()===1,'Stacked dialogs');
 check(await page.getByLabel('Property of interest').inputValue()==='horizon','Preselection lost');
 const before=await page.evaluate(()=>({local:JSON.stringify(localStorage),session:JSON.stringify(sessionStorage),cookie:document.cookie}));
 const requests=[];page.on('request',r=>{if(r.method()!=='GET'||!r.url().startsWith('http://127.0.0.1:5173/'))requests.push({method:r.method(),url:r.url()})});
 await page.getByRole('button',{name:'Complete demo request'}).click();
 check(await page.locator('#viewing-name').evaluate(n=>n===document.activeElement),'Invalid focus');
 check(await page.locator('[aria-invalid="true"]').count()===3,'Required validation');
 await page.getByLabel('Full name',{exact:true}).fill('Test Visitor');await page.getByLabel('Email',{exact:true}).fill('invalid');await page.getByLabel('Preferred viewing date').fill('2099-01-01');
 await page.getByRole('button',{name:'Complete demo request'}).click();check(await page.getByText('Please enter a valid email address.').isVisible(),'Email validation');
 await page.getByLabel('Email',{exact:true}).fill('visitor@example.com');await page.screenshot({animations:'disabled',path:'artifacts/website-viewing-form.png'});
 await page.getByRole('button',{name:'Complete demo request'}).click();
 check(await page.getByText('Demo complete. No viewing request has been sent.').isVisible(),'Success missing');
 check(await page.locator('dialog input').count()===0,'Values retained after success');
 await page.getByRole('button',{name:'Return to exploring'}).click();await page.waitForTimeout(80);
 check(await page.getByRole('button',{name:`Explore Residence: ${titles[1]}`}).evaluate(n=>n===document.activeElement),'Flow restore');
 const after=await page.evaluate(()=>({local:JSON.stringify(localStorage),session:JSON.stringify(sessionStorage),cookie:document.cookie,overflow:document.documentElement.style.overflow}));
 check(before.local===after.local&&before.session===after.session&&before.cookie===after.cookie,'Persistent form data');check(requests.length===0,'Unexpected external/submission request');check(after.overflow==='','Scroll lock leaked');
 for(const [label,id] of [['About','about'],['Contact','contact'],['Properties','properties'],['Home','home']]){
  await page.locator('.content-header').getByRole('link',{name:label,exact:true}).click();check(await page.evaluate(id=>document.activeElement.id===id,id),`Navigation ${label}`);
 }
 for(const [id,path] of [['about','agency'],['contact','closing']]){await page.locator(`#${id}`).scrollIntoViewIfNeeded();await page.waitForTimeout(550);await page.screenshot({animations:'disabled',path:`artifacts/website-${path}.png`})}
 // Trigger once-only reveals for the full document capture without changing hero geometry.
 for(const id of ['properties','about','approach','contact']){await page.locator(`#${id}`).scrollIntoViewIfNeeded();await page.waitForTimeout(550)}
 await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(550);
 await page.screenshot({animations:'disabled',path:'artifacts/website-desktop-full.png',fullPage:true});
 const contentBox=await page.locator('#after-hero').evaluate(n=>({x:0,y:n.offsetTop,width:n.offsetWidth,height:n.offsetHeight}));
 await page.evaluate(y=>scrollTo(0,y),contentBox.y);await page.waitForTimeout(150);
 await page.screenshot({animations:'disabled',path:'artifacts/website-content-desktop.png',fullPage:true,clip:contentBox});
 const layouts=[];
 for(const [width,height] of [[768,1024],[375,812],[320,568],[812,375]]){
  await page.setViewportSize({width,height});await page.goto('http://127.0.0.1:5173/#properties');await page.waitForTimeout(550);
  check(await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth),`Overflow ${width}`);
  await page.screenshot({animations:'disabled',path:`artifacts/website-${width}-collection.png`});
  await page.getByRole('button',{name:`Explore Residence: ${titles[0]}`}).click();
  await page.getByRole('button',{name:'Request a Viewing',exact:true}).click();
  check(await page.locator('dialog').evaluate(n=>n.scrollWidth===n.clientWidth),`Dialog overflow ${width}`);
  await page.getByLabel('Full name',{exact:true}).fill('Discard me');await page.getByRole('button',{name:'Close dialog'}).click();
  await page.locator('#contact').scrollIntoViewIfNeeded();await page.getByRole('button',{name:'Request a Private Viewing'}).click();
  check(await page.getByLabel('Full name',{exact:true}).inputValue()==='','Values not cleared on close');
  if(width===375)await page.screenshot({animations:'disabled',path:'artifacts/website-mobile-form.png'});
  await page.keyboard.press('Escape');
  if(width<768){
    await page.goto('http://127.0.0.1:5173/');await page.locator('.hero-topline').getByRole('button',{name:'Open navigation menu'}).click();
    check(await page.getByRole('dialog').isVisible(),'Mobile menu missing');
    if(width===375)await page.screenshot({animations:'disabled',path:'artifacts/website-mobile-navigation.png'});
    await page.keyboard.press('Escape');await page.waitForTimeout(80);check(await page.locator('.hero-topline .menu-toggle').evaluate(n=>n===document.activeElement),'Menu focus restore');
    await page.locator('.hero-topline .menu-toggle').click();await page.getByRole('dialog').getByRole('link',{name:'About',exact:true}).click();await page.waitForTimeout(80);
    check(await page.evaluate(()=>document.activeElement.id)==='about','Menu navigation focus');
    check(await page.evaluate(()=>document.documentElement.style.overflow)==='','Menu scroll lock leaked');
  }
  layouts.push({width,height});
 }
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('http://127.0.0.1:5173/#properties');
 check(await page.locator('.section-introduction').evaluate(n=>getComputedStyle(n).opacity==='1'),'Reduced motion content hidden');
 check(errors.length===0,errors.join('\n'));
 return {cards:3,dialogs:true,preselection:true,validation:true,localSuccess:true,submissionRequests:requests,storageUnchanged:true,navigation:true,layouts,reducedMotion:true,errors};
}

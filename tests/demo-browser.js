// oxlint-disable-next-line no-unused-expressions -- playwright-cli evaluates this file as a function expression.
async page => {
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const screenshots=[];
 for(const [width,height] of [[1440,900],[768,1024],[375,812]]){
  await page.setViewportSize({width,height});await page.goto('http://127.0.0.1:4173/');await page.reload();await page.waitForTimeout(1800);
  for(const p of [0,.25,.65,.95]){
   await page.evaluate(p=>scrollTo(0,(document.querySelector('#home').offsetHeight-innerHeight)*p),p);
   await page.waitForFunction(p=>+document.querySelector('canvas').dataset.paintedFrame===Math.round(p*239)+1,p);
   const path=`artifacts/batch7/${width}-hero-${Math.round(p*100)}.png`;await page.screenshot({path});screenshots.push(path);
  }
  for(const id of ['properties','about','approach','contact']){
   await page.evaluate(id=>document.getElementById(id).scrollIntoView({block:'start'}),id);await page.waitForTimeout(700);
   const path=`artifacts/batch7/${width}-${id}.png`;await page.screenshot({path,animations:'disabled'});screenshots.push(path);
  }
  await page.locator('footer').scrollIntoViewIfNeeded();await page.screenshot({path:`artifacts/batch7/${width}-footer.png`,animations:'disabled'});
  await page.getByRole('button',{name:'Explore Residence: The Horizon House'}).click();await page.screenshot({path:`artifacts/batch7/${width}-details.png`,animations:'disabled'});
  await page.getByRole('button',{name:'Request a Viewing',exact:true}).click();
  if(await page.getByLabel('Property of interest').inputValue()!=='horizon')throw new Error('Preselection lost');
  await page.screenshot({path:`artifacts/batch7/${width}-form.png`,animations:'disabled'});await page.keyboard.press('Escape');
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw new Error('Overflow');
  await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(700);
  if(width!==768)await page.screenshot({path:`artifacts/batch7/${width}-full.png`,fullPage:true,animations:'disabled'});
 }
 if(errors.length)throw new Error(errors.join('\n'));
 return {screenshots,errors};
}

// oxlint-disable-next-line no-unused-expressions -- playwright-cli evaluates this file as a function expression.
async page => {
  const check = (test,message) => {if(!test) throw new Error(message);};
  await page.goto('http://127.0.0.1:5173/');
  await page.waitForFunction(()=>document.querySelector('canvas').dataset.paintedFrame==='1');
  const device = await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio,canvasWidth:document.querySelector('canvas').width,capacity:document.querySelector('#home').dataset.cacheCapacity,touch:navigator.maxTouchPoints}));
  check(device.touch>0 && device.canvasWidth<=device.width*2,'Touch emulation or DPR cap invalid');
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:190,y:640}]});
  for(const y of [600,540,460,380,300,220]) {
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:190,y}]});
    await page.waitForTimeout(25);
  }
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForFunction(()=>scrollY>100 && Number(document.querySelector('canvas').dataset.paintedFrame)>1);
  const afterSwipe=await page.evaluate(()=>({scrollY,frame:document.querySelector('canvas').dataset.paintedFrame}));
  await page.getByRole('link',{name:'Skip the film'}).tap();
  await page.waitForFunction(()=>document.querySelector('#after-hero').getBoundingClientRect().top<innerHeight/2);
  const released=await page.evaluate(()=>({top:document.querySelector('.hero-viewport').getBoundingClientRect().top,y:scrollY,active:document.activeElement.id}));
  check(released.top<0,'Touch navigation trapped in hero');
  await page.getByRole('link',{name:'Back to the residence'}).tap();
  await page.waitForFunction(()=>scrollY===0);
  await page.screenshot({path:'artifacts/hero-touch-dpr3.png'});
  await cdp.detach();
  return {device,afterSwipe,released};
}

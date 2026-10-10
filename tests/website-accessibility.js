// oxlint-disable-next-line no-unused-expressions -- playwright-cli evaluates this file as a function expression.
async page => {
 const check=(v,m)=>{if(!v)throw new Error(m)};
 await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:375,height:812});
 await page.goto('http://127.0.0.1:5173/#contact');await page.reload();await page.getByRole('button',{name:'Request a Private Viewing'}).click();
 const y=await page.evaluate(()=>scrollY);
 await page.locator('.dialog-close').focus();await page.keyboard.press('Shift+Tab');
 check(await page.evaluate(()=>Boolean(document.activeElement.closest('dialog'))),'Reverse focus escaped');
 for(let i=0;i<12;i++){await page.keyboard.press('Tab');check(await page.evaluate(()=>Boolean(document.activeElement.closest('dialog'))),'Tab escaped')}
 await page.mouse.move(5,100);await page.mouse.wheel(0,700);await page.waitForTimeout(100);
 check(await page.evaluate(()=>scrollY)===y,'Background scroll while modal');
 await page.getByLabel('Full name',{exact:true}).fill('Test Visitor');
 await page.getByLabel('Email',{exact:true}).fill('visitor@example.com');
 await page.getByLabel('Property of interest').selectOption('general');
 await page.getByLabel('Preferred viewing date').fill('2099-01-01');
 await page.getByRole('button',{name:'Complete demo request'}).click();
 check(await page.getByText('Demo complete. No viewing request has been sent.').isVisible(),'Mobile submit unreachable');
 await page.getByRole('button',{name:'Close dialog'}).click();await page.waitForTimeout(100);
 check(await page.getByRole('button',{name:'Request a Private Viewing'}).evaluate(n=>n===document.activeElement),'Closing trigger focus');
 await page.setViewportSize({width:720,height:450});await page.goto('http://127.0.0.1:5173/#properties');
 await page.getByRole('button',{name:'Explore Residence: The Woodland Residence'}).click();
 await page.getByRole('button',{name:'Request a Viewing',exact:true}).click();
 await page.getByRole('button',{name:'Complete demo request'}).click();
 check(await page.locator('#viewing-name').evaluate(n=>n===document.activeElement),'Landscape invalid focus');
 await page.keyboard.press('Escape');
 return {nativeFocusContainment:true,backgroundScrollLocked:true,mobileSubmission:true,landscapeForm:true,focusRestored:true};
}

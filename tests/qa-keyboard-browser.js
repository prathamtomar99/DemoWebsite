// oxlint-disable-next-line no-unused-expressions -- playwright-cli evaluates this file as a function expression.
async page=>{
 const check=(v,m)=>{if(!v)throw new Error(m)};
 await page.goto('http://127.0.0.1:4173/#contact');await page.reload();await page.getByRole('button',{name:'Request a Private Viewing'}).click();
 const tabTo=async target=>{for(let i=0;i<25;i++){if(await page.evaluate(target=>document.activeElement.id===target||document.activeElement.textContent===target,target))return;await page.keyboard.press('Tab')}throw new Error('Unreachable '+target)};
 await tabTo('viewing-name');await page.keyboard.type('Keyboard Visitor');
 await tabTo('viewing-email');await page.keyboard.type('keyboard@example.com');
 await tabTo('viewing-property');await page.keyboard.press('g');
 await tabTo('viewing-date');await page.keyboard.press('ArrowUp');await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowUp');await page.keyboard.press('ArrowRight');await page.keyboard.type('2099');
 const date=await page.getByLabel('Preferred viewing date').inputValue();
 const outbound=[];page.on('request',r=>{if(r.method()!=='GET')outbound.push(r.url())});
 const storage=await page.evaluate(()=>[JSON.stringify(localStorage),JSON.stringify(sessionStorage)]);
 await tabTo('Complete demo request');await page.keyboard.press('Enter');
 check(await page.getByText('Demo complete. No viewing request has been sent.').isVisible(),'Keyboard submission failed');
 check(await page.evaluate(()=>JSON.stringify([JSON.stringify(localStorage),JSON.stringify(sessionStorage)]))===JSON.stringify(storage),'Storage changed');
 check(outbound.length===0,'Submission request');
 await page.keyboard.press('Escape');return {keyboardOnly:true,date,submissionRequests:outbound,storageUnchanged:true};
}

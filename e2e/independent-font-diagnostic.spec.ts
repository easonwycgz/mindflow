import {test,expect} from '@playwright/test';
test('B-R2 font: waiting for applied settings before reload persists ten times',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'体验示例'}).click();
 await page.getByText('备份、设置与隐私',{exact:true}).click();
 for(let i=0;i<10;i++){
  const size=i%2===0?'large':'normal';await page.getByLabel('字号').selectOption(size);
  await expect(page.locator('.app')).toHaveClass(size==='large'?'app large':'app');
  await page.reload();await page.getByText('备份、设置与隐私',{exact:true}).click();
  await expect(page.getByLabel('字号')).toHaveValue(size);
 }
});
test('B-R2 font: immediate reload under real IndexedDB contention preserves chosen setting',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'体验示例'}).click();
 await page.getByText('备份、设置与隐私',{exact:true}).click();
 // No production code is changed: a real IDB transaction delays the application's write.
 await page.evaluate(()=>new Promise<void>((resolve,reject)=>{
  const req=indexedDB.open('mindflow-v1');req.onerror=()=>reject(req.error);
  req.onsuccess=()=>{const db=req.result,tx=db.transaction('settings','readwrite');const end=performance.now()+5000;
   const keep=()=>{if(performance.now()<end)tx.objectStore('settings').get('main').onsuccess=keep;};keep();resolve();};
 }));
 await page.getByLabel('字号').selectOption('large');await page.reload();
 await page.getByText('备份、设置与隐私',{exact:true}).click();await expect(page.getByLabel('字号')).toHaveValue('large');
});

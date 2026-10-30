import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
async function start(page:Page){
 await page.goto('/');await page.getByRole('button',{name:'体验示例'}).click();await expect(page.locator('article h2')).toBeAttached();
 await page.goto('/migration.html');await page.getByText('超大旧库分页迁移',{exact:true}).click();
}
test('B-R4: native IndexedDB staged-state corruption is rejected before destination changes',async({page},info)=>{
 await start(page);await page.getByRole('button',{name:'准备分页迁出',exact:true}).click();
 await expect(page.getByTestId('paged-migration-state')).toContainText('完整导出已准备');
 const uploads=[];
 for(const label of ['下载分页完成清单','下载分页卷 1']){
  const pending=page.waitForEvent('download');await page.getByRole('button',{name:label,exact:true}).click();const d=await pending;
  uploads.push({name:d.suggestedFilename(),mimeType:'application/json',buffer:await readFile((await d.path())!)});
 }
 const root=JSON.parse(uploads[0].buffer.toString()),expected=JSON.parse(uploads[1].buffer.toString()).payload.reading[0].favorite;
 await page.getByLabel('分页迁移清单',{exact:true}).setInputFiles(uploads[0]);
 await expect(page.getByTestId('paged-migration-state')).toContainText('恢复暂存已打开');
 await page.getByLabel('分页迁移分卷',{exact:true}).setInputFiles(uploads[1]);
 await expect(page.getByTestId('paged-migration-state')).toContainText('整套验证完成');
 await page.evaluate(job=>new Promise<void>((resolve,reject)=>{
  const open=indexedDB.open('mindflow-migration-workspace-v1');open.onerror=()=>reject(open.error);open.onsuccess=()=>{
   const db=open.result,tx=db.transaction('reading','readwrite'),r=tx.objectStore('reading').index('job').openCursor(IDBKeyRange.only(job));
   r.onsuccess=()=>{const cursor=r.result!;const changed=cursor.value;changed.record.favorite=!changed.record.favorite;cursor.update(changed);};
   tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);
  };
 }),'restore-'+root.setId);
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'验证完成后原子替换',exact:true}).click();
 await expect(page.getByRole('button',{name:'取消或暂停当前迁移'})).toBeHidden();
 const actual=await page.evaluate(()=>new Promise<boolean>((resolve,reject)=>{
  const r=indexedDB.open('mindflow-v1');r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,tx=db.transaction('reading'),q=tx.objectStore('reading').getAll();tx.oncomplete=()=>{db.close();resolve(q.result[0].favorite);};};
 }));
 const notice=await page.getByTestId('paged-migration-state').textContent();
 await info.attach('staged-corruption-result',{body:JSON.stringify({expected,actual,notice}),contentType:'application/json'});
 await page.screenshot({path:`/tmp/mindflow-qa-r4/stage-corruption-${info.project.name}.png`,fullPage:true});
 expect(actual).toBe(expected);
});
test('B-R4: no Directory API and workspace quota error preserve the source but expose no alternate exporter',async({page})=>{
 await page.addInitScript(()=>{Reflect.deleteProperty(window,'showDirectoryPicker');});await start(page);
 await expect(page.getByRole('button',{name:'直接导出到本地目录'})).toHaveCount(0);
 await page.evaluate(()=>{
  const original=IDBObjectStore.prototype.add;
  IDBObjectStore.prototype.add=function(...args:Parameters<IDBObjectStore['add']>){
   if(this.transaction.db.name==='mindflow-migration-workspace-v1')throw new DOMException('B synthetic workspace quota full','QuotaExceededError');return original.apply(this,args);
  };
 });
 await page.getByRole('button',{name:'准备分页迁出',exact:true}).click();await expect(page.getByTestId('paged-migration-state')).toContainText('quota');
 await expect(page.getByRole('region',{name:'分页迁出下载'})).toHaveCount(0);
 expect(await page.evaluate(()=>new Promise<number>(resolve=>{const r=indexedDB.open('mindflow-v1');r.onsuccess=()=>{const db=r.result,tx=db.transaction('cards'),q=tx.objectStore('cards').count();tx.oncomplete=()=>{db.close();resolve(q.result);};};}))).toBe(1);
});
test('B-R4: closing a blocked export publishes no manifest and preserves the complete source',async({page,context})=>{
 await start(page);
 const snapshot=(p:Page)=>p.evaluate(()=>new Promise<string>((resolve,reject)=>{
  const r=indexedDB.open('mindflow-v1');r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,tx=db.transaction(['cards','reading','settings']),a=tx.objectStore('cards').getAll(),b=tx.objectStore('reading').getAll(),c=tx.objectStore('settings').getAll();tx.oncomplete=()=>{db.close();resolve(JSON.stringify([a.result,b.result,c.result]));};};
 }));const before=await snapshot(page);
 await page.evaluate(()=>new Promise<void>(resolve=>{
  const r=indexedDB.open('mindflow-migration-workspace-v1');r.onsuccess=()=>{const db=r.result,tx=db.transaction('files','readwrite');const keep=()=>{tx.objectStore('files').getAllKeys().onsuccess=keep;};keep();resolve();};
 }));
 await page.getByRole('button',{name:'准备分页迁出',exact:true}).click();
 await expect(page.getByRole('button',{name:'取消或暂停当前迁移'})).toBeVisible();
 await page.close();const reopened=await context.newPage();await reopened.goto('/migration.html');
 expect(await snapshot(reopened)).toBe(before);
 const completed=await reopened.evaluate(()=>new Promise<number>(resolve=>{const r=indexedDB.open('mindflow-migration-workspace-v1');r.onsuccess=()=>{const db=r.result,tx=db.transaction('jobs'),q=tx.objectStore('jobs').getAll();tx.oncomplete=()=>{db.close();resolve(q.result.filter(j=>j.root).length);};};}));
 expect(completed).toBe(0);
});

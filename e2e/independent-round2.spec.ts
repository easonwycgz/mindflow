import {test,expect} from '@playwright/test';
import example from '../contracts/mindflow-card-example-v1.json' with {type:'json'};
import {readFile} from 'node:fs/promises';
test('B-R2: UI two 4500-child cards export, clear synthetic stores, restore exact content',async({page})=>{
 test.setTimeout(45000);await page.goto('/');
 for(let j=0;j<2;j++){
  const c={...example,title:`B UI wide ${j}`,branches:[{id:'root',title:'根',summary:'摘要',content:'正文',children:Array.from({length:4500},(_,i)=>({id:`n${i}`,title:`节点${i}`,summary:'摘要',content:`正文${j}/${i}`,children:[]}))}]};
  await page.getByLabel('导入卡片',{exact:true}).setInputFiles({name:'wide-synthetic.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(c))});
  await expect(page.getByRole('heading',{name:c.title})).toBeAttached();
 }
 await page.getByRole('button',{name:'☆ 收藏',exact:true}).click();
 await page.getByText('备份、设置与隐私',{exact:true}).click();
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'导出完整备份'}).click();
 const download=await pending,path=(await download.path())!;const expected=JSON.parse(await readFile(path,'utf8')).payload;
 await page.evaluate(()=>new Promise<void>((resolve,reject)=>{
  const req=indexedDB.open('mindflow-v1');req.onerror=()=>reject(req.error);req.onsuccess=()=>{
   const db=req.result,tx=db.transaction(['cards','reading','settings'],'readwrite');for(const name of ['cards','reading','settings'])tx.objectStore(name).clear();
   tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);
  };
 }));
 await page.reload();await expect(page.getByText('从一张卡片开始。导入文件，或体验公开示例。')).toBeVisible();
 await page.getByText('备份、设置与隐私',{exact:true}).click();await page.getByRole('button',{name:'恢复备份',exact:true}).click();
 await page.getByRole('button',{name:'选择备份并替换'}).click();await page.getByLabel('恢复备份文件').setInputFiles(path);
 await expect(page.getByRole('status')).toContainText('恢复成功');
 const actual=await page.evaluate(()=>new Promise<{cards:unknown[];reading:unknown[];settings:unknown[]}>((resolve,reject)=>{
  const req=indexedDB.open('mindflow-v1');req.onerror=()=>reject(req.error);req.onsuccess=()=>{
   const db=req.result,tx=db.transaction(['cards','reading','settings'],'readonly');const cards=tx.objectStore('cards').getAll(),reading=tx.objectStore('reading').getAll(),settings=tx.objectStore('settings').getAll();
   tx.oncomplete=()=>{db.close();resolve({cards:cards.result,reading:reading.result,settings:settings.result});};
  };
 }));
 expect(actual.cards).toEqual(expected.cards);expect(actual.settings).toEqual([expected.settings]);
 expect(actual.reading).toEqual(expected.reading);
});
test('B-R2: paste/file parity, no clipboard API, closed-page persistence and no external upload',async({page,context})=>{
 const external:string[]=[];context.on('request',r=>{if(!r.url().startsWith('http://localhost:4173'))external.push(r.url());});
 await page.addInitScript(()=>{Object.defineProperty(navigator,'clipboard',{value:{readText:()=>{throw Error('clipboard permission forbidden by QA');}}});});
 await page.goto('/');
 for(const value of [{...example,title:undefined},{...example,extra:1},{...example,schema_version:'2.0'}]){
  await page.getByRole('button',{name:'粘贴 JSON',exact:true}).click();
  await page.getByRole('textbox',{name:'JSON 内容'}).fill(JSON.stringify(value));
  await page.getByRole('button',{name:'校验并导入'}).click();await expect(page.getByRole('status')).toContainText('校验失败');
  await page.getByRole('button',{name:'关闭粘贴'}).click();
  await page.getByLabel('导入卡片',{exact:true}).setInputFiles({name:'synthetic.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(value))});
  await expect(page.getByRole('status')).toContainText('校验失败');
 }
 for(let i=0;i<2;i++){
  await page.getByRole('button',{name:'粘贴 JSON',exact:true}).click();
  await page.getByRole('textbox',{name:'JSON 内容'}).fill(JSON.stringify({...example,title:`B pasted ${i}`}));
  await page.getByRole('button',{name:'校验并导入'}).click();await expect(page.getByRole('heading',{name:`B pasted ${i}`})).toBeVisible();
 }
 await expect(page.getByRole('navigation',{name:'卡片列表'}).getByRole('button')).toHaveCount(2);
 await page.close();const reopened=await context.newPage();await reopened.goto('/');
 await expect(reopened.getByRole('heading',{name:'B pasted 1'})).toBeVisible();
 await expect(reopened.getByRole('navigation',{name:'卡片列表'}).getByRole('button')).toHaveCount(2);expect(external).toEqual([]);
});
test('B-R2: returning from node moves accessible focus to tree navigation',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'体验示例'}).click();
 await page.getByRole('button',{name:'知识树',exact:true}).click();
 await page.getByRole('button',{name:example.branches[0].title,exact:true}).click();
 await expect(page.getByRole('region',{name:'节点内容'})).toBeFocused();
 await page.getByRole('button',{name:'返回知识树'}).click();
 expect(await page.evaluate(()=>!!document.activeElement?.closest('#tree-navigation'))).toBe(true);
});
test('B-R2: touch exclusions, thresholds and explicit card buttons',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');
 for(const title of ['B touch one','B touch two']){
  await page.getByLabel('导入卡片',{exact:true}).setInputFiles({name:'synthetic.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...example,title}))});
  await expect(page.getByRole('heading',{name:title})).toBeAttached();
 }
 const gesture=async(selector:string,dx:number,multiple=false,selection=false)=>{
  await expect(page.locator(selector).first()).toBeAttached();
  return page.evaluate(({selector,dx,multiple,selection})=>{
  const target=document.querySelector(selector)!;
  if(selection){const r=document.createRange();r.selectNodeContents(target);window.getSelection()!.removeAllRanges();window.getSelection()!.addRange(r);}
  const t=(x:number,id=1)=>new Touch({identifier:id,target,clientX:x,clientY:300});
  target.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,touches:multiple?[t(300),t(320,2)]:[t(300)]}));
  target.dispatchEvent(new TouchEvent('touchend',{bubbles:true,touches:[],changedTouches:[t(300+dx)]}));
  window.getSelection()?.removeAllRanges();
 },{selector,dx,multiple,selection});};
 for(const selector of ['.card-switch button','.tabs button']){
  await gesture(selector,-200);await expect(page.getByRole('heading',{name:'B touch two'})).toBeAttached();
 }
 await gesture('.prose',-79);await expect(page.getByRole('heading',{name:'B touch two'})).toBeAttached();
 await gesture('.prose',-200,true);await expect(page.getByRole('heading',{name:'B touch two'})).toBeAttached();
 await gesture('.prose',-200,false,true);await expect(page.getByRole('heading',{name:'B touch two'})).toBeAttached();
 await page.getByRole('button',{name:'知识树',exact:true}).click();
 await gesture('.tree button',-200);await expect(page.getByRole('heading',{name:'B touch two'})).toBeAttached();
 await page.getByRole('button',{name:'下一张',exact:true}).click();await expect(page.getByRole('heading',{name:'B touch one'})).toBeAttached();
 await page.getByRole('button',{name:'上一张',exact:true}).click();await expect(page.getByRole('heading',{name:'B touch two'})).toBeAttached();
});

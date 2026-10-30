import {test,expect} from '@playwright/test';
import example from '../contracts/mindflow-card-example-v1.json' with {type:'json'};
test('B-R3: transaction abort after successful put is not Saved, retry commits before acknowledgement',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'体验示例'}).click();await page.getByText('备份、设置与隐私',{exact:true}).click();
 await page.evaluate(()=>{
  const original=IDBObjectStore.prototype.put;
  Object.assign(window,{bR3:{abort:true,commits:[] as string[],restore:()=>{IDBObjectStore.prototype.put=original;}}});
  IDBObjectStore.prototype.put=function(...args:Parameters<IDBObjectStore['put']>){
   const request=original.apply(this,args);
   if(this.name==='settings'){
    const state=(window as unknown as {bR3:{abort:boolean;commits:string[]}}).bR3;
    const font=(args[0] as {fontSize:string}).fontSize;
    if(state.abort){state.abort=false;request.addEventListener('success',()=>this.transaction.abort(),{once:true});}
    this.transaction.addEventListener('complete',()=>state.commits.push(font),{once:true});
   }
   return request;
  };
 });
 const select=page.getByLabel('字号'),status=page.getByTestId('font-save-state');
 await select.selectOption('large');await expect(status).toContainText('字号保存失败');await expect(status).not.toContainText('字号已保存');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('mindflow-font-intent-v1')!).fontSize)).toBe('large');
 expect(await page.evaluate(()=>(window as unknown as {bR3:{commits:string[]}}).bR3.commits)).toEqual([]);
 await page.getByRole('button',{name:'重试保存字号'}).click();await expect(status).toContainText('字号已保存：大字');
 expect(await page.evaluate(()=>(window as unknown as {bR3:{commits:string[]}}).bR3.commits)).toEqual(['large']);
 await expect.poll(()=>page.evaluate(()=>localStorage.getItem('mindflow-font-intent-v1'))).toBeNull();
 await page.reload();await page.getByText('备份、设置与隐私',{exact:true}).click();await expect(select).toHaveValue('large');
 await select.selectOption('normal');await expect(status).toContainText('字号已保存：标准');
 await page.reload();await page.getByText('备份、设置与隐私',{exact:true}).click();await expect(select).toHaveValue('normal');
});
test('B-R3: depth-16 selected node focus, keyboard continuation and both missing-target fallbacks',async({page})=>{
 await page.goto('/');const c=structuredClone(example);c.title='B R3 sixteen';
 c.branches=[{id:'d1',title:'B层1',summary:'摘要',content:'正文1',children:[]}];let b=c.branches[0];
 for(let i=2;i<=16;i++){const n={id:`d${i}`,title:`B层${i}`,summary:'摘要',content:`正文${i}`,children:[]};b.children=[n];b=n;}
 await page.getByLabel('导入卡片',{exact:true}).setInputFiles({name:'synthetic.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(c))});
 await page.getByRole('button',{name:'知识树',exact:true}).click();
 await page.getByRole('button',{name:'B层1',exact:true}).focus();
 for(let i=1;i<16;i++){await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');await expect(page.getByRole('button',{name:`B层${i+1}`,exact:true})).toBeFocused();}
 const leaf=page.getByRole('button',{name:'B层16',exact:true}),body=page.getByRole('region',{name:'节点内容'});
 for(let i=0;i<2;i++){
  await page.keyboard.press('Enter');await expect(body).toBeFocused();await page.getByRole('button',{name:'返回知识树'}).click();
  await expect(leaf).toBeFocused();await expect(leaf).toHaveAttribute('aria-pressed','true');
 }
 await page.keyboard.press('ArrowLeft');await expect(page.getByRole('button',{name:'B层15',exact:true})).toBeFocused();
 await page.keyboard.press('End');await expect(leaf).toBeFocused();await page.keyboard.press('Enter');await expect(body).toBeFocused();
 await page.locator('#tree-navigation button[data-node-id="d16"]').evaluate(el=>el.remove());
 await page.getByRole('button',{name:'返回知识树'}).click();await expect(page.getByRole('button',{name:'B层1',exact:true})).toBeFocused();
 await page.locator('#tree-navigation').evaluate(el=>el.querySelectorAll('button[data-node-id]').forEach(b=>b.remove()));
 await page.getByRole('button',{name:'返回知识树'}).click();await expect(page.locator('#tree-navigation')).toBeFocused();
});

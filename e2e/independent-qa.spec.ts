import { expect, test } from '@playwright/test';
import example from '../contracts/mindflow-card-example-v1.json' with {type:'json'};
const upload = (card: unknown) => ({name:'qa-synthetic.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(card))});
async function seed(page: import('@playwright/test').Page) {
 await page.goto('/'); await page.getByLabel('导入卡片',{exact:true}).setInputFiles(upload(example));
 await expect(page.getByRole('heading',{name:example.title})).toBeAttached();
 await page.getByRole('button',{name:'关闭提示'}).click();
}
test('QA: direct JSON paste entry exists', async ({page}) => {
 await page.goto('/');
 await expect(page.locator('textarea,[contenteditable="true"],button').filter({hasText:/粘贴|剪贴板/})).not.toHaveCount(0);
});
test('QA: 390px returning reader sees card and reading tabs in first screen', async ({page},info) => {
 await page.setViewportSize({width:390,height:844}); await seed(page); await page.reload();
 const heading=page.getByRole('heading',{name:example.title}); await expect(heading).toBeAttached();
 const tab=page.getByRole('button',{name:'30 秒摘要',exact:true});
 const measurements=await page.evaluate(()=>({height:innerHeight,mainTop:document.querySelector('main')!.getBoundingClientRect().top,tabsTop:document.querySelector('.tabs')!.getBoundingClientRect().top}));
 await info.attach('first-screen-measurements',{body:JSON.stringify(measurements),contentType:'application/json'});
 await page.screenshot({path:`/tmp/mindflow-qa/first-screen-${info.project.name}.png`,fullPage:true});
 expect((await tab.boundingBox())!.y).toBeLessThan(844);
});
test('QA: backup UI warns files are unencrypted', async ({page}) => {
 await seed(page); await page.getByText('备份、设置与隐私',{exact:true}).click();
 await expect(page.locator('.storage')).toContainText(/未加密|不加密|明文/);
});
test('QA: synthetic markdown/math stays inert and never contacts external hosts', async ({page}) => {
 const external:string[]=[]; page.on('request',r=>{if(!r.url().startsWith('http://localhost:4173'))external.push(r.url());});
 await page.goto('/'); const c=structuredClone(example);
 c.summary='## 标题\n**专业术语**\n$x^2$\n[恶意链接](javascript:alert(1))\n<img src="https://evil.invalid/pixel" onerror="window.qaPwned=1">';
 await page.getByLabel('导入卡片',{exact:true}).setInputFiles(upload(c));
 await expect(page.getByText(c.summary,{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>('qaPwned' in window))).toBe(false); expect(external).toEqual([]);
});
test('QA: selecting tree node scrolls its content into the mobile viewport', async ({page}) => {
 await page.setViewportSize({width:390,height:844}); await seed(page);
 const c=structuredClone(example); c.title='QA synthetic long tree';
 c.branches=Array.from({length:12},(_,i)=>({id:`b${i}`,title:`合成分支${i}`,summary:'长中文摘要'.repeat(80),content:`节点正文${i}`,children:[]}));
 await page.getByLabel('导入卡片',{exact:true}).setInputFiles(upload(c));
 await page.getByRole('button',{name:'知识树',exact:true}).click();
 await page.getByRole('button',{name:'合成分支0',exact:true}).click();
 const region=page.getByRole('region',{name:'节点内容'}); await expect(region).toContainText('节点正文0');
 expect((await region.boundingBox())!.y).toBeLessThan(844);
});
test('QA: real Chromium touch swipe switches cards without a management button', async ({page,browserName},info) => {
 test.skip(browserName!=='chromium'||info.project.name!=='chromium-mobile','requires Chromium touch session');
 await page.setViewportSize({width:390,height:844}); await seed(page);
 await page.getByLabel('导入卡片',{exact:true}).setInputFiles(upload({...example,title:'QA second card'}));
 await page.locator('article h2').scrollIntoViewIfNeeded();
 const session=await page.context().newCDPSession(page);
 await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:340,y:400}]});
 for(let x=300;x>=40;x-=40)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:400}]});
 await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await expect(page.getByRole('heading',{name:example.title})).toBeAttached();
});

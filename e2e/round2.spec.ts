import {test,expect} from '@playwright/test';
import example from '../contracts/mindflow-card-example-v1.json' with {type:'json'};
const upload=(value:unknown)=>({name:'synthetic.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(value))});
test('QA-002: paste and file import share validation and dedup, multiple cards persist offline',async({page,context})=>{
 await page.goto('/');await page.getByRole('button',{name:'粘贴 JSON',exact:true}).click();
 const text=page.getByRole('textbox',{name:'JSON 内容'});await text.fill('{bad');await page.getByRole('button',{name:'校验并导入'}).click();await expect(page.getByRole('status')).toContainText('JSON 格式错误');
 await text.fill(JSON.stringify(example));await page.getByRole('button',{name:'校验并导入'}).click();await expect(page.getByRole('heading',{name:example.title})).toBeVisible();
 await page.getByRole('button',{name:'粘贴 JSON',exact:true}).click();await text.fill(JSON.stringify(example));await page.getByRole('button',{name:'校验并导入'}).click();await expect(page.getByRole('status')).toContainText('已存在');
 await text.fill(JSON.stringify({...example,title:'粘贴第二张'}));await page.getByRole('button',{name:'校验并导入'}).click();await expect(page.getByRole('heading',{name:'粘贴第二张'})).toBeVisible();
 await page.getByLabel('导入卡片',{exact:true}).setInputFiles(upload({...example,title:'粘贴第二张'}));await expect(page.getByRole('status')).toContainText('已存在');
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.reload();await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);await context.setOffline(true);await page.reload();await expect(page.getByRole('heading',{name:'粘贴第二张'})).toBeVisible();
});
test('QA-003: depth-16 disclosure, focused body and selected ancestors survive reload',async({page})=>{
 await page.goto('/');const c=structuredClone(example);c.title='16层合成树';c.branches=[{id:'d1',title:'第1层',summary:'长摘要'.repeat(80),content:'第1层正文',children:[]}];let b=c.branches[0];for(let i=2;i<=16;i++){const n={id:'d'+i,title:'第'+i+'层',summary:'长摘要'.repeat(80),content:'深层正文'+i,children:[]};b.children=[n];b=n;}
 await page.getByLabel('导入卡片',{exact:true}).setInputFiles(upload(c));await page.getByRole('button',{name:'知识树',exact:true}).click();
 for(let i=1;i<16;i++)await page.getByText('展开 第'+i+'层 的子节点',{exact:true}).click();
 await page.getByRole('button',{name:'第16层',exact:true}).click();const body=page.getByRole('region',{name:'节点内容'});await expect(body).toContainText('深层正文16');await expect(body).toBeFocused();expect((await body.boundingBox())!.y).toBeLessThan(200);
 await page.waitForTimeout(300);await page.reload();await expect(body).toContainText('深层正文16');expect((await body.boundingBox())!.y).toBeLessThan(200);await page.getByRole('button',{name:'返回知识树'}).click();await expect(page.getByRole('button',{name:'第16层',exact:true})).toBeVisible();
});
test('QA-008/009: basic Markdown is structured under actual strict CSP',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const response=await page.goto('/');const csp=response!.headers()['content-security-policy'];expect(csp).toContain("script-src 'self'");expect(csp).not.toContain('unsafe-eval');
 const c={...example,summary:'## 核心标题\n- 第一项\n- **重要结论**\n\n公式 $x^2$ 保留原文'};await page.getByLabel('导入卡片',{exact:true}).setInputFiles(upload(c));await expect(page.getByRole('heading',{name:'核心标题'})).toBeVisible();await expect(page.locator('.reading-text ul li')).toHaveCount(2);await expect(page.locator('.reading-text strong')).toHaveText('重要结论');expect(errors).toEqual([]);
});
test('QA-006: vertical touch scroll does not switch cards or cancel reading',async({page})=>{
 await page.goto('/');await page.getByLabel('导入卡片',{exact:true}).setInputFiles(upload(example));await expect(page.getByRole('heading',{name:example.title})).toBeAttached();await page.getByLabel('导入卡片',{exact:true}).setInputFiles(upload({...example,title:'竖向滚动卡片',summary:example.summary.repeat(4)}));await expect(page.getByRole('heading',{name:'竖向滚动卡片'})).toBeAttached();await page.locator('article h2').scrollIntoViewIfNeeded();const before=await page.evaluate(()=>scrollY);
 const session=await page.context().newCDPSession(page);await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:260,y:600}]});for(let y=560;y>=300;y-=40)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:265,y}]});await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await expect(page.getByRole('heading',{name:'竖向滚动卡片'})).toBeAttached();await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(before);
});

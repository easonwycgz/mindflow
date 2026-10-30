import { expect, test } from '@playwright/test';
import example from '../contracts/mindflow-card-example-v1.json' with {type:'json'};
const upload=(card:unknown)=>({name:'card.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(card))});
test('import, recursive reading, search, favorites and persistence',async({page})=>{
 await page.goto('/');await page.getByLabel('导入卡片',{exact:true}).setInputFiles(upload(example));
 await expect(page.getByRole('heading',{name:example.title})).toBeVisible();
 await page.getByRole('button',{name:'☆ 收藏',exact:true}).click();
 await page.getByRole('button',{name:'知识树',exact:true}).click();await page.getByText('展开 直觉：为什么位置会改变电的价值？ 的子节点',{exact:true}).click();await page.getByRole('button',{name:'一个两区域示意',exact:true}).click();
 await expect(page.getByRole('region',{name:'节点内容'})).toContainText('真实电网');
 await page.reload();await expect(page.getByRole('button',{name:'★ 已收藏',exact:true})).toBeVisible();await expect(page.getByRole('region',{name:'节点内容'})).toContainText('真实电网');
 await page.getByRole('button',{name:'常见问题',exact:true}).click();await page.getByText(example.faq[0].question,{exact:true}).click();await expect(page.getByText(example.faq[0].answer,{exact:true})).toBeVisible();
 await page.getByPlaceholder('标题、摘要或标签').fill('不存在');await expect(page.getByText('没有匹配的卡片。')).toBeVisible();
 await page.getByPlaceholder('标题、摘要或标签').fill('电力');await expect(page.getByRole('navigation',{name:'卡片列表'}).getByRole('button')).toHaveCount(1);
 await page.getByLabel('导入卡片',{exact:true}).setInputFiles(upload(example));await expect(page.getByRole('status')).toContainText('已存在');
 await page.getByLabel('导入卡片',{exact:true}).setInputFiles(upload({}));await expect(page.getByRole('status')).toContainText('校验失败');await expect(page.getByRole('heading',{name:example.title})).toBeVisible();
});
test('safe rendering never requests remote images or executes HTML',async({page})=>{
 const requests:string[]=[];page.on('request',r=>requests.push(r.url()));await page.goto('/');
 const c=structuredClone(example);c.summary='<script>window.pwned=true</script> ![x](https://evil.invalid/tracker.png)';await page.getByLabel('导入卡片',{exact:true}).setInputFiles(upload(c));
 await expect(page.getByText(c.summary,{exact:true})).toBeVisible();expect(await page.evaluate(()=>('pwned' in window))).toBe(false);expect(requests.some(r=>r.includes('evil.invalid'))).toBe(false);
});
test('backup export and restore preserve favorites and reject corrupt input',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'体验示例'}).click();await page.getByRole('button',{name:'☆ 收藏',exact:true}).click();
 await page.getByText('备份、设置与隐私',{exact:true}).click();const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'导出完整备份'}).click();const download=await downloadPromise;const file=await download.path();expect(file).toBeTruthy();
 await page.getByRole('button',{name:'★ 已收藏',exact:true}).click();await page.getByRole('button',{name:'恢复备份',exact:true}).click();await page.getByRole('button',{name:'选择备份并替换'}).click();await page.getByLabel('恢复备份文件').setInputFiles(file!);
 await expect(page.getByRole('status')).toContainText('恢复成功');await expect(page.getByRole('button',{name:'★ 已收藏',exact:true})).toBeVisible();
 await page.getByLabel('恢复备份文件').setInputFiles(upload({version:99}));await expect(page.getByRole('status')).toContainText('version');await expect(page.getByRole('button',{name:'★ 已收藏',exact:true})).toBeVisible();
});
test('production service worker reopens imported content offline',async({page,context,browserName})=>{
 test.skip(browserName==='webkit','Playwright WebKit service-worker offline parity requires actual iOS acceptance');
 await page.goto('/');await page.getByRole('button',{name:'体验示例'}).click();await expect(page.getByRole('heading',{name:example.title})).toBeVisible();
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.reload();await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
 await context.setOffline(true);await page.reload();await expect(page.getByRole('heading',{name:example.title})).toBeVisible();await expect(page.getByText('离线模式',{exact:true})).toBeVisible();
});
test('random recommendation excludes current card, favorites filter and large text fit',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'体验示例'}).click();await expect(page.getByRole('heading',{name:example.title})).toBeVisible();
 const second={...example,title:'第二张知识卡片'};await page.getByLabel('导入卡片',{exact:true}).setInputFiles(upload(second));await expect(page.getByRole('heading',{name:second.title})).toBeVisible();
 await page.getByRole('button',{name:'随机一张'}).click();await expect(page.getByRole('heading',{name:example.title})).toBeVisible();await page.getByRole('button',{name:'☆ 收藏',exact:true}).click();await page.getByRole('button',{name:'★ 只看收藏',exact:true}).click();await expect(page.getByRole('navigation',{name:'卡片列表'}).getByRole('button')).toHaveCount(1);
 await page.getByText('备份、设置与隐私',{exact:true}).click();await page.getByLabel('字号').selectOption('large');await page.reload();await page.getByText('备份、设置与隐私',{exact:true}).click();await expect(page.getByLabel('字号')).toHaveValue('large');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
test('reading scroll position survives reopening',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'体验示例'}).click();await expect(page.getByRole('heading',{name:example.title})).toBeVisible();await page.evaluate(()=>window.scrollTo(0,300));await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeGreaterThan(0);await page.waitForTimeout(400);const position=await page.evaluate(()=>window.scrollY);await page.reload();await expect(page.getByRole('heading',{name:example.title})).toBeAttached();await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeGreaterThan(position-20);
});

import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
async function start(page:Page){await page.goto('/');await page.getByRole('button',{name:'体验示例'}).click();await expect(page.locator('article h2')).toBeAttached();await page.goto('/migration.html');await page.getByText('超大旧库分页迁移',{exact:true}).click();}
const snapshot=(page:Page)=>page.evaluate(()=>new Promise<string>((resolve,reject)=>{const r=indexedDB.open('mindflow-v1');r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,tx=db.transaction(['cards','reading','settings']),qs=['cards','reading','settings'].map(n=>tx.objectStore(n).getAll());tx.oncomplete=()=>{db.close();resolve(JSON.stringify(qs.map(q=>q.result)));};};}));
test('B-R5: repeated actual download is identical, missing/replaced file cannot restore, pristine files restore completely',async({page},info)=>{
 await page.addInitScript(()=>{Reflect.deleteProperty(window,'showDirectoryPicker');});await start(page);const before=await snapshot(page);
 const response=await page.request.get('/migration.html');expect(response.headers()['content-security-policy']).not.toContain('unsafe-eval');expect(response.headers()['content-security-policy']).toContain("script-src 'self'");
 await page.getByRole('button',{name:'逐卷下载（无需暂存空间）',exact:true}).click();const section=page.getByRole('region',{name:'无需暂存的逐卷下载'});await expect(section).toBeVisible();
 await expect(section.getByRole('button',{name:'已保存当前文件，继续',exact:true})).toBeDisabled();
 const get=async()=>{const pending=page.waitForEvent('download');await section.getByRole('button',{name:'下载当前文件',exact:true}).click();const d=await pending;return {name:d.suggestedFilename(),mimeType:'application/json',buffer:await readFile((await d.path())!)};};
 const one=await get(),duplicate=await get();expect(duplicate.name).toBe(one.name);expect(duplicate.buffer).toEqual(one.buffer);
 await expect(page.getByTestId('direct-download-progress')).toContainText('已请求下载 1 个文件');
 await section.getByRole('button',{name:'已保存当前文件，继续',exact:true}).click();await expect(section).toContainText('manifest.json');const root=await get();
 const parsed=JSON.parse(root.buffer.toString());expect(parsed.totalParts).toBe(1);expect(parsed.totalBytes).toBe(one.buffer.length);
 await section.getByRole('button',{name:'已保存当前文件，继续',exact:true}).click();await expect(page.getByTestId('paged-migration-state')).toContainText('磁盘保存尚未验证');expect(await snapshot(page)).toBe(before);
 await page.getByLabel('分页迁移清单',{exact:true}).setInputFiles(root);await expect(page.getByTestId('paged-migration-state')).toContainText('恢复暂存已打开');
 const commit=page.getByRole('button',{name:'验证完成后原子替换',exact:true});await expect(commit).toBeDisabled();
 await page.getByLabel('分页迁移分卷',{exact:true}).setInputFiles({...one,buffer:Buffer.from('{}')});await expect(page.getByTestId('paged-migration-state')).toContainText('操作未完成');await expect(commit).toBeDisabled();expect(await snapshot(page)).toBe(before);
 await page.getByLabel('分页迁移分卷',{exact:true}).setInputFiles(one);await expect(page.getByTestId('paged-migration-state')).toContainText('整套验证完成');page.once('dialog',d=>d.accept());await commit.click();await expect(page.getByTestId('paged-migration-state')).toContainText('完整提交成功');expect(await snapshot(page)).toBe(before);
 await info.attach('download-retry-metrics',{body:JSON.stringify({sameFileRetry:true,bytes:one.buffer.length,missingAndReplacedRejected:true,pristineRestoreExact:true}),contentType:'application/json'});
});
test.describe('B-R5 download policy denial',()=>{
 test.use({acceptDownloads:false});
 test('blocked browser download is not verified as saved; cancellation preserves source',async({page},info)=>{
  await page.addInitScript(()=>{Reflect.deleteProperty(window,'showDirectoryPicker');});await start(page);const before=await snapshot(page);
  await page.getByRole('button',{name:'逐卷下载（无需暂存空间）',exact:true}).click();const section=page.getByRole('region',{name:'无需暂存的逐卷下载'});await expect(section).toBeVisible();
  const pending=page.waitForEvent('download');await section.getByRole('button',{name:'下载当前文件',exact:true}).click();const d=await pending,failure=await d.failure();expect(failure).toBeTruthy();
  await expect(page.getByTestId('paged-migration-state')).toContainText('不代表磁盘保存已确认');await expect(section).toBeVisible();
  const progress=await page.getByTestId('direct-download-progress').textContent();
  await page.screenshot({path:`/tmp/mindflow-qa-r5/denied-download-${info.project.name}.png`,fullPage:true});
  await page.getByRole('button',{name:'取消或暂停当前迁移'}).click();await expect(page.getByTestId('paged-migration-state')).toContainText('不完整');expect(await snapshot(page)).toBe(before);
  await info.attach('download-policy-denial',{body:JSON.stringify({failure,progress,sourcePreserved:true,verifiedCompletion:false}),contentType:'application/json'});
  expect(progress).not.toContain('这些文件仍在设备下载位置');
 });
});

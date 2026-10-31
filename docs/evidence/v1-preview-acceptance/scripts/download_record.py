import os,json,hashlib,datetime
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
R=Path('/workspace/work/preview-review');U='https://36e604de.001beta.pages.dev/'
with sync_playwright() as p:
 c=p.chromium.launch_persistent_context(str(R/'download-profile'),executable_path='/usr/bin/chromium',headless=True,proxy={'server':os.environ['HTTPS_PROXY']},ignore_https_errors=False,viewport={'width':1280,'height':900},accept_downloads=True,args=['--no-sandbox']);page=c.pages[0];page.goto(U,wait_until='networkidle');page.get_by_label('导入卡片',exact=True).set_input_files(str(R/'archive/docs/synthetic/mindflow-v1-work-example-a.json'));expect(page.locator('.count')).to_have_text('1 张卡片');page.get_by_label('导入卡片',exact=True).set_input_files(str(R/'archive/docs/synthetic/mindflow-v1-work-example-b.json'));expect(page.locator('.count')).to_have_text('2 张卡片');storage=page.locator('details.storage');storage.locator('summary').first.click()
 with page.expect_download() as ev:page.get_by_role('button',name='导出完整备份',exact=True).click()
 d=ev.value;d.save_as(str(R/'download-confirmation-synthetic.json'));assert d.failure() is None
 downloads=c.new_page();downloads.goto('chrome://downloads/');downloads.wait_for_timeout(500)
 items=downloads.evaluate('''()=>{const m=document.querySelector('downloads-manager');return m?.shadowRoot?.querySelector('#downloadsList')?.items?.map(x=>({fileName:x.fileName,state:x.state,percent:x.percent,url:x.url,receivedBytes:x.receivedBytes,totalBytes:x.totalBytes,exists:x.fileExternallyRemoved===false}))}''')
 downloads.screenshot(path=str(R/'evidence/16-browser-download-record.png'),full_page=True)
 data=(R/'download-confirmation-synthetic.json').read_bytes();result={'observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'download_failure':d.failure(),'saved_file_bytes':len(data),'saved_file_sha256':hashlib.sha256(data).hexdigest(),'chrome_downloads_records':items,'note':'Browser download list plus Playwright completion and saved local bytes; not inferred from anchor click. Blob URL contains no remote destination.'};(R/'evidence/download-record.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False,indent=2));c.close()

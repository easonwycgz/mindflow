import os,json,datetime,urllib.request,ssl,urllib.error,hashlib
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
R=Path('/workspace/work/preview-review');O=R/'evidence';U='https://36e604de.001beta.pages.dev/';result={'observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat()}
with sync_playwright() as p:
 c=p.chromium.launch_persistent_context(str(R/'acceptance-profile-verified'),executable_path='/usr/bin/chromium',headless=True,proxy={'server':os.environ['HTTPS_PROXY']},ignore_https_errors=False,viewport={'width':1280,'height':900},args=['--no-sandbox']);page=c.pages[0];response=page.goto(U,wait_until='networkidle');result['browser_home_headers']=response.all_headers();result['security_details']=response.security_details();cdp=c.new_cdp_session(page)
 result['browser_manifest']=cdp.send('Page.getAppManifest');result['browser_manifest_link']=page.locator('link[rel="manifest"]').get_attribute('href')
 result['invalid_object_reproductions']=[]
 for i in range(2):
  if not page.get_by_role('textbox',name='JSON 内容').is_visible():page.get_by_role('button',name='粘贴 JSON',exact=True).click()
  page.get_by_role('textbox',name='JSON 内容').fill('{}');page.get_by_role('button',name='校验并导入',exact=True).click();expect(page.get_by_role('status')).to_contain_text('schema_version');result['invalid_object_reproductions'].append(page.get_by_role('status').inner_text())
  page.screenshot(path=str(O/f'issue-001-invalid-object-{i+1}.png'),full_page=True)
 result['library_count_after_invalid']=page.locator('.count').inner_text();c.close()
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs):return None
opener=urllib.request.build_opener(urllib.request.HTTPSHandler(context=ssl.create_default_context()),NoRedirect());result['http_followup']=[]
for path in ['index.html','_headers']:
 try:r=opener.open(urllib.request.Request(U+path,headers={'User-Agent':'MindflowV1-IndependentAcceptanceB/1.0'}),timeout=30)
 except urllib.error.HTTPError as e:r=e
 with r:
  data=r.read();result['http_followup'].append({'path':path,'status':r.status,'headers':dict(r.headers.items()),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
(O/'followup-observations.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False,indent=2))

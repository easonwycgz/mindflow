import os,json,datetime,hashlib,traceback
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path('/workspace/work/preview-review'); OUT=ROOT/'evidence'; URL='https://36e604de.001beta.pages.dev/'
A=json.loads((ROOT/'archive/docs/synthetic/mindflow-v1-work-example-a.json').read_text()); B=json.loads((ROOT/'archive/docs/synthetic/mindflow-v1-work-example-b.json').read_text())
results=[];network=[];errors=[]; details={}; shots=[]
def save():
 (OUT/'functional-results.json').write_text(json.dumps({'started_at':START,'updated_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'tests':results,'details':details,'screenshots':shots,'page_errors':errors,'network':network},ensure_ascii=False,indent=2))
def test(id,name,fn):
 try:
  value=fn();results.append({'id':id,'name':name,'status':'PASS','observed':value}); print(id,'PASS',name,flush=True)
 except Exception as e:
  results.append({'id':id,'name':name,'status':'FAIL','error':str(e),'trace':traceback.format_exc()});print(id,'FAIL',str(e),flush=True)
 save()
def shot(name):
 page.screenshot(path=str(OUT/(name+'.png')),full_page=True);shots.append(name+'.png')
def body():return page.locator('body').inner_text()
def open_storage():
 el=page.locator('details.storage');
 if not el.get_attribute('open') is not None: el.locator('summary').first.click()
def paste(value):
 if not page.get_by_role('textbox',name='JSON 内容').is_visible():page.get_by_role('button',name='粘贴 JSON',exact=True).click()
 page.get_by_role('textbox',name='JSON 内容').fill(value)
 page.get_by_role('button',name='校验并导入',exact=True).click()
def title():return page.locator('article h2').inner_text()
def select(card):
 page.get_by_role('navigation',name='卡片列表').get_by_role('button',name=card['title']).click()
 expect(page.locator('article h2')).to_have_text(card['title'])
def count(n):expect(page.locator('.count')).to_have_text(f'{n} 张卡片')
def on_request(r):
 row={'url':r.url,'method':r.method,'type':r.resource_type,'post_data_bytes':len(r.post_data_buffer or b'')};network.append(row)
 if r.url.startswith('http') and (not r.url.startswith(URL) or r.method not in ['GET','HEAD']):
  details['unexpected_request']=row;save();raise RuntimeError('STOP unexpected remote request')
def attach(c):
 c.on('request',on_request)
 c.on('response',lambda r:network.append({'event':'response','url':r.url,'status':r.status,'from_service_worker':r.from_service_worker}))
 c.on('requestfailed',lambda r:network.append({'event':'failed','url':r.url,'failure':r.failure}))
 for pg in c.pages:pg.on('pageerror',lambda e:errors.append(str(e)))
def launch(p,profile,viewport={'width':1280,'height':900},mobile=False):
 return p.chromium.launch_persistent_context(str(ROOT/profile),executable_path='/usr/bin/chromium',headless=True,proxy={'server':os.environ['HTTPS_PROXY']},ignore_https_errors=False,viewport=viewport,is_mobile=mobile,has_touch=mobile,accept_downloads=True,args=['--no-sandbox'])
START=datetime.datetime.now(datetime.timezone.utc).isoformat()
with sync_playwright() as p:
 c=launch(p,'acceptance-profile-verified');page=c.pages[0];attach(c)
 def initial():
  r=page.goto(URL,wait_until='networkidle');assert r.status==200;count(0)
  expect(page.get_by_role('button',name='粘贴 JSON',exact=True)).to_be_visible();expect(page.get_by_label('导入卡片',exact=True)).to_be_attached()
  details['initial_text']=body();details['security_details']=r.security_details();shot('01-empty-desktop');return {'status':r.status,'secure_context':page.evaluate('isSecureContext'),'url':page.url}
 test('B01','Trusted HTTPS initial empty library and import discoverability',initial)
 def import_a():
  paste(json.dumps(A,ensure_ascii=False));count(1);expect(page.locator('article h2')).to_have_text(A['title']);return body()
 test('B02','Paste official synthetic A JSON',import_a)
 def import_b():
  page.get_by_label('导入卡片',exact=True).set_input_files(str(ROOT/'archive/docs/synthetic/mindflow-v1-work-example-b.json'));count(2);expect(page.locator('article h2')).to_have_text(B['title']);shot('02-two-cards');return title()
 test('B03','File import official synthetic B JSON',import_b)
 def duplicate():
  paste(json.dumps(A,ensure_ascii=False));count(2);expect(page.get_by_role('status')).to_contain_text('已存在');return page.get_by_role('status').inner_text()
 test('B04','Duplicate import preserves two-card library',duplicate)
 def invalid():
  paste('{}');expect(page.get_by_role('status')).to_be_visible();count(2);msg=page.get_by_role('status').inner_text();assert '安全导入' not in msg
  select(A);select(B);return msg
 test('B05','Reject empty object without damaging A/B',invalid)
 def malformed():
  paste('{');expect(page.get_by_role('status')).to_be_visible();count(2);msg=page.get_by_role('status').inner_text();assert '安全导入' not in msg
  if page.get_by_role('button',name='关闭粘贴').is_visible():page.get_by_role('button',name='关闭粘贴').click()
  return msg
 test('B06','Reject malformed JSON without damaging A/B',malformed)
 def summary():
  select(A);page.get_by_role('button',name='30 秒摘要',exact=True).click();art=page.locator('article');expect(art).to_contain_text(A['summary'])
  for s in A['key_takeaways']+A['tags']:expect(art).to_contain_text(s)
  shot('03-summary-desktop');return art.inner_text()
 test('B07','Summary title, takeaways and tag hierarchy',summary)
 def tree():
  page.get_by_role('button',name='知识树',exact=True).click();page.get_by_text('展开 合成根节点 的子节点',exact=True).click();page.locator('[data-node-id="a-child"]').click()
  expect(page.get_by_role('region',name='节点内容')).to_contain_text(A['branches'][0]['children'][0]['content'])
  details['node_focus']=page.evaluate('({tag:document.activeElement.tagName,label:document.activeElement.getAttribute("aria-label")})')
  page.get_by_role('button',name='返回知识树',exact=True).click()
  focus=page.evaluate('document.activeElement.getAttribute("data-node-id")');assert focus=='a-child'
  page.keyboard.press('ArrowUp');details['tree_keyboard_focus']=page.evaluate('document.activeElement.getAttribute("data-node-id")')
  shot('04-tree-desktop');return {'return_focus':focus,'keyboard_focus':details['tree_keyboard_focus']}
 test('B08','Tree child expansion, complete text, return focus and keyboard',tree)
 def faq():
  page.get_by_role('button',name='常见问题',exact=True).click()
  for q in A['faq']:
   page.get_by_text(q['question'],exact=True).click();expect(page.locator('article')).to_contain_text(q['answer'])
  shot('05-faq-desktop');return page.locator('article').inner_text()
 test('B09','FAQ expansion and complete answers',faq)
 def search():
  page.get_by_role('searchbox').fill('合成');count(2);page.get_by_role('searchbox').fill('不存在的合成关键词');count(0);page.get_by_role('searchbox').fill('合成');count(2);return '2 → 0 → 2'
 test('B10','Search synthetic and no-result recovery',search)
 def favorite():
  select(A);page.get_by_role('button',name='☆ 收藏',exact=True).click();expect(page.get_by_role('button',name='★ 已收藏',exact=True)).to_have_attribute('aria-pressed','true')
  page.get_by_role('button',name='★ 只看收藏',exact=True).click();count(1);expect(page.get_by_role('navigation',name='卡片列表')).to_contain_text(A['title']);expect(page.get_by_role('button',name='随机一张',exact=True)).to_be_disabled()
  page.get_by_role('button',name='★ 只看收藏',exact=True).click();page.get_by_role('searchbox').fill('');count(2);select(B);select(A);return 'A favorite retained; filter cleared; A/B selectable'
 test('B11','Favorites-only, clear filters and card switching',favorite)
 def random():
  page.get_by_role('searchbox').fill('合成');seq=[title()]
  for i in range(6):
   old=title();page.get_by_role('button',name='随机一张',exact=True).click();expect(page.locator('article h2')).not_to_have_text(old);seq.append(title())
  expect(page.get_by_role('searchbox')).to_have_value('合成');select(A);expect(page.get_by_role('button',name='★ 已收藏',exact=True)).to_be_visible();page.get_by_role('searchbox').fill('');return seq
 test('B12','Six random switches preserve search/favorite state',random)
 def persistence():
  open_storage();page.evaluate('''() => {window.fontStates=[];new MutationObserver(()=>window.fontStates.push(document.querySelector('[data-testid="font-save-state"]').textContent)).observe(document.querySelector('[data-testid="font-save-state"]'),{childList:true,subtree:true,characterData:true})}''')
  page.get_by_role('combobox').select_option('large');expect(page.get_by_test_id('font-save-state')).to_have_text('字号已保存：大字');details['font_states']=page.evaluate('window.fontStates')
  page.get_by_role('button',name='知识树',exact=True).click();page.locator('[data-node-id="a-child"]').click();page.wait_for_timeout(700)
  page.reload(wait_until='networkidle');count(2);expect(page.locator('article h2')).to_have_text(A['title']);open_storage();expect(page.get_by_role('combobox')).to_have_value('large');expect(page.get_by_role('button',name='知识树',exact=True)).to_have_attribute('aria-pressed','true');expect(page.get_by_role('region',name='节点内容')).to_contain_text('这是子节点正文');expect(page.get_by_role('button',name='★ 已收藏',exact=True)).to_be_visible();shot('06-persistence');return {'font_states':details['font_states'],'large_after_reload':True,'card_favorite_node_after_reload':True}
 test('B13','Saving/Saved then reload preserves large, cards, favorite and node',persistence)
 def backup():
  open_storage();expect(page.locator('.backup-warning')).to_contain_text('未经加密')
  with page.expect_download() as event:page.get_by_role('button',name='导出完整备份',exact=True).click()
  d=event.value;assert d.failure() is None;path=ROOT/'synthetic-backup.json';d.save_as(str(path));data=path.read_bytes();obj=json.loads(data)
  details['backup']={'suggested_filename':d.suggested_filename,'download_failure':d.failure(),'saved_file_exists':path.is_file(),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'top_level_keys':list(obj),'ui_feedback':page.get_by_role('status').inner_text()};assert len(data)>1000
  shot('07-backup-feedback');return details['backup']
 test('B14','Plaintext warning, browser completed download, saved bytes and UI feedback',backup)
 def restore():
  open_storage();page.get_by_role('combobox').select_option('normal');expect(page.get_by_test_id('font-save-state')).to_have_text('字号已保存：标准');select(A);page.get_by_role('button',name='★ 已收藏',exact=True).click()
  page.get_by_role('button',name='恢复备份',exact=True).click();expect(page.get_by_role('group',name='确认恢复')).to_contain_text('替换当前全部卡片')
  page.get_by_label('恢复备份文件',exact=True).set_input_files(str(ROOT/'synthetic-backup.json'));expect(page.get_by_role('status')).to_contain_text('备份恢复成功');count(2);open_storage();expect(page.get_by_role('combobox')).to_have_value('large');select(A);expect(page.get_by_role('button',name='★ 已收藏',exact=True)).to_be_visible();return 'restored A/B, large, A favorite and reading state from completed synthetic backup'
 test('B15','Restore completed synthetic backup atomically in isolated library',restore)
 def bad_restore():
  (ROOT/'invalid-backup.json').write_text('{}');open_storage();page.get_by_role('button',name='恢复备份',exact=True).click();page.get_by_label('恢复备份文件',exact=True).set_input_files(str(ROOT/'invalid-backup.json'));expect(page.get_by_role('status')).not_to_contain_text('备份恢复成功');msg=page.get_by_role('status').inner_text();count(2);open_storage();expect(page.get_by_role('combobox')).to_have_value('large');select(A);expect(page.get_by_role('button',name='★ 已收藏',exact=True)).to_be_visible();return msg
 test('B16','Reject invalid backup and preserve synthetic library/settings',bad_restore)
 def sw():

  for _ in range(30):
   if page.evaluate('!!navigator.serviceWorker.controller'):break
   page.wait_for_timeout(250)
  assert page.evaluate('!!navigator.serviceWorker.controller')
  data=page.evaluate('''async()=>({controlled:!!navigator.serviceWorker.controller,controller:navigator.serviceWorker.controller?.scriptURL,registrations:await Promise.all((await navigator.serviceWorker.getRegistrations()).map(async r=>({scope:r.scope,active:r.active?.scriptURL,state:r.active?.state}))),caches:await Promise.all((await caches.keys()).map(async k=>({name:k,urls:(await (await caches.open(k)).keys()).map(r=>r.url)})))})''');details['service_worker']=data;assert data['registrations'] and data['caches'];assert any(any('/assets/main-' in u for u in x['urls']) for x in data['caches']);return data
 test('B17','SW registration, activation, control and Workbox precache inventory',sw)
 def offline():
  c.set_offline(True);page.reload(wait_until='networkidle');count(2);select(B);page.get_by_role('button',name='30 秒摘要',exact=True).click();expect(page.locator('article')).to_contain_text(B['summary']);assert page.evaluate('navigator.onLine') is False
  shot('08-offline-refresh');return {'online':page.evaluate('navigator.onLine'),'two_cards_readable':True,'from_service_worker_responses':sum(1 for x in network if x.get('from_service_worker'))}
 test('B18','Offline reload and read previously imported B',offline)
 c.close()
 c=launch(p,'acceptance-profile-verified');c.set_offline(True);page=c.pages[0];attach(c)
 def cold():
  page.goto(URL,wait_until='networkidle');count(2);select(A);page.get_by_role('button',name='常见问题',exact=True).click();page.get_by_text(A['faq'][0]['question'],exact=True).click();expect(page.locator('article')).to_contain_text(A['faq'][0]['answer']);shot('09-offline-browser-restart');return {'new_browser_process':True,'offline_before_navigation':True,'faq_readable':True,'controlled':page.evaluate('!!navigator.serviceWorker.controller')}
 test('B19','Offline cold browser process start with existing synthetic profile',cold)
 def reconnect():
  c.set_offline(False);page.reload(wait_until='networkidle');count(2);expect(page.locator('article h2')).to_have_text(A['title']);assert page.evaluate('navigator.onLine') is True;return 'online and two-card library recovered'
 test('B20','Network recovery and persistence after offline restart',reconnect)
 c.close()
 save()

import os,json,datetime,traceback
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path('/workspace/work/preview-review');OUT=ROOT/'evidence';URL='https://36e604de.001beta.pages.dev/'
A=json.loads((ROOT/'archive/docs/synthetic/mindflow-v1-work-example-a.json').read_text());B=json.loads((ROOT/'archive/docs/synthetic/mindflow-v1-work-example-b.json').read_text());rows=[];network=[];shots=[];details={};errors=[]
def save(): (OUT/'mobile-results.json').write_text(json.dumps({'observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'viewport':{'width':390,'height':844},'engine':'Chromium simulated mobile and CDP touch, not iPhone/WebKit','tests':rows,'details':details,'screenshots':shots,'page_errors':errors,'network':network},ensure_ascii=False,indent=2))
def test(id,name,fn):
 try: value=fn();rows.append({'id':id,'name':name,'status':'PASS','observed':value});print(id,'PASS',name,flush=True)
 except Exception as e:rows.append({'id':id,'name':name,'status':'FAIL','error':str(e),'trace':traceback.format_exc()});print(id,'FAIL',str(e),flush=True)
 save()
def shot(name,full=False):page.screenshot(path=str(OUT/(name+'.png')),full_page=full);shots.append(name+'.png')
def select(card):
 lib=page.locator('.library > details')
 if lib.get_attribute('open') is None:lib.locator('summary').first.click()
 page.get_by_role('navigation',name='卡片列表').get_by_role('button',name=card['title']).click();expect(page.locator('article h2')).to_have_text(card['title'])
def swipe(x1,y1,x2,y2):
 session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x1,'y':y1}]})
 for i in range(1,9):
  session.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x1+(x2-x1)*i/8,'y':y1+(y2-y1)*i/8}]});page.wait_for_timeout(25)
 session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});page.wait_for_timeout(450)
def dims():return page.evaluate('({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,y:scrollY,height:innerHeight,docHeight:document.documentElement.scrollHeight})')
with sync_playwright() as p:
 c=p.chromium.launch_persistent_context(str(ROOT/'mobile-profile'),executable_path='/usr/bin/chromium',headless=True,proxy={'server':os.environ['HTTPS_PROXY']},ignore_https_errors=False,viewport={'width':390,'height':844},is_mobile=True,has_touch=True,args=['--no-sandbox'])
 page=c.pages[0];page.on('pageerror',lambda e:errors.append(str(e)));c.on('request',lambda r:network.append({'url':r.url,'method':r.method,'type':r.resource_type,'post_data_bytes':len(r.post_data_buffer or b'')}));session=c.new_cdp_session(page)
 def first():
  r=page.goto(URL,wait_until='networkidle');assert r.status==200;expect(page.get_by_role('button',name='粘贴 JSON',exact=True)).to_be_visible();d=dims();assert d['scrollWidth']<=390;shot('10-mobile-empty');return d
 test('B21','390x844 empty first screen and no horizontal overflow',first)
 def imports():
  page.get_by_role('button',name='粘贴 JSON',exact=True).click();page.get_by_role('textbox',name='JSON 内容').fill(json.dumps(A,ensure_ascii=False));page.get_by_role('button',name='校验并导入',exact=True).click();expect(page.locator('article h2')).to_have_text(A['title']);page.get_by_label('导入卡片',exact=True).set_input_files(str(ROOT/'archive/docs/synthetic/mindflow-v1-work-example-b.json'));expect(page.locator('article h2')).to_have_text(B['title']);page.get_by_role('button',name='30 秒摘要',exact=True).click();expect(page.locator('article')).to_contain_text(B['summary']);page.evaluate('scrollTo(0,0)');shot('11-mobile-summary');return {'dimensions':dims(),'text':page.locator('article').inner_text()}
 test('B22','Mobile A/B import and summary readability',imports)
 def tree():
  page.get_by_role('button',name='知识树',exact=True).click();page.get_by_text('展开 合成根节点 的子节点',exact=True).click();page.locator('[data-node-id="b-child"]').click();expect(page.get_by_role('region',name='节点内容')).to_contain_text(B['branches'][0]['children'][0]['content']);page.get_by_role('button',name='返回知识树',exact=True).click();assert page.evaluate('document.activeElement.dataset.nodeId')=='b-child';shot('12-mobile-tree');return dims()
 test('B23','Mobile tree expansion and return to child',tree)
 def faq_font():
  page.get_by_role('button',name='常见问题',exact=True).click()
  for q in B['faq']:page.get_by_text(q['question'],exact=True).click();expect(page.locator('article')).to_contain_text(q['answer'])
  storage=page.locator('details.storage')
  if storage.get_attribute('open') is None:storage.locator('summary').first.click()
  page.get_by_role('combobox').select_option('large');expect(page.get_by_test_id('font-save-state')).to_have_text('字号已保存：大字');page.get_by_role('button',name='30 秒摘要',exact=True).click();page.evaluate('scrollTo(0,0)');shot('13-mobile-large');return {'font':'large','dimensions':dims()}
 test('B24','Mobile FAQ and saved large font',faq_font)
 def swipes():
  select(A);page.get_by_role('button',name='30 秒摘要',exact=True).click();page.locator('article .hook').scroll_into_view_if_needed();box=page.locator('article .hook').bounding_box();y=max(30,min(790,box['y']+box['height']/2));old=page.locator('article h2').inner_text();swipe(300,y,80,y);expect(page.locator('article h2')).not_to_have_text(old)
  after=page.locator('article h2').inner_text();swipe(80,y,300,y);expect(page.locator('article h2')).to_have_text(old);return {'left_result':after,'right_result':old,'touch_y':y}
 test('B25','Native simulated horizontal touch card switching both directions',swipes)
 def long_read():
  L=json.loads(json.dumps(B));L['title']='Mindflow B 公开合成长正文滚动测试';L['branches'][0]['id']='long-root';child=L['branches'][0]['children'][0];child['id']='long-child';child['children']=[{'id':'long-grandchild','title':'合成第三级长正文','summary':'公开合成滚动内容','content':'\n\n'.join(f'合成段落 {i:03d}：仅用于验收正文滚动和阅读位置；不包含私人信息。' for i in range(1,81)),'children':[]}]
  details['long_fixture']={'derivation':'official public B with unique title/id, third-level child and 80 public synthetic paragraphs','paragraph_count':80,'title':L['title']};(ROOT/'long-synthetic-card.json').write_text(json.dumps(L,ensure_ascii=False,indent=2));page.get_by_label('导入卡片',exact=True).set_input_files(str(ROOT/'long-synthetic-card.json'));expect(page.locator('article h2')).to_have_text(L['title']);page.get_by_role('button',name='知识树',exact=True).click();page.get_by_text('展开 合成根节点 的子节点',exact=True).click();page.get_by_text('展开 合成子节点 的子节点',exact=True).click();page.locator('[data-node-id="long-grandchild"]').click();expect(page.get_by_role('region',name='节点内容')).to_contain_text('合成段落 080')
  page.evaluate('scrollTo(0,1000)');page.wait_for_timeout(400);before=page.evaluate('scrollY');same=page.locator('article h2').inner_text();swipe(190,680,190,230);after=page.evaluate('scrollY');assert after>before;assert page.locator('article h2').inner_text()==same
  page.evaluate('scrollTo(0,2000)');page.wait_for_timeout(700);y=page.evaluate('scrollY');shot('14-mobile-long-scroll');page.reload(wait_until='networkidle');page.wait_for_timeout(800);new=page.evaluate('scrollY');assert abs(new-y)<=100;expect(page.get_by_role('region',name='节点内容')).to_contain_text('合成段落 080');details['scroll']={'before_vertical_touch':before,'after_vertical_touch':after,'saved_y':y,'reloaded_y':new}
  page.get_by_role('button',name='返回知识树',exact=True).click();assert page.evaluate('document.activeElement.dataset.nodeId')=='long-grandchild';return details['scroll']
 test('B26','Three-level tree, long content, vertical touch and refreshed reading position',long_read)
 def bounds():
  d=dims();assert d['scrollWidth']<=390
  page.evaluate('scrollTo(0,document.documentElement.scrollHeight)');page.wait_for_timeout(300);shot('15-mobile-bottom');details['button_sizes']=page.locator('button').evaluate_all('(els)=>els.filter(e=>e.getClientRects().length).map(e=>({text:e.textContent.trim(),width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}))');details['bottom_padding']=page.locator('.app').evaluate('e=>getComputedStyle(e).paddingBottom');return {'dimensions':d,'bottom':dims(),'button_sizes':details['button_sizes'],'bottom_padding':details['bottom_padding'],'safe_area_device_note':'notch/home-indicator not simulated; real safe area NOT VERIFIED'}
 test('B27','Mobile bounds, reachable controls and bottom layout',bounds)
 c.close();save()

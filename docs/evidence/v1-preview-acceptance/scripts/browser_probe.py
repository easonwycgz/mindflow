import os, json, platform, importlib.metadata, datetime
from pathlib import Path
from playwright.sync_api import sync_playwright

out=Path('/workspace/work/preview-review/evidence'); out.mkdir(parents=True, exist_ok=True)
url='https://36e604de.001beta.pages.dev/'
result={'observer':'B independent online acceptance', 'started_at':datetime.datetime.now(datetime.timezone.utc).isoformat(), 'url':url, 'platform':platform.platform(), 'playwright':importlib.metadata.version('playwright'), 'ignore_https_errors':False, 'certificate_trust_modified':False, 'attempts':[]}
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, proxy={'server':os.environ['HTTPS_PROXY']}, args=['--no-sandbox'])
    result['browser_version']=browser.version
    result['launch_args_explicit']=['--no-sandbox']
    result['proxy']='inherited HTTPS_PROXY; value omitted'
    for n in range(1,3):
        context=browser.new_context(ignore_https_errors=False, viewport={'width':1280,'height':900})
        page=context.new_page(); events=[]
        page.on('request', lambda r: events.append({'event':'request','method':r.method,'type':r.resource_type,'url':r.url}))
        page.on('requestfailed', lambda r: events.append({'event':'requestfailed','url':r.url,'failure':r.failure}))
        page.on('response', lambda r: events.append({'event':'response','url':r.url,'status':r.status}))
        page.on('pageerror', lambda e: events.append({'event':'pageerror','message':str(e)}))
        page.on('console', lambda m: events.append({'event':'console','type':m.type,'message':m.text}))
        attempt={'number':n,'new_isolated_context':True}
        try:
            response=page.goto(url,wait_until='networkidle',timeout=45000)
            attempt.update({'navigation':'success','status':response.status if response else None,'title':page.title(),'final_url':page.url,'text':page.locator('body').inner_text()})
        except Exception as e:
            attempt.update({'navigation':'error','error':str(e),'final_url':page.url})
        attempt['events']=events
        page.screenshot(path=str(out/f'browser-trust-attempt-{n}.png'),full_page=True)
        attempt['screenshot']=f'browser-trust-attempt-{n}.png'
        result['attempts'].append(attempt)
        context.close()
    browser.close()
result['finished_at']=datetime.datetime.now(datetime.timezone.utc).isoformat()
(out/'browser-trust.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
print(json.dumps(result,ensure_ascii=False,indent=2))

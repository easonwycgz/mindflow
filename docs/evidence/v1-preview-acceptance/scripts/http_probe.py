import urllib.request, urllib.parse, ssl, json, hashlib, datetime, struct, zipfile
from pathlib import Path
base='https://36e604de.001beta.pages.dev/'
root=Path('/workspace/work/preview-review'); out=root/'evidence'; out.mkdir(parents=True,exist_ok=True)
prov=json.loads((root/'archive/docs/evidence/v1-rc/build-provenance.json').read_text())
ctx=ssl.create_default_context()
class Redirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if urllib.parse.urlparse(newurl).scheme!='https' or urllib.parse.urlparse(newurl).netloc!=urllib.parse.urlparse(base).netloc: raise RuntimeError('Unexpected redirect: '+newurl)
        redirects.append({'from':req.full_url,'to':newurl,'status':code})
        return super().redirect_request(req,fp,code,msg,headers,newurl)
opener=urllib.request.build_opener(urllib.request.HTTPSHandler(context=ctx),Redirects())
result={'observer':'B independent HTTP observations', 'started_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'base_url':base,'user_agent':'MindflowV1-IndependentAcceptanceB/1.0','tls_verify_mode':str(ctx.verify_mode),'hostname_verification':ctx.check_hostname,'trust':'inherited system/Python CA and environment proxy; not browser trust or origin certificate-chain proof','resources':[]}
for entry in prov['artifact']['entries']+[{'path':'','sha256':next(e['sha256'] for e in prov['artifact']['entries'] if e['path']=='index.html')}]:
    if entry['path']=='_headers':continue
    redirects=[]; row={'path':entry['path'] or '/','expected_sha256':entry['sha256']}
    try:
        with opener.open(urllib.request.Request(base+entry['path'],headers={'User-Agent':result['user_agent']}),timeout=35) as r:
            data=r.read(); row.update({'status':r.status,'final_url':r.url,'redirects':redirects,'headers':dict(r.headers.items()),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
            row['digest_match']=row['sha256']==entry['sha256']
            try:
                sock=r.fp.raw._sock
                row['tls']={'version':sock.version(),'cipher':sock.cipher(),'certificate':sock.getpeercert()}
            except Exception: pass
            if entry['path']=='manifest.webmanifest':row['manifest']=json.loads(data)
            if entry['path'].endswith('.png'):row['png_dimensions']=struct.unpack('>II',data[16:24])
    except Exception as e: row['error']=str(e)
    result['resources'].append(row)
result['finished_at']=datetime.datetime.now(datetime.timezone.utc).isoformat()
(out/'http-observations.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
print(json.dumps([{'path':r['path'],'status':r.get('status'),'match':r.get('digest_match'),'type':r.get('headers',{}).get('Content-Type'),'redirects':r.get('redirects'),'error':r.get('error')} for r in result['resources']],ensure_ascii=False,indent=2))

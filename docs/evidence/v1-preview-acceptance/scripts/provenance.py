import json,zipfile,hashlib,subprocess,datetime
from pathlib import Path,PurePosixPath
root=Path('/workspace/work/preview-review'); prov=json.loads((root/'archive/docs/evidence/v1-rc/build-provenance.json').read_text()); archive=Path('/workspace/artifacts/mindflow-v1-rc-df48c9d.zip')
expected={e['path']:e for e in prov['artifact']['entries']}; rows=[]
with zipfile.ZipFile(archive) as z:
 files=[i for i in z.infolist() if not i.is_dir()]
 for i in files:
  data=z.read(i);p=PurePosixPath(i.filename);e=expected.get(i.filename,{})
  rows.append({'path':i.filename,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'matches_governance':len(data)==e.get('bytes') and hashlib.sha256(data).hexdigest()==e.get('sha256'),'safe_path':not p.is_absolute() and '..' not in p.parts,'is_symlink':((i.external_attr>>16)&0o170000)==0o120000})
 headers=z.read('_headers').decode()
source_headers=subprocess.check_output(['git','-C','/workspace/mindflow','show','df48c9d2eae22f3fc97487db80ab61b59813adc9:public/_headers']).decode()
tree=subprocess.check_output(['git','-C','/workspace/mindflow','rev-parse','df48c9d2eae22f3fc97487db80ab61b59813adc9^{tree}']).decode().strip()
manifest=(root/'archive/docs/evidence/v1-rc/dist-sha256.txt').read_text();manifest_rows={line.split()[1]:line.split()[0] for line in manifest.splitlines() if line.strip()}
result={'observer':'B independent original ZIP rehash; not a rebuild','observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'zip_bytes':archive.stat().st_size,'zip_sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'zip_matches_governance':archive.stat().st_size==prov['artifact']['bytes'] and hashlib.sha256(archive.read_bytes()).hexdigest()==prov['artifact']['sha256'],'files':rows,'exact_13_unique_expected_files':len(files)==13 and len(set(i.filename for i in files))==13 and set(i.filename for i in files)==set(expected),'source_tree':tree,'tree_matches_governance':tree==prov['sourceTree'],'headers_match_frozen_source':headers==source_headers,'headers':headers,'two_governance_manifests_agree':manifest_rows=={p:e['sha256'] for p,e in expected.items()},'build_execution':'NOT PERFORMED; historic build commands/CI remain A provenance'}
http=json.loads((root/'evidence/http-observations.json').read_text());required={}
for line in headers.splitlines():
 if line.startswith('  ') and ':' in line and not line.strip().startswith('Cache-Control:'):
  k,v=line.strip().split(':',1);required[k.lower()]=v.strip()
result['online_header_checks']=[]
for row in http['resources']:
 h={k.lower():v for k,v in row.get('headers',{}).items()}
 result['online_header_checks'].append({'path':row['path'],'four_global_headers_match':all(h.get(k)==v for k,v in required.items()),'cache_control':h.get('cache-control'),'content_type':h.get('content-type'),'sw_no_cache':h.get('cache-control')=='no-cache' if row['path']=='sw.js' else None})
(root/'evidence/provenance-and-headers.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
print(json.dumps({k:v for k,v in result.items() if k not in ['files','headers']},ensure_ascii=False,indent=2))

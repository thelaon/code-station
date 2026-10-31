"""Check an independently built framework, without any question bank files."""
from pathlib import Path
import argparse,base64,hashlib,io,json,re,subprocess,tempfile,zipfile
from source_notices import strip_notice,container,START,CHANGED_HEADERS
ROOT=Path(__file__).resolve().parents[1]
def main():
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--html',type=Path,default=ROOT/'dist/代码航站.html');ap.add_argument('--node',required=True);args=ap.parse_args()
    p=args.html.resolve();html=p.read_text('utf-8');checks=[]
    def check(name,ok):
        checks.append({'check':name,'ok':bool(ok)})
        if not ok:raise ValueError(name)
    def block(rid):return re.search(r'<script[^>]*id="'+rid+r'"[^>]*>(.*?)</script>',html,re.S)[1]
    for rid in ['bank-data','blank-data','fix-data','programming-data']:
        data=json.loads(block(rid));check(rid+'-empty',not data.get('papers') and not data.get('questions'))
    check('framework-flag',json.loads(block('bank-data')).get('framework') is True)
    check('independent-storage','cqframe.packs.v1' in html and 'cquiz.' not in html)
    check('no-question-images',not re.search(r'data:image/(?:png|jpeg);base64,',html))
    check('no-external-script-or-style',not re.search(r'<script[^>]+src=|<link[^>]+href=',html,re.I))
    check('no-unresolved-tokens',not re.search(r'====[-A-Z]+====',html))
    check('correct-byte-stamp',int(re.search(r"var BUILD = '[^']* / (\d+)B';",html)[1])==p.stat().st_size)
    version=json.loads((ROOT/'build-manifest.json').read_text('utf-8'))['app_version']
    check('application-version',"var APP_VERSION = '%s';"%version in html)
    for rid,name in [('res-tcc','tcc.wasm'),('res-libc','libc.wasm')]:check(rid+'-binary-match',base64.b64decode(block(rid))==(ROOT/'vendor/c-runtime'/name).read_bytes())
    pins=json.loads((ROOT/'vendor/c-runtime/pins.json').read_text('utf-8'))
    for name,entry in pins['resources'].items():check('runtime-pin:'+name,hashlib.sha256((ROOT/'vendor/c-runtime'/name).read_bytes()).hexdigest()==entry['sha256'])
    notices=json.loads(block('third-party-data'));covered=[]
    project=notices['project'];check('project-maintainer-and-mit',project['maintainer']=='thelaon' and project['maintainer_url']=='https://github.com/thelaon' and project['license'].startswith('MIT'))
    check('project-scope-and-feedback-embedded','LICENSE-SCOPE.md' in notices['license_texts'] and 'COPYRIGHT.md' in notices['license_texts'] and notices['license_texts']['LICENSE']['text']==(ROOT/'LICENSE').read_bytes().decode('utf-8'))
    source=notices['source_archive'];source_raw=base64.b64decode(source['base64']);source_path=ROOT/json.loads((ROOT/'build-manifest.json').read_text('utf-8'))['third_party']['source_archive']
    check('corresponding-source-embedded',source_raw==source_path.read_bytes() and hashlib.sha256(source_raw).hexdigest()==source['sha256'])
    with zipfile.ZipFile(io.BytesIO(source_raw)) as archive:
        annotations=json.loads(archive.read('ANNOTATIONS.json'));check('modified-source-notice-coverage',len(annotations)==11)
        for name,entry in annotations.items():
            raw=archive.read(name);original=container(raw,False) if name.endswith('_ide-resources-patched.js') else strip_notice(raw)
            check('source-notice:'+name,START.encode() in raw and hashlib.sha256(raw).hexdigest()==entry['after_sha256'] and hashlib.sha256(original).hexdigest()==entry['before_sha256'])
        header_js=archive.read('_tcc_test/wasm/_ide-resources-patched.js').decode('utf-8')
        marked={name for name,b64 in re.findall(r'"(/include/[^"\n]+)"\s*:\s*"([A-Za-z0-9+/=]+)"',header_js) if START.encode() in base64.b64decode(b64)}
        check('changed-embedded-header-notices',marked=={'/include/'+name for name in CHANGED_HEADERS})
        source_manifest=json.loads(archive.read('SOURCE-MANIFEST.json'))
        check('source-archive-file-manifest',all(hashlib.sha256(archive.read(n)).hexdigest()==v['sha256'] for n,v in source_manifest.items()))
    for item in notices['components']:
        for entry in item['artifacts']:
            covered.append(entry['path']);check('notice-artifact:'+entry['path'],hashlib.sha256((ROOT/entry['path']).read_bytes()).hexdigest()==entry['sha256'])
    check('notices-cover-bundled-vendor',len(covered)==len(pins['resources']) and set(covered)=={'vendor/c-runtime/'+name for name in pins['resources']})
    for name,entry in notices['license_texts'].items():
        raw=(ROOT/name).read_bytes();check('license-text:'+name,entry['text']==raw.decode('utf-8') and entry['sha256']==hashlib.sha256(raw).hexdigest())
    with tempfile.TemporaryDirectory(prefix='syntax-',dir=p.parent) as temp:
        count=0
        for i,m in enumerate(re.finditer(r'<script\b([^>]*)>(.*?)</script\s*>',html,re.S|re.I)):
            if 'application/json' in m[1] or re.search(r'id="res-(tcc|libc)"',m[1]):continue
            f=Path(temp)/('block-'+str(i)+'.js');f.write_text(m[2],encoding='utf-8');r=subprocess.run([args.node,'--check',str(f)],capture_output=True,text=True,encoding='utf-8',errors='replace')
            if r.returncode:raise ValueError(r.stderr)
            count+=1
        check('javascript-and-workers-syntax',count>=8)
    meta=json.loads((p.parent/(p.stem+'.build.json')).read_text('utf-8'))
    check('build-profile',meta['profile'] in ('development','public') and "var APP_PROFILE = '%s';"%meta['profile'] in html)
    if meta['profile']=='public':check('public-notices-no-progress',not notices.get('status') and all('pending' not in item for item in notices['components']))
    check('metadata-version',meta['app_version']==version)
    check('artifact-sha256',meta['html_sha256']==hashlib.sha256(p.read_bytes()).hexdigest())
    for name,entry in meta['inputs'].items():check('input:'+name,hashlib.sha256((ROOT/name).read_bytes()).hexdigest()==entry['sha256'])
    print(json.dumps({'passed':len(checks),'failed':0,'javascript_blocks':count},ensure_ascii=False))
if __name__=='__main__':main()

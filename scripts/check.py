"""Check an independently built framework, without any question bank files."""
from pathlib import Path
import argparse,base64,hashlib,json,re,subprocess,tempfile
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
    for rid,name in [('res-tcc','tcc.wasm'),('res-libc','libc.wasm')]:check(rid+'-binary-match',base64.b64decode(block(rid))==(ROOT/'vendor/c-runtime'/name).read_bytes())
    pins=json.loads((ROOT/'vendor/c-runtime/pins.json').read_text('utf-8'))
    for name,entry in pins['resources'].items():check('runtime-pin:'+name,hashlib.sha256((ROOT/'vendor/c-runtime'/name).read_bytes()).hexdigest()==entry['sha256'])
    with tempfile.TemporaryDirectory(prefix='syntax-',dir=p.parent) as temp:
        count=0
        for i,m in enumerate(re.finditer(r'<script\b([^>]*)>(.*?)</script\s*>',html,re.S|re.I)):
            if 'application/json' in m[1] or re.search(r'id="res-(tcc|libc)"',m[1]):continue
            f=Path(temp)/('block-'+str(i)+'.js');f.write_text(m[2],encoding='utf-8');r=subprocess.run([args.node,'--check',str(f)],capture_output=True,text=True,encoding='utf-8',errors='replace')
            if r.returncode:raise ValueError(r.stderr)
            count+=1
        check('javascript-and-workers-syntax',count>=8)
    meta=json.loads((p.parent/(p.stem+'.build.json')).read_text('utf-8'))
    check('artifact-sha256',meta['html_sha256']==hashlib.sha256(p.read_bytes()).hexdigest())
    for name,entry in meta['inputs'].items():check('input:'+name,hashlib.sha256((ROOT/name).read_bytes()).hexdigest()==entry['sha256'])
    print(json.dumps({'passed':len(checks),'failed':0,'javascript_blocks':count},ensure_ascii=False))
if __name__=='__main__':main()

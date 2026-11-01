"""Build the data-free offline application with Python's standard library only."""
from pathlib import Path
import argparse,base64,datetime,hashlib,json,re,uuid,os,tempfile,shutil

ROOT=Path(__file__).resolve().parent
EMPTY={
 '====DSH-BANK-DATA====':{'version':1,'framework':True,'papers':[]},
 '====DSH-BLANK-DATA====':{'version':1,'kind':'blank','papers':[]},
 '====DSH-FIX-DATA====':{'version':1,'kind':'fix','papers':[],'questions':[]},
 '====CQ-PROGRAMMING-DATA====':{'version':1,'questions':[]},
}
def sha(data):return hashlib.sha256(data).hexdigest()

def install_pair(output,raw,report):
    """Stage both files; interrupted installs are rolled back on the next build."""
    metadata=output.parent/(output.stem+'.build.json')
    journal=output.parent/('.'+output.name+'.transaction.json')
    targets=[output,metadata]
    def restore(record):
        if not isinstance(record,dict) or not isinstance(record.get('stage'),str) or not isinstance(record.get('existed'),list) or len(record['existed'])!=2 or any(type(v) is not bool for v in record['existed']):raise ValueError('Invalid build recovery record')
        stage=(output.parent/record['stage']).resolve()
        if not stage.is_relative_to(output.parent) or not stage.name.startswith('.cquiz-build-'):raise ValueError('Invalid build recovery directory')
        for i,target in enumerate(targets):
            if record['existed'][i]:
                shutil.copyfile(stage/('before-'+str(i)),stage/('restore-'+str(i)));os.replace(stage/('restore-'+str(i)),target)
            elif target.exists():target.unlink()
        journal.unlink();shutil.rmtree(stage)
    if journal.exists():restore(json.loads(journal.read_text('utf-8')))
    stage=output.parent/('.cquiz-build-'+uuid.uuid4().hex)
    stage.mkdir()
    record={'stage':stage.name,'existed':[p.exists() for p in targets]}
    try:
        for i,p in enumerate(targets):
            if p.exists():shutil.copyfile(p,stage/('before-'+str(i)))
        (stage/'next-html').write_bytes(raw)
        (stage/'next-meta').write_bytes((json.dumps(report,ensure_ascii=False,indent=2)+'\n').encode('utf-8'))
        journal.write_text(json.dumps(record),encoding='utf-8')
        try:
            os.replace(stage/'next-html',output);os.replace(stage/'next-meta',metadata)
        except BaseException:
            restore(record);raise
        journal.unlink()
    finally:
        if stage.exists() and not journal.exists():shutil.rmtree(stage)
def build(output,build_id=None,stamp=None,profile=None):
    inputs={}
    def read(name,binary=False):
        p=(ROOT/name).resolve()
        if not p.is_relative_to(ROOT):raise ValueError('Source path leaves project: '+name)
        raw=p.read_bytes();inputs[name]={'bytes':len(raw),'sha256':sha(raw)}
        return raw if binary else raw.decode('utf-8').replace('\r\n','\n')
    spec=json.loads(read('build-manifest.json'))
    if spec.get('version')!=1:raise ValueError('Unsupported build manifest')
    app_version=spec['app_version']
    if not isinstance(app_version,str) or not re.fullmatch(r'v(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)',app_version):raise ValueError('Invalid app version')
    profile=profile or spec.get('default_profile','development')
    if profile not in ('development','public'):raise ValueError('Invalid build profile')
    def join(names):return '\n'.join(read(name) for name in names)
    template=read(spec['template']);engine=join(spec['engine']);resources=[]
    for rid,names,encoding in spec['resources']:
        if encoding=='base64':body=''.join(base64.b64encode(read(n,True)).decode('ascii') for n in names)
        elif encoding=='text':body=join(names)
        else:raise ValueError('Unsupported resource encoding: '+encoding)
        if '</script' in body.lower():raise ValueError('Unsafe inline resource: '+rid)
        resources.append('<script id="%s" type="text/plain">%s</script>'%(rid,body))
    notice_spec=spec['third_party']
    notices=json.loads(read(notice_spec['inventory']))
    notices['project']=json.loads(read(notice_spec['project_notice']))
    if notices.get('version')!=1:raise ValueError('Unsupported third-party inventory')
    if profile=='public':
        public=json.loads(read(notice_spec['public_notice']))
        notices.pop('status',None);notices['scope']=public['scope']
        notices['project'].update(public['project'])
        for item in notices['components']:
            item['source']=public['sources'][item['id']]
            item.pop('pending',None)
            item.pop('version',None)
    texts={}
    for name in notice_spec['texts']:
        raw=read(name,True)
        texts[name]={'text':raw.decode('utf-8'),'sha256':sha(raw)}
    listed=[]
    for item in notices['components']:
        if item.get('license_file') and item['license_file'] not in texts:raise ValueError('Missing third-party license: '+item['license_file'])
        item['artifacts']=[]
        for name in item['files']:
            if name not in inputs:raise ValueError('Unbuilt third-party artifact: '+name)
            listed.append(name);item['artifacts'].append({'path':name,**inputs[name]})
    vendor_files=[name for _,names,_ in spec['resources'] for name in names if name.startswith('vendor/')]
    if len(listed)!=len(set(listed)) or set(listed)!=set(vendor_files):raise ValueError('Third-party inventory must cover every bundled vendor file exactly once')
    notices['license_texts']=texts
    wabt_record=json.loads(read(notice_spec['wabt_notice_record']))
    if inputs['vendor/c-runtime/wabt.js']['sha256']!=wabt_record['artifact_sha256']:raise ValueError('WABT notice record does not match runtime')
    supplement=texts[wabt_record['supplemental_file']]
    if supplement['sha256']!=wabt_record['supplemental_sha256']:raise ValueError('Supplemental WABT notice fingerprint mismatch')
    for entry in wabt_record['parts']:
        raw=read(entry['file'],True)
        if sha(raw)!=entry['sha256'] or raw.decode('utf-8') not in supplement['text']:raise ValueError('Missing or changed WABT attribution part: '+entry['file'])
    archive_name=notice_spec['source_archive'];archive_raw=read(archive_name,True)
    notices['source_archive']={'filename':Path(archive_name).name,'bytes':len(archive_raw),'sha256':sha(archive_raw),'base64':base64.b64encode(archive_raw).decode('ascii')}
    notice_json=json.dumps(notices,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c').replace('>','\\u003e').replace('&','\\u0026')
    replacements={key:json.dumps(value,ensure_ascii=False,separators=(',',':')) for key,value in EMPTY.items()}
    replacements['====CQ-THIRD-PARTY====']=notice_json
    replacements.update({'====CQ-BOOTSTRAP====':read(spec['bootstrap']),'====DSH-FIX-CODE====':read(spec['frontend']),'====DSH-FIX-ENGINE====':engine,'====DSH-FIX-RES====':'\n'.join(resources),'====CQ-VISUAL-STYLE====':join(spec['styles']),'====CQ-VISUAL-CODE====':join(spec['scripts'])})
    for token,value in replacements.items():
        if template.count(token)!=1:raise ValueError('Expected exactly one placeholder: '+token)
        template=template.replace(token,value)
    if re.search(r'====[-A-Z]+====',template):raise ValueError('Unresolved placeholder')
    build_id=build_id or uuid.uuid4().hex
    if not re.fullmatch(r'[A-Za-z0-9._-]{1,80}',build_id):raise ValueError('Invalid build id')
    stamp=stamp or datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).strftime('%Y-%m-%d %H:%M')
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2} \d{2}:\d{2}',stamp):raise ValueError('Invalid timestamp')
    template=template.replace("var DATA_BUILD = 'dev';","var DATA_BUILD = '%s';"%build_id)
    if template.count("var APP_VERSION = 'dev';")!=1:raise ValueError('Missing application version')
    template=template.replace("var APP_VERSION = 'dev';","var APP_VERSION = '%s';"%app_version)
    if template.count("var APP_PROFILE = 'development';")!=1:raise ValueError('Missing application profile')
    template=template.replace("var APP_PROFILE = 'development';","var APP_PROFILE = '%s';"%profile)
    if template.count("var BUILD = 'dev';")!=1:raise ValueError('Missing build stamp')
    size=0
    while True:
        final=template.replace("var BUILD = 'dev';","var BUILD = '%s / %dB';"%(stamp,size));raw=final.encode('utf-8')
        if len(raw)==size:break
        size=len(raw)
    output=Path(output).resolve()
    protected=[(ROOT/n).resolve() for n in inputs]
    if output.suffix.lower()!='.html' or output in protected or any(output.is_relative_to(ROOT/n) for n in ['src','vendor','scripts','docs','licenses']):raise ValueError('Output must be an HTML artifact outside source directories')
    output.parent.mkdir(parents=True,exist_ok=True)
    report={'product':'代码航站','app_version':app_version,'profile':profile,'builtin_questions':0,'storage_prefix':'cqframe.','build_id':build_id,'stamp':stamp,'html_bytes':size,'html_sha256':sha(raw),'inputs':inputs,'resources':{rid:sha(re.search(r'<script[^>]*id="'+rid+r'"[^>]*>(.*?)</script>',final,re.S)[1].encode()) for rid,_,_ in spec['resources']}}
    install_pair(output,raw,report)
    return report
def main():
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--output',type=Path,default=ROOT/'dist/代码航站.html');ap.add_argument('--build-id',help='Fixed id for reproducibility checks; normal builds generate a new id');ap.add_argument('--stamp',help='Fixed timestamp: YYYY-MM-DD HH:MM');ap.add_argument('--profile',choices=['development','public'],help='Private test details or concise public UI');args=ap.parse_args()
    result=build(args.output,args.build_id,args.stamp,args.profile);print(json.dumps({'output':str(args.output.resolve()),'profile':result['profile'],'bytes':result['html_bytes'],'builtin_questions':0,'sha256':result['html_sha256']},ensure_ascii=False))
if __name__=='__main__':main()

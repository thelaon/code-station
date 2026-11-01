"""Export public source and a concise end-user package; preserve the private test HTML."""
from pathlib import Path
import hashlib,json,shutil,subprocess,sys,tempfile,zipfile
from audit_release import ROOT,audit_files

def write_zip(dest,top,files):
    with zipfile.ZipFile(dest,'w',compression=zipfile.ZIP_DEFLATED) as z:
        for name,data in sorted(files.items()):
            info=zipfile.ZipInfo(top+'/'+name,(2026,10,31,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;z.writestr(info,data)
    return {'filename':dest.name,'files':len(files),'bytes':dest.stat().st_size,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()}

def main():
    report=audit_files()
    if report['findings']:raise ValueError('Release audit has findings; inspect scripts/audit_release.py output before export')
    version=json.loads((ROOT/'build-manifest.json').read_text('utf-8'))['app_version']
    meta=json.loads((ROOT/'做题器.build.json').read_text('utf-8'))
    if meta['app_version']!=version or hashlib.sha256((ROOT/'做题器.html').read_bytes()).hexdigest()!=meta['html_sha256']:raise ValueError('Rebuild the HTML before export')
    for name,entry in meta['inputs'].items():
        if hashlib.sha256((ROOT/name).read_bytes()).hexdigest()!=entry['sha256']:raise ValueError('Stale build input: '+name)
    dist=ROOT/'dist';dist.mkdir(exist_ok=True)
    # Do not replace the private root entry. Public UI is a separate build, not a user setting.
    user_dir=dist/'发行版';user_dir.mkdir(exist_ok=True)
    public_id=meta['build_id'] if meta['profile']=='public' else meta['build_id']+'.public'
    common=['--build-id',public_id,'--stamp',meta['stamp'],'--profile','public']
    subprocess.run([sys.executable,'-X','utf8',str(ROOT/'build.py'),'--output',str(user_dir/'做题器.html'),*common],check=True)
    with tempfile.TemporaryDirectory(prefix='public-source-',dir=dist) as temp:
        stage=Path(temp)
        for name in report['files']:
            target=stage/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/name,target)
        spec=json.loads((stage/'build-manifest.json').read_text('utf-8'));spec['default_profile']='public'
        (stage/'build-manifest.json').write_text(json.dumps(spec,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
        subprocess.run([sys.executable,'-X','utf8',str(stage/'build.py'),'--output',str(stage/'做题器.html'),*common],check=True)
        if (stage/'做题器.html').read_bytes()!=(user_dir/'做题器.html').read_bytes():raise ValueError('Public source and standalone UI differ')
        public=audit_files(stage)
        if public['findings']:raise ValueError('Exported public source has audit findings')
        files={name:(stage/name).read_bytes() for name in public['files']}
        files['PUBLIC-MANIFEST.json']=(json.dumps({'app_version':version,'profile':'public','scope':'application HTML has no embedded questions; includes optional independently authored external demo JSON; no Git history or private evidence','files':public['files']},ensure_ascii=False,indent=2)+'\n').encode('utf-8')
        source_result=write_zip(dist/('code-station-'+version+'-public-candidate.zip'),'code-station-'+version,files)
    user_files={'做题器.html':(user_dir/'做题器.html').read_bytes(),'使用说明.md':(ROOT/'docs/发行版使用说明.md').read_bytes()}
    for name in ['LICENSE','LICENSE-SCOPE.md','COPYRIGHT.md']:user_files[name]=(ROOT/name).read_bytes()
    for name in ['TCC-COPYING.txt','WABT-LICENSE.txt','WABT-THIRD-PARTY-NOTICES.txt','LOCAL-MODIFICATIONS-NOTICE.txt']:user_files['licenses/'+name]=(ROOT/'licenses'/name).read_bytes()
    demo={name:(ROOT/'examples/demo-bank'/name).read_bytes() for name in ['示例题库.json','README.md','LICENSE','参考答案.md']}
    for name,data in demo.items():user_files['示例题包/'+name]=data
    for name,data in user_files.items():
        p=user_dir/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
    user_result=write_zip(dist/('代码航站-'+version+'-发行版.zip'),'代码航站-'+version,user_files)
    demo_result=write_zip(dist/('示例题库-'+version+'.zip'),'示例题库',demo)
    print(json.dumps({'source_candidate':source_result,'end_user_release':user_result,'demo_bank':demo_result},ensure_ascii=False))
if __name__=='__main__':main()

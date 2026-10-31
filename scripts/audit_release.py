"""Read-only release and Git-object audit. Findings contain locations, never secret values."""
from pathlib import Path, PurePosixPath
import argparse,base64,hashlib,io,json,re,subprocess,zipfile
ROOT=Path(__file__).resolve().parents[1]
RULES={
    'private-local-path':re.compile(rb'(?i)(?:[A-Z]:[\\/]+(?:Users|Application)[\\/]|/(?:Users|home)/[A-Za-z0-9_.-]{1,64}/|wxid_[a-z0-9_]{6,}|xwechat' + rb'_files)'),
    'private-key':re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----'),
    'github-token':re.compile(rb'(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})'),
    'cloud-access-key':re.compile(rb'\b(?:AKIA|ASIA)[A-Z0-9]{16}\b'),
    'service-secret':re.compile(rb'\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{32,}\b'),
    'credential-in-url':re.compile(rb'https?://[^\s/@:]+:[^\s/@]+@'),
}
PRIVATE_NAMES={'corresponding-source-stable.zip','COMPILER-REPORT.md','.env','id_rsa','id_ed25519'}

def selected(root=ROOT):
    spec=json.loads((root/'release-files.json').read_text('utf-8'));files=set(spec['files'])
    for name in spec['directories']:
        folder=root/name
        if not folder.is_dir():raise ValueError('Missing release directory: '+name)
        files.update(p.relative_to(root).as_posix() for p in folder.rglob('*') if p.is_file() and '__pycache__' not in p.parts and p.suffix!='.pyc')
    for name in sorted(files):
        p=root/name
        if not p.is_file() or p.is_symlink() or not p.resolve().is_relative_to(root.resolve()):raise ValueError('Invalid release file: '+name)
        if any(name==x or name.startswith(x+'/') for x in spec['excluded']):raise ValueError('Excluded release file: '+name)
    return sorted(files)

def scan_bytes(raw,location,findings,counts,depth=0):
    counts['scanned_items']+=1
    for kind,pattern in RULES.items():
        hits=list(pattern.finditer(raw))
        if hits:findings.append({'kind':kind,'location':location,'occurrences':len(hits)})
    if depth>3:raise ValueError('Excessive nested archive: '+location)
    if raw.startswith(b'PK\x03\x04'):
        with zipfile.ZipFile(io.BytesIO(raw)) as z:
            for info in z.infolist():
                path=PurePosixPath(info.filename)
                if path.is_absolute() or '..' in path.parts or path.name in PRIVATE_NAMES or '.git' in path.parts:
                    findings.append({'kind':'private-or-unsafe-archive-path','location':location+'!'+info.filename})
                if not info.is_dir():scan_bytes(z.read(info),location+'!'+info.filename,findings,counts,depth+1)
    # Inspect the actual application data and embedded source; do not confuse test fixtures with shipped questions.
    if b'<script' in raw and b'id="bank-data"' in raw and b'====DSH-BANK-DATA====' not in raw:
        for rid in [b'bank-data',b'blank-data',b'fix-data',b'programming-data']:
            m=re.search(rb'<script[^>]*id="'+rid+rb'"[^>]*>(.*?)</script>',raw,re.S)
            if not m:findings.append({'kind':'missing-data-boundary','location':location});continue
            try:data=json.loads(m[1])
            except (ValueError,UnicodeError):findings.append({'kind':'invalid-question-data','location':location});continue
            if data.get('papers') or data.get('questions'):findings.append({'kind':'nonempty-question-bank','location':location+'#'+rid.decode()})
        m=re.search(rb'<script[^>]*id="third-party-data"[^>]*>(.*?)</script>',raw,re.S)
        if m:
            data=json.loads(m[1]);archive=data.get('source_archive')
            if archive:scan_bytes(base64.b64decode(archive['base64'],validate=True),location+'#embedded-source',findings,counts,depth+1)

def audit_files(root=ROOT):
    findings=[];counts={'files':0,'bytes':0,'scanned_items':0};manifest={}
    for name in selected(root):
        raw=(root/name).read_bytes();counts['files']+=1;counts['bytes']+=len(raw)
        manifest[name]={'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}
        scan_bytes(raw,name,findings,counts)
    return {'scope':'public-allowlist-and-nested-source','counts':counts,'findings':findings,'files':manifest}

def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT)

def audit_history():
    findings=[];counts={'blobs':0,'commits':0,'scanned_items':0};commits=[];all_commit_paths=set()
    # Includes unreachable objects still in the local object database, not just the current checkout.
    for line in git('cat-file','--batch-all-objects','--batch-check=%(objectname) %(objecttype)').splitlines():
        oid,kind=line.decode('ascii').split()
        if kind not in ('blob','commit','tag'):continue
        raw=git('cat-file',kind,oid)
        if kind=='blob':counts['blobs']+=1
        if kind=='commit':
            counts['commits']+=1;emails=re.findall(rb'^(?:author|committer) .*?<([^>]+)>',raw,re.M)
            all_commit_paths.update(git('ls-tree','-r','--name-only',oid).decode('utf-8').splitlines())
            commits.append({'commit':oid,'identity':'GitHub noreply' if all(e.endswith(b'@users.noreply.github.com') for e in emails) else 'review-required'})
            if any(not e.endswith(b'@users.noreply.github.com') for e in emails):findings.append({'kind':'non-noreply-commit-identity','location':'git:'+oid})
        scan_bytes(raw,'git:'+oid,findings,counts)
    refs=git('for-each-ref','--format=%(refname)').decode().splitlines()
    paths=set(git('-c','core.quotepath=false','log','--all','--reflog','--name-only','--format=').decode('utf-8').splitlines())|all_commit_paths
    suspect=sorted({p for p in paths if p and (PurePosixPath(p).name in PRIVATE_NAMES or any(x in p.split('/') for x in ['local-origin-review','xwechat'+'_files']))})
    for name in suspect:findings.append({'kind':'private-history-path','location':name})
    return {'scope':'all-local-git-objects-plus-ref-paths','counts':counts,'refs':refs,'commit_identities':commits,'findings':findings,'limits':'Pattern and data-boundary checks plus manual review; not proof that every possible secret or legal issue is absent.'}

def main():
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--history',action='store_true');ap.add_argument('--output',type=Path);args=ap.parse_args()
    report={'public':audit_files()}
    if args.history:report['history']=audit_history()
    if args.output:
        args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    summary={k:{'counts':v['counts'],'findings':v['findings']} for k,v in report.items()};print(json.dumps(summary,ensure_ascii=False))
    if any(v['findings'] for v in report.values()):raise SystemExit(1)
if __name__=='__main__':main()

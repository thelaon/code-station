"""Build protection tests; all mutations are confined to temporary project copies."""
from pathlib import Path
import importlib.util,json,os,shutil,tempfile,unittest,subprocess,sys
ROOT=Path(__file__).resolve().parents[1]
class BuildTests(unittest.TestCase):
    def setUp(self):
        (ROOT/'dist').mkdir(exist_ok=True)
        self.temp=tempfile.TemporaryDirectory(dir=ROOT/'dist',prefix='build-test-');self.root=Path(self.temp.name)
        for name in ['src','vendor','licenses','third_party']:shutil.copytree(ROOT/name,self.root/name)
        for name in ['build.py','build-manifest.json','LICENSE','LICENSE-SCOPE.md','COPYRIGHT.md']:shutil.copyfile(ROOT/name,self.root/name)
        spec=importlib.util.spec_from_file_location('test_builder',self.root/'build.py');self.mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(self.mod)
    def tearDown(self):self.temp.cleanup()
    def test_source_output_rejected(self):
        for name in ['src/template.html','build.py','vendor/c-runtime/tcc.wasm']:
            p=self.root/name;before=p.read_bytes()
            with self.assertRaises(ValueError):self.mod.build(p)
            self.assertEqual(p.read_bytes(),before)
    def test_pair_rollback(self):
        output=self.root/'out.html';self.mod.build(output,'before','2026-10-29 12:00');meta=self.root/'out.build.json';before=[p.read_bytes() for p in [output,meta]];replace=self.mod.os.replace;failed=False
        def fault(a,b):
            nonlocal failed
            if Path(a).name=='next-meta' and not failed:failed=True;raise OSError('injected metadata failure')
            return replace(a,b)
        self.mod.os.replace=fault
        try:
            with self.assertRaises(OSError):self.mod.build(output,'after','2026-10-29 12:00')
        finally:self.mod.os.replace=replace
        self.assertEqual([p.read_bytes() for p in [output,meta]],before)
        self.assertFalse((self.root/'.out.html.transaction.json').exists())
    def test_reproducible(self):
        a=self.root/'a.html';b=self.root/'b.html';self.mod.build(a,'fixed','2026-10-29 12:00');self.mod.build(b,'fixed','2026-10-29 12:00');self.assertEqual(a.read_bytes(),b.read_bytes())
    def test_public_and_private_delivery_boundaries(self):
        import re
        private=self.root/'private.html';public=self.root/'public.html'
        a=self.mod.build(private,'fixed','2026-10-29 12:00','development');b=self.mod.build(public,'fixed','2026-10-29 12:00','public')
        def notice(p):return json.loads(re.search(r'<script id="third-party-data" type="application/json">(.*?)</script>',p.read_text('utf-8'),re.S)[1])
        x,y=notice(private),notice(public)
        self.assertEqual((a['profile'],b['profile']),('development','public'))
        self.assertTrue(x['status']);self.assertNotIn('status',y)
        self.assertTrue(all('pending' in item for item in x['components']));self.assertTrue(all('pending' not in item for item in y['components']))
        self.assertEqual(x['license_texts'],y['license_texts']);self.assertEqual(x['source_archive'],y['source_archive']);self.assertEqual(a['resources'],b['resources'])
        p=self.root/'build-manifest.json';spec=json.loads(p.read_text('utf-8'));spec['default_profile']='public';p.write_text(json.dumps(spec),encoding='utf-8')
        self.assertEqual(self.mod.build(self.root/'default.html','fixed','2026-10-29 12:00')['html_sha256'],b['html_sha256'])
    def test_license_required_and_embedded_safely(self):
        license=self.root/'licenses/WABT-LICENSE.txt';original=license.read_bytes()
        license.unlink()
        with self.assertRaises(FileNotFoundError):self.mod.build(self.root/'missing.html')
        text='</script><script>untrusted()</script>\n'+original.decode('utf-8');license.write_bytes(text.encode('utf-8'))
        self.mod.build(self.root/'safe.html')
        import re
        html=(self.root/'safe.html').read_text('utf-8');block=re.search(r'<script id="third-party-data" type="application/json">(.*?)</script>',html,re.S)[1]
        self.assertNotIn('</script>',block)
        self.assertEqual(json.loads(block)['license_texts']['licenses/WABT-LICENSE.txt']['text'],text)
    def test_vendor_inventory_required(self):
        p=self.root/'licenses/components.json';data=json.loads(p.read_text('utf-8'));data['components'].pop();p.write_text(json.dumps(data),encoding='utf-8')
        with self.assertRaisesRegex(ValueError,'every bundled vendor file'):self.mod.build(self.root/'incomplete.html')
    def test_wabt_supplement_required(self):
        p=self.root/'licenses/WABT-THIRD-PARTY-NOTICES.txt';p.write_bytes(p.read_bytes()+b'changed')
        with self.assertRaisesRegex(ValueError,'Supplemental WABT notice fingerprint mismatch'):self.mod.build(self.root/'stale-notice.html')
    def test_wabt_runtime_requires_new_notice_record(self):
        p=self.root/'vendor/c-runtime/wabt.js';p.write_bytes(p.read_bytes()+b'\n')
        with self.assertRaisesRegex(ValueError,'WABT notice record does not match runtime'):self.mod.build(self.root/'changed-runtime.html')
    def test_interrupted_install_recovers(self):
        output=self.root/'out.html';self.mod.build(output,'before','2026-10-29 12:00')
        runner=self.root/'crash.py';runner.write_text("import build,os\nfrom pathlib import Path\nreplace=os.replace\ndef crash(a,b):\n if Path(a).name=='next-meta':os._exit(73)\n return replace(a,b)\nos.replace=crash\nbuild.build(Path('out.html'),'interrupted','2026-10-29 12:00')\n",encoding='utf-8')
        r=subprocess.run([sys.executable,'-B',str(runner)],cwd=self.root,capture_output=True);self.assertEqual(r.returncode,73)
        self.assertTrue((self.root/'.out.html.transaction.json').exists())
        result=self.mod.build(output,'recovered','2026-10-29 12:00');self.assertEqual(result['html_sha256'],self.mod.sha(output.read_bytes()));self.assertFalse((self.root/'.out.html.transaction.json').exists())
    def test_semantic_version_format(self):
        p=self.root/'build-manifest.json';spec=json.loads(p.read_text('utf-8'))
        for version in ['0.2v','0.2.0','v0.2','v00.2.0','v0.02.0','v0.2.00']:
            spec['app_version']=version;p.write_text(json.dumps(spec),encoding='utf-8')
            with self.assertRaisesRegex(ValueError,'Invalid app version'):self.mod.build(self.root/'invalid.html')
        for version in ['v0.2.0','v1.0.0','v12.34.56']:
            spec['app_version']=version;p.write_text(json.dumps(spec),encoding='utf-8')
            self.assertEqual(self.mod.build(self.root/'valid.html')['app_version'],version)
if __name__=='__main__':unittest.main()

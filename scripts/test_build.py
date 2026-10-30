"""Build protection tests; all mutations are confined to temporary project copies."""
from pathlib import Path
import importlib.util,json,os,shutil,tempfile,unittest,subprocess,sys
ROOT=Path(__file__).resolve().parents[1]
class BuildTests(unittest.TestCase):
    def setUp(self):
        (ROOT/'dist').mkdir(exist_ok=True)
        self.temp=tempfile.TemporaryDirectory(dir=ROOT/'dist',prefix='build-test-');self.root=Path(self.temp.name)
        for name in ['src','vendor']:shutil.copytree(ROOT/name,self.root/name)
        for name in ['build.py','build-manifest.json']:shutil.copyfile(ROOT/name,self.root/name)
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
    def test_interrupted_install_recovers(self):
        output=self.root/'out.html';self.mod.build(output,'before','2026-10-29 12:00')
        runner=self.root/'crash.py';runner.write_text("import build,os\nfrom pathlib import Path\nreplace=os.replace\ndef crash(a,b):\n if Path(a).name=='next-meta':os._exit(73)\n return replace(a,b)\nos.replace=crash\nbuild.build(Path('out.html'),'interrupted','2026-10-29 12:00')\n",encoding='utf-8')
        r=subprocess.run([sys.executable,'-B',str(runner)],cwd=self.root,capture_output=True);self.assertEqual(r.returncode,73)
        self.assertTrue((self.root/'.out.html.transaction.json').exists())
        result=self.mod.build(output,'recovered','2026-10-29 12:00');self.assertEqual(result['html_sha256'],self.mod.sha(output.read_bytes()));self.assertFalse((self.root/'.out.html.transaction.json').exists())
if __name__=='__main__':unittest.main()

"""Add dated, reversible notices without claiming unknown historical edit dates."""
import argparse,base64,re
from pathlib import Path
STAMP='2026-10-31'
START='\n/* CODE-STATION MODIFICATION NOTICE\n'
END='END CODE-STATION MODIFICATION NOTICE */\n'
CHANGED_HEADERS={'errno.h','inttypes.h','limits.h','stdio.h','stdlib.h','tccdefs.h','time.h'}
def strip_notice(raw):
    at=raw.rfind(START.encode())
    return raw[:at] if at>=0 and raw.endswith(END.encode()) else raw
def annotate(raw,label,change):
    raw=strip_notice(raw)
    text=(START+'File: '+label+'\nThis is a locally modified Code Station project version, not an unmodified upstream file.\n'
          +'Upstream basis: 44670/tcc-wasm @ 8bff9fbc019a3008395eec4cda6e90752fb88ed9.\n'
          +'Changes: '+change+'\n'
          +'Development records include batches dated 2026-10-20 through 2026-10-27;\nthese are batch evidence, not asserted dates of every individual edit.\n'
          +'This notice and the annotated source edition were prepared on '+STAMP+'.\n'
          +'Existing copyright, license notices and exceptions remain applicable.\n'
          +'See licenses/LOCAL-MODIFICATIONS-NOTICE.txt and evidence/source-map.json.\n'+END)
    return raw+text.encode('utf-8')
def container(raw,marked=True):
    raw=strip_notice(raw)
    def replace(m):
        name=m[2].rsplit('/',1)[-1]
        if name not in CHANGED_HEADERS or m[2]!='/include/'+name:return m[0]
        original=base64.b64decode(m[4]);value=annotate(original,m[2],'Local header declarations, limits, format macros or target ABI definitions; see per-file provenance.') if marked else strip_notice(original)
        return m[1]+m[2]+m[3]+base64.b64encode(value).decode()+m[5]
    text=re.sub(r'(")(/include/[^"\n]+)("\s*:\s*")([A-Za-z0-9+/=]+)(")',replace,raw.decode('utf-8'))
    result=text.encode('utf-8')
    return annotate(result,'_ide-resources-patched.js','Generated container with seven locally changed headers; each changed embedded header carries its own notice.') if marked else result
if __name__=='__main__':
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('container',type=Path);args=ap.parse_args();args.container.write_bytes(container(args.container.read_bytes()))

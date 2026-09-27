from pathlib import Path
import json,hashlib,subprocess,sys,datetime

def read(p):return json.loads(Path(p).read_text())
def write(p,x):Path(p).write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
def digest(p):
 for attempt in range(3):
  try:return subprocess.run([sys.executable,'-c','import hashlib,sys;print(hashlib.sha256(open(sys.argv[1],"rb").read()).hexdigest())',str(p)],capture_output=True,text=True,timeout=5,check=True).stdout.strip()
  except subprocess.TimeoutExpired: print('Local hash read retry',str(p),flush=True)
 raise RuntimeError(str(p))
old=read('phases/phase-67-2026-09-27-baseline.json')
protected={p:digest(p) for p in old['unchangedStateSha256']}
write('phases/phase-68-2026-09-27-baseline.json',{'capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'registry':read('sources/registry.json'),'coverage':read('data/published/coverage.json'),'unchangedStateSha256':protected})
Path('phases/phase-68-2026-09-27-readme-before.md').write_text(Path('README.md').read_text())

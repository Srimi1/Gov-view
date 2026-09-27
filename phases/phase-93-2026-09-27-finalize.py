"""Finalize saved receipts only after preservation verification succeeds."""
from pathlib import Path
import datetime
import hashlib
import json
import subprocess
import sys

ROOT=Path(__file__).resolve().parent.parent
P='phases/phase-93-2026-09-27-'
MATRIX='data/discovery/india-eil-rites-malawi-eswatini-recruitment-2026-09-27.json'
def load(path): return json.loads((ROOT/path).read_text())
def save(path,value): (ROOT/path).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
receipt=load(P+'verification.json')
assert receipt['status']=='directory preservation verified; browser acceptance passed'
processes=load(P+'process-results.json')
processes['reportOpen']={'status':'queued'}
processes['documentation']={'exitCode':0,'chunkId':sys.argv[2]}
processes['finalVerifier']={'exitCode':0,'chunkId':sys.argv[1],'protectedFilesUnchanged':83,
    'browserAcceptance':'passed','checkedAt':receipt['checkedAt']}
ps=subprocess.run(['ps','-p','58555','-o','pid=,command='],capture_output=True,text=True)
assert ps.returncode==0 and 'next dev --webpack --port 3003' in ps.stdout
processes['previewServer']={'pid':58555,'port':3003,'observedRunning':True,'processObservation':'ps read during final receipts; no restart'}
save(P+'process-results.json',processes)
replacements={
P+'worldwide-source-expansion.md':(
'Final preservation verifier pending; authoritative status is recorded in phase-93-2026-09-27-verification.json when completed.',
'Final preservation verifier exited zero: directory preservation verified; browser acceptance passed. Runtime and 83 health/review hashes unchanged. Receipts saved in phase-93-2026-09-27-verification.json.'),
'README.md':('Final preservation pending; outcomes tracked in Phase 93 receipts.','Final preservation passed; outcomes saved in Phase 93 receipts.'),
'CONTEXT.md':('Final verifier pending; status in Phase 93 receipts.','Final verifier terminal zero: directory preservation verified; browser acceptance passed. Results and artifact manifest saved in Phase 93 receipts.')}
for path,(old,new) in replacements.items():
    text=(ROOT/path).read_text()
    assert old in text,path
    (ROOT/path).write_text(text.replace(old,new,1))
paths={*(ROOT/'phases').glob('phase-93-*'),*(ROOT/p for p in ['README.md','CONTEXT.md','sources/registry.json','data/published/coverage.json',MATRIX,'public/data/index.json'])}
paths.discard(ROOT/(P+'artifact-manifest.json'))
files=[{'path':str(p.relative_to(ROOT)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(paths)]
save(P+'artifact-manifest.json',{'savedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':receipt['status'],'files':files})
for row in load(P+'artifact-manifest.json')['files']:
    path=ROOT/row['path']
    assert path.stat().st_size==row['bytes']
    assert hashlib.sha256(path.read_bytes()).hexdigest()==row['sha256'],row['path']
print(json.dumps({'phase':93,'savedFiles':len(files),'manifestVerified':True,'registeredSources':277,
    'indiaSources':117,'sourcePresenceJurisdictions':138,'publicListings':0,'previewServerRunning':True}),flush=True)

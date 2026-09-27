"""Finalize saved receipts only after the preservation verifier succeeds."""
from pathlib import Path
import datetime
import hashlib
import json
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent
P = 'phases/phase-92-2026-09-27-'

def load(path):
    return json.loads((ROOT/path).read_text())

def save(path, value):
    (ROOT/path).write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n')

receipt=load(P+'verification.json')
assert receipt['status']=='directory preservation verified; browser acceptance passed'
assert receipt['healthAndReviewFilesUnchanged']==83
processes=load(P+'process-results.json')
processes['documentation']={'exitCode':0,'chunkId':'579647'}
processes['finalVerifier']={'exitCode':0,'sessionId':96970,'initialChunkId':'5f8529',
    'chunkId':sys.argv[1],'protectedFilesUnchanged':83,'browserAcceptance':'passed',
    'checkedAt':receipt['checkedAt']}
ps=subprocess.run(['ps','-p','58555','-o','pid=,command='],capture_output=True,text=True)
assert ps.returncode==0 and 'next dev --webpack --port 3003' in ps.stdout
processes['previewServer']={'pid':58555,'port':3003,'observedRunning':True,
    'processObservation':'ps read during final receipts; no restart'}
processes['reportOpen']={'status':'queued'}
processes['calendarCheck']={'exitCode':0,'chunkId':'33366b','date':'2026-09-10','weekday':'Thursday','originalConflictPreserved':True}
processes['executionNotes']=['Four orchestration syntax errors occurred before shell execution; no filesystem writes from those attempts. Corrected commands succeeded.']
save(P+'process-results.json',processes)

replacements={
    P+'worldwide-source-expansion.md':(
        'Final preservation verifier pending; authoritative status is recorded in `phase-92-2026-09-27-verification.json` when completed.',
        'Final preservation verifier exited zero: directory preservation verified; browser acceptance passed. Runtime and 83 health/review hashes unchanged; receipts saved in `phase-92-2026-09-27-verification.json`.'),
    'README.md':('Final preservation pending; outcomes tracked in Phase 92 receipts.',
        'Final preservation passed; outcomes saved in Phase 92 receipts.'),
    'CONTEXT.md':('Final verifier pending; status in Phase 92 receipts.',
        'Final verifier terminal zero: directory preservation verified; browser acceptance passed. Results and artifact manifest saved in Phase 92 receipts.'),
}
for path,(old,new) in replacements.items():
    text=(ROOT/path).read_text()
    assert old in text,path
    (ROOT/path).write_text(text.replace(old,new,1))

paths={*(ROOT/'phases').glob('phase-92-*'),*(ROOT/p for p in [
    'README.md','CONTEXT.md','sources/registry.json','data/published/coverage.json',
    'data/discovery/india-sail-gail-sierra-leone-liberia-recruitment-2026-09-27.json',
    'public/data/index.json'])}
paths.discard(ROOT/(P+'artifact-manifest.json'))
files=[{'path':str(p.relative_to(ROOT)),'bytes':p.stat().st_size,
    'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(paths)]
save(P+'artifact-manifest.json',{'savedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'status':receipt['status'],'files':files})
for row in load(P+'artifact-manifest.json')['files']:
    path=ROOT/row['path']
    assert path.stat().st_size==row['bytes']
    assert hashlib.sha256(path.read_bytes()).hexdigest()==row['sha256'],row['path']
print(json.dumps({'phase':92,'savedFiles':len(files),'manifestVerified':True,
    'registeredSources':272,'indiaSources':115,'sourcePresenceJurisdictions':136,
    'publicListings':0,'previewServerRunning':True}),flush=True)

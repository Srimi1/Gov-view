"""Verify discovery-only additions, published-data safety and protected state."""
from pathlib import Path
import datetime
import hashlib
import json
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent
P = 'phases/phase-70-2026-09-27-'
retries = []

def load(path):
    return json.loads((ROOT / path).read_text())

def digest(path):
    code = 'import hashlib,sys;h=hashlib.sha256();f=open(sys.argv[1],"rb");\nwhile True:\n b=f.read(1048576)\n if not b:break\n h.update(b)\nprint(h.hexdigest())'
    for attempt in range(3):
        try:
            r = subprocess.run([sys.executable, '-c', code, str(ROOT / path)], capture_output=True, text=True, timeout=5, check=True)
            return r.stdout.strip()
        except subprocess.TimeoutExpired:
            retries.append({'path':path,'attempt':attempt+1})
    raise RuntimeError('File cannot be hashed: ' + path)

b = load(P+'baseline.json')
r = load('sources/registry.json')
c = load('data/published/coverage.json')
assert r['sources'][:183] == b['registry']['sources'] and c[:70] == b['coverage']
assert {k:v for k,v in r.items() if k!='sources'} == {k:v for k,v in b['registry'].items() if k!='sources'}
assert len(r['sources']) == 188 and len(c) == 75
assert len({s['id'] for s in r['sources']}) == 188
assert sum(s['country']=='IN' for s in r['sources']) == 99
new = r['sources'][183:]
assert {s['country'] for s in new} == {'IS','EE','LV','LT','PL'}
assert new == load(P+'source-config.json')
for s in new:
    assert s['enabled'] is False and s['reviewRequired'] is True and s['connector']=='none'
    assert s['homepage'].startswith('https://') and s['discoveredFrom'].startswith('https://')
for row in c[70:]:
    assert row['status']=='no-verified-listings' and row['fixture'] is False
    assert row['lastSuccessfulFetchAt'] is None and row['lastValidatedAt'] is None
    assert row['connectedSourceCount']==0 and row['unresolvedGaps']
for path, sha in b['protectedFileHashes'].items():
    assert digest(path)==sha, path
app_paths = set(load('phases/phase-69-2026-09-27-baseline.json')['code']) | {'lib/source-directory.ts','lib/source-directory.test.ts'}
manifest69 = load('phases/phase-69-2026-09-27-artifact-manifest.json')
for row in manifest69['files']:
    if row['path'] in app_paths: assert digest(row['path']) == row['sha256'], row['path']
packets = list((ROOT/'data/review').glob('*.json'))
assert len(packets)==82
assert sum(len(json.loads(p.read_text())['cycles']) for p in packets)==328
assert not (ROOT/'data/review/in-mp-esb-steno-asi-2026.json').exists()
index = load('public/data/index.json')
assert index['total']==0 and not index['countries']
health = load('data/published/sources-status.json')
assert all(s['id'] not in health for s in new)
matrix = load('data/discovery/europe-public-source-matrix-2026-09-27.json')
assert len(matrix['sources'])==5 and matrix['rawOriginalsRetained'] is False
for entry in matrix['sources']:
    assert entry['registry'] in new
    assert set(entry['threeStageEligibility'].values())=={'needs verification'}
    for doc in entry['documents']:
        assert doc['rawOriginalRetained'] is False and doc['originalSha256'] is None
        assert doc['collectorSuccessfulFetchAt'] is None and doc['validatedAt'] is None
inventory = load('data/reference/jurisdictions.json')['jurisdictions']
assert len(inventory)==250 and set(s['country'] for s in r['sources']).issubset({j['code'] for j in inventory})
assert 'MAX_RETAINED_EVIDENCE_BYTES = 800 * 1024 * 1024' in (ROOT/'scripts/collect.ts').read_text()
body_files = [p for p in (ROOT/'data/evidence').rglob('*') if p.is_file()]
assert len(body_files)==2355 and sum(p.stat().st_size for p in body_files)==871622022
processes = load(P+'process-results.json')
assert processes['publicDataBuild']['exitCode']==processes['focusedTests']['exitCode']==0
focused = (ROOT/(P+'focused-tests.txt')).read_text()
assert 'pass 6' in focused and 'fail 0' in focused
browser = load(P+'browser-checks.json')
assert {page['country'] for page in browser['pages']}=={'IS','EE','LV','LT','PL'}
for page in browser['pages']:
    assert page['sourceCountOne'] and page['neverFetched'] and page['reviewWarning'] and page['noAdapter']
assert (ROOT/(P+'europe-source-discovery.png')).exists()
now = datetime.datetime.now(datetime.timezone.utc).isoformat()
receipt = {
    'checkedAt':now,'phase':70,'status':'verified discovery checkpoint',
    'registeredSources':188,'indiaSources':99,'sourcePresenceJurisdictions':75,'jurisdictionDenominator':250,'jurisdictionsWithoutRegisteredSource':175,
    'newDisabledSources':5,'previousSourcesUnchanged':183,'previousCoverageRowsUnchanged':70,'healthAndReviewFilesUnchanged':len(b['protectedFileHashes']),
    'pendingPackets':82,'pendingCycles':328,'publicListings':0,'newHealthTimestamps':0,
    'evidenceFiles':2355,'logicalEvidenceBytes':871622022,'collectorCapBytes':838860800,'evidenceBytesAdded':0,
    'focusedTests':{'passed':6,'failed':0,'exitCode':0},'publicDataBuild':{'exitCode':0},
    'priorFullSuite':{'phase':69,'passed':362,'failed':0,'typecheckExitCode':0,'runtimeFilesUnchanged':True,'rerunThisPhase':False},
    'browserPagesChecked':5,'localReadRetries':retries,
    'limitations':['Reader-only research; original bytes and current notice criteria not accepted.','Source presence is not complete authority/pathway coverage.','No human approval, connector acceptance, production build or worldwide audit.','Storage choice remains unanswered; collection pause and 800 MiB cap unchanged.'],
}
(ROOT/(P+'verification.json')).write_text(json.dumps(receipt,indent=2)+'\n')
paths = {* (ROOT/'phases').glob('phase-70-*'),
         *(ROOT/p for p in ['README.md','sources/registry.json','data/published/coverage.json','data/discovery/europe-public-source-matrix-2026-09-27.json','public/data/index.json'])}
paths.discard(ROOT/(P+'artifact-manifest.json'))
files = [{'path':str(p.relative_to(ROOT)),'bytes':p.stat().st_size,'sha256':digest(str(p.relative_to(ROOT)))} for p in sorted(paths)]
(ROOT/(P+'artifact-manifest.json')).write_text(json.dumps({'savedAt':now,'status':'verified discovery checkpoint','files':files},indent=2)+'\n')
print(json.dumps({'registeredSources':188,'sourcePresenceJurisdictions':75,'protectedFilesUnchanged':len(b['protectedFileHashes']),'focusedTests':6,'publicListings':0,'savedFiles':len(files)}),flush=True)

"""Verify narrowly scoped India research edits and preserve collection state."""
from pathlib import Path
import datetime
import hashlib
import json
import subprocess
import sys

ROOT=Path(__file__).resolve().parent.parent
P='phases/phase-76-2026-09-27-'
MATRIX='data/discovery/india-tgpsc-jal-shakti-reader-research-2026-09-27.json'
retries=[]

def load(path):
    return json.loads((ROOT/path).read_text())

def digest(path):
    code='import hashlib,sys;h=hashlib.sha256();f=open(sys.argv[1],"rb");\nwhile True:\n b=f.read(1048576)\n if not b:break\n h.update(b)\nprint(h.hexdigest())'
    for attempt in range(3):
        try:
            r=subprocess.run([sys.executable,'-c',code,str(ROOT/path)],capture_output=True,text=True,timeout=5,check=True)
            return r.stdout.strip()
        except subprocess.TimeoutExpired:
            retries.append({'path':path,'attempt':attempt+1})
    raise RuntimeError('File cannot be hashed: '+path)

b=load(P+'baseline.json');r=load('sources/registry.json');c=load('data/published/coverage.json')
config=load(P+'source-config.json');expected=json.loads(json.dumps(b['registry']))
assert set(config['updates'])=={'in-tg-recruitment','in-hp-jsv-recruitment'}
for s in expected['sources']:
    if s['id'] in config['updates']:s.update(config['updates'][s['id']])
assert r==expected
assert len(r['sources'])==210 and len({s['id'] for s in r['sources']})==210
assert sum(s['country']=='IN' for s in r['sources'])==99
assert len({s['country'] for s in r['sources']})==94
expected_c=json.loads(json.dumps(b['coverage']))
row=next(x for x in expected_c if x['jurisdictionCode']=='IN')
assert len(config['coverageGapEdits'])==4
for edit in config['coverageGapEdits']:
    assert row['unresolvedGaps'][edit['index']]==edit['before']
    row['unresolvedGaps'][edit['index']]=edit['after']
assert c==expected_c
for s in r['sources']:
    if s['id'] in config['updates']:
        assert s['enabled'] is False and s['connector']=='none' and s.get('reviewRequired', True) is True
for path,sha in b['protectedFileHashes'].items():assert digest(path)==sha,path
app_paths=set(load('phases/phase-69-2026-09-27-baseline.json')['code'])|{'lib/source-directory.ts','lib/source-directory.test.ts'}
for record in load('phases/phase-69-2026-09-27-artifact-manifest.json')['files']:
    if record['path'] in app_paths:assert digest(record['path'])==record['sha256'],record['path']
packets=list((ROOT/'data/review').glob('*.json'))
assert len(packets)==82 and sum(len(json.loads(p.read_text())['cycles']) for p in packets)==328
index=load('public/data/index.json');assert index['total']==0 and index['countries']==[]
matrix=load(MATRIX)
assert matrix['rawOriginalsRetained'] is False and len(matrix['sources'])==2
assert {s['sourceId'] for s in matrix['sources']}==set(config['updates'])
for source in matrix['sources']:
    assert set(source['threeStageEligibility'].values())=={'needs verification'}
    for document in source['documents']:
        assert document['rawOriginalRetained'] is False and document['originalSha256'] is None
        assert document['collectorSuccessfulFetchAt'] is None and document['validatedAt'] is None
inventory=load('data/reference/jurisdictions.json')['jurisdictions'];assert len(inventory)==250
assert 'MAX_RETAINED_EVIDENCE_BYTES = 800 * 1024 * 1024' in (ROOT/'scripts/collect.ts').read_text()
files=[p for p in (ROOT/'data/evidence').rglob('*') if p.is_file()]
assert len(files)==2355 and sum(p.stat().st_size for p in files)==871622022
processes=load(P+'process-results.json')
assert processes['publicDataBuild']['exitCode']==processes['focusedTests']['exitCode']==0
tests=(ROOT/(P+'focused-tests.txt')).read_text();assert 'pass 6' in tests and 'fail 0' in tests
browser=load(P+'browser-checks.json')
assert browser['hpStateSourceCount']==4 and browser['tgStateSourceCount']==5
assert browser['clearCount']==99
for key in ['tgNoticeFiltered','tgNationalityVisible','tgLanguageVisible','tgHomepageOfficial',
            'hpNoticeFiltered','hpUnknownEligibilityVisible','hpAmendmentGapVisible',
            'hpStaleHeaderVisible','sharedViewRestored','reviewWarning',
            'noEligibilityResultClaim','publicStateOnly']:
    assert browser[key],key
assert (ROOT/(P+'india-source-research.png')).exists()
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
receipt={'checkedAt':now,'phase':76,'status':'verified India reader-research checkpoint',
         'registeredSources':210,'indiaSources':99,'sourcePresenceJurisdictions':94,'jurisdictionDenominator':250,
         'sourcesEnriched':2,'otherSourcesUnchanged':208,'coverageGapEdits':4,'otherCoverageRowsUnchanged':93,
         'healthAndReviewFilesUnchanged':len(b['protectedFileHashes']),'pendingPackets':82,'pendingCycles':328,
         'publicListings':0,'newHealthTimestamps':0,'evidenceFiles':2355,'logicalEvidenceBytes':871622022,
         'collectorCapBytes':838860800,'evidenceBytesAdded':0,'focusedTests':{'passed':6,'failed':0,'exitCode':0},
         'publicDataBuild':{'exitCode':0},'priorFullSuite':{'phase':69,'passed':362,'typecheckExitCode':0,'runtimeFilesUnchanged':True,'rerunThisPhase':False},
         'localReadRetries':retries,'limitations':['No new cycle or exact original evidence retained.','Three-stage eligibility still needs verification.','Source presence is not complete coverage.','Storage choice, founder review, export gate and worldwide audit unresolved.']}
(ROOT/(P+'verification.json')).write_text(json.dumps(receipt,indent=2)+'\n')
paths={*(ROOT/'phases').glob('phase-76-*'),*(ROOT/p for p in ['README.md','CONTEXT.md','sources/registry.json','data/published/coverage.json',MATRIX,'public/data/index.json'])}
paths.discard(ROOT/(P+'artifact-manifest.json'))
manifest=[{'path':str(p.relative_to(ROOT)),'bytes':p.stat().st_size,'sha256':digest(str(p.relative_to(ROOT)))} for p in sorted(paths)]
(ROOT/(P+'artifact-manifest.json')).write_text(json.dumps({'savedAt':now,'status':receipt['status'],'files':manifest},indent=2)+'\n')
print(json.dumps({'sourcesEnriched':2,'registeredSources':210,'indiaSources':99,'protectedFilesUnchanged':len(b['protectedFileHashes']),'focusedTests':6,'publicListings':0,'savedFiles':len(manifest)}),flush=True)

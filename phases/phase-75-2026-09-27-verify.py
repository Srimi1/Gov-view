"""Verify append-only discovery changes and unchanged collection state."""
from pathlib import Path
import datetime
import json
import subprocess
import sys

ROOT=Path(__file__).resolve().parent.parent
P='phases/phase-75-2026-09-27-'
MATRIX='data/discovery/japan-northern-pacific-recruitment-2026-09-27.json'
retries=[]

def load(path):
    return json.loads((ROOT/path).read_text())

def save(path,value):
    (ROOT/path).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')

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
added=load(P+'source-config.json')
expected=json.loads(json.dumps(b['registry']));expected['sources'].extend(added)
assert r==expected
assert len(r['sources'])==210 and len({s['id'] for s in r['sources']})==210
assert sum(s['country']=='IN' for s in r['sources'])==99
assert sum(s['country']=='JP' for s in r['sources'])==10
assert sum(s['country']=='US' for s in r['sources'])==5
assert len({s['country'] for s in r['sources']})==94
assert {s['country'] for s in added}=={'JP','AS','MP'}
expected_c=json.loads(json.dumps(b['coverage']))
for s in added:
    assert s['enabled'] is False and s['connector']=='none' and s['reviewRequired'] is True
    assert s['cadenceHours']==24 and 'subdivisionCodes' not in s
    row=next((x for x in expected_c if x['jurisdictionCode']==s['country']),None)
    if row is None:
        expected_c.append({'jurisdictionCode':s['country'],'fixture':False,'status':'no-verified-listings',
          'researchedAuthorities':[s['authority']],'connectedSourceCount':0,
          'unresolvedGaps':[s['name']+': '+s['accessGap']],
          'lastSuccessfulFetchAt':None,'lastValidatedAt':None})
    else:
        row['researchedAuthorities'].append(s['authority'])
        row['unresolvedGaps'].append(s['name']+': '+s['accessGap'])
assert c==expected_c
for path,sha in b['protectedFileHashes'].items():assert digest(path)==sha,path
app_paths=set(load('phases/phase-69-2026-09-27-baseline.json')['code'])|{'lib/source-directory.ts','lib/source-directory.test.ts'}
for record in load('phases/phase-69-2026-09-27-artifact-manifest.json')['files']:
    if record['path'] in app_paths:assert digest(record['path'])==record['sha256'],record['path']
packets=list((ROOT/'data/review').glob('*.json'))
assert len(packets)==82 and sum(len(json.loads(p.read_text())['cycles']) for p in packets)==328
index=load('public/data/index.json');assert index['total']==0 and index['countries']==[]
matrix=load(MATRIX)
assert matrix['rawOriginalsRetained'] is False and len(matrix['sources'])==4
assert {s['sourceId'] for s in matrix['sources']}=={s['id'] for s in added}
for source in matrix['sources']:
    assert set(source['threeStageEligibility'].values())=={'needs verification'}
    for d in source['documents']:
        assert d['rawOriginalRetained'] is False and d['originalSha256'] is None
        assert d['collectorSuccessfulFetchAt'] is None and d['validatedAt'] is None
assert len(load('data/reference/jurisdictions.json')['jurisdictions'])==250
assert 'MAX_RETAINED_EVIDENCE_BYTES = 800 * 1024 * 1024' in (ROOT/'scripts/collect.ts').read_text()
files=[p for p in (ROOT/'data/evidence').rglob('*') if p.is_file()]
assert len(files)==2355 and sum(p.stat().st_size for p in files)==871622022
processes=load(P+'process-results.json')
assert processes['publicDataBuild']['exitCode']==processes['focusedTests']['exitCode']==0
tests=(ROOT/(P+'focused-tests.txt')).read_text();assert 'pass 6' in tests and 'fail 0' in tests
browser=load(P+'browser-checks.json')
assert browser['japanRegisteredSources']==10
for key in ['reviewWarning','tokyoOneResult','tokyoNationalityRestriction','tokyoResidenceNotOverride','tokyoLanguageUncertain','hokkaidoOneResult','hokkaidoScopedNationalityRestriction','hokkaidoClosedWindow','sharedTokyoViewRestored']:
    assert browser[key],key
assert set(browser['territories'])=={'AS','MP'}
for code,checks in browser['territories'].items():assert all(checks.values()),(code,checks)
assert (ROOT/(P+'japan-pacific-research.png')).exists()
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
receipt={'checkedAt':now,'phase':75,'status':'verified official-source discovery checkpoint',
 'registeredSources':210,'indiaSources':99,'japanSources':10,'usCountrySources':5,
 'sourcePresenceJurisdictions':94,'jurisdictionDenominator':250,'jurisdictionsWithoutRegisteredSources':156,
 'disabledSourcesAdded':4,'previousRegistryEntriesUnchanged':206,'newTerritoryCoverageRows':2,
 'unrelatedCoverageRowsUnchanged':91,'existingJapanCoverageMetadataPreserved':True,
 'healthAndReviewFilesUnchanged':len(b['protectedFileHashes']),'pendingPackets':82,'pendingCycles':328,
 'publicListings':0,'newHealthTimestamps':0,'evidenceFiles':2355,'logicalEvidenceBytes':871622022,
 'collectorCapBytes':838860800,'evidenceBytesAdded':0,
 'focusedTests':{'passed':6,'failed':0,'exitCode':0},'publicDataBuild':{'exitCode':0},
 'priorFullSuite':{'phase':69,'passed':362,'typecheckExitCode':0,'runtimeFilesUnchanged':True,'rerunThisPhase':False},
 'localReadRetries':retries,
 'limitations':['No new cycle or exact original evidence retained.','All three eligibility stages need verification.','Source presence is not complete coverage.','Storage choice, founder review, export gate and worldwide audit unresolved.']}
save(P+'verification.json',receipt)
paths={*(ROOT/'phases').glob('phase-75-*'),*(ROOT/p for p in ['README.md','CONTEXT.md','sources/registry.json','data/published/coverage.json',MATRIX,'public/data/index.json'])}
paths.discard(ROOT/(P+'artifact-manifest.json'))
manifest=[{'path':str(p.relative_to(ROOT)),'bytes':p.stat().st_size,'sha256':digest(str(p.relative_to(ROOT)))} for p in sorted(paths)]
save(P+'artifact-manifest.json',{'savedAt':now,'status':receipt['status'],'files':manifest})
print(json.dumps({'registeredSources':210,'disabledSourcesAdded':4,'protectedFilesUnchanged':len(b['protectedFileHashes']),
 'focusedTests':6,'publicListings':0,'savedFiles':len(manifest)}),flush=True)

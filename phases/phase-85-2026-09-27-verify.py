"""Check append-only directory changes against their actual verification scope."""
from pathlib import Path
import datetime
import hashlib
import json

ROOT = Path(__file__).resolve().parent.parent
P = 'phases/phase-85-2026-09-27-'
MATRIX = 'data/discovery/india-sjvn-marshall-islands-nauru-niue-recruitment-2026-09-27.json'

def load(path):
    return json.loads((ROOT/path).read_text())

def save(path, value):
    (ROOT/path).write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n')

def digest(path):
    return hashlib.sha256((ROOT/path).read_bytes()).hexdigest()

b = load(P+'baseline.json')
r = load('sources/registry.json')
c = load('data/published/coverage.json')
added = load(P+'source-config.json')
assert r == dict(b['registry'], sources=b['registry']['sources']+added)
assert len(r['sources']) == len({s['id'] for s in r['sources']}) == 240
assert {s['country'] for s in added} == {'IN','MH','NR','NU'}
assert len(added) == 5
assert len({s['country'] for s in r['sources']}) == len(c) == 119
assert sum(s['country']=='IN' for s in r['sources']) == 102
assert sum(s['country']=='JP' for s in r['sources']) == 10
assert sum(s['country']=='US' for s in r['sources']) == 5
assert sum(s['enabled'] for s in r['sources']) == 6
expected = json.loads(json.dumps(b['coverage']))
for s in added:
    assert s['enabled'] is False and s['connector']=='none' and s['reviewRequired'] is True
    assert s['cadenceHours']==24 and 'subdivisionCodes' not in s
    assert s['homepage'].startswith('https://') and s['discoveredFrom'].startswith('https://')
    assert 'lastSuccessfulFetchAt' not in s and 'lastValidatedAt' not in s
for country in sorted({s['country'] for s in added}):
    group = [s for s in added if s['country']==country]
    existing = next((row for row in expected if row['jurisdictionCode'] == country), None)
    if existing:
        assert country == 'IN'
        existing['researchedAuthorities'].extend(s['authority'] for s in group if s['authority'] not in existing['researchedAuthorities'])
        existing['unresolvedGaps'].extend(s['name']+': '+s['accessGap'] for s in group)
        continue
    expected.append({'jurisdictionCode':country,'fixture':False,'status':'no-verified-listings',
        'researchedAuthorities':[s['authority'] for s in group],'connectedSourceCount':0,
        'unresolvedGaps':[s['name']+': '+s['accessGap'] for s in group],
        'lastSuccessfulFetchAt':None,'lastValidatedAt':None})
assert c == expected
for path, sha in {**b['protectedFileHashes'],**b['runtimeHashes']}.items():
    assert digest(path)==sha, path
assert len(b['protectedFileHashes'])==83
packets = list((ROOT/'data/review').glob('*.json'))
assert len(packets)==82 and sum(len(json.loads(p.read_text())['cycles']) for p in packets)==328
index = load('public/data/index.json')
assert index['total']==0 and index['countries']==[]
inventory = load('data/reference/jurisdictions.json')['jurisdictions']
assert len(inventory)==250
assert {s['country'] for s in added} <= {x['code'] for x in inventory}
assert 'MAX_RETAINED_EVIDENCE_BYTES = 800 * 1024 * 1024' in (ROOT/'scripts/collect.ts').read_text()
evidence = [p for p in (ROOT/'data/evidence').rglob('*') if p.is_file()]
assert len(evidence)==2355 and sum(p.stat().st_size for p in evidence)==871622022
matrix = load(MATRIX)
assert matrix['rawOriginalsRetained'] is False and matrix['notPublishedEligibility'] is True
assert len(matrix['sources'])==5 and {x['sourceId'] for x in matrix['sources']}=={x['id'] for x in added}
for source in matrix['sources']:
    assert set(source['threeStageEligibility'].values())=={'needs verification'}
    for document in source['documents']:
        assert document['rawOriginalRetained'] is False and document['originalSha256'] is None
        assert document['collectorSuccessfulFetchAt'] is None and document['validatedAt'] is None
        assert document['observationDate']=='2026-09-27'
processes = load(P+'process-results.json')
assert processes['preparation']['exitCode']==processes['focusedTests']['exitCode']==processes['publicDataBuild']['exitCode']==0
tests = (ROOT/(P+'focused-tests.txt')).read_text()
assert 'pass 6' in tests and 'fail 0' in tests
browser = load(P+'browser-checks.json')
assert set(browser['countries'])=={'IN','MH','NR','NU'}
assert browser['status']=='partial; current localhost blocked by Chrome'
assert browser['countries']['IN']['earlierOneSource'] and browser['countries']['MH']['earlierOneSource']
assert all(checks['currentPreview'] is False for checks in browser['countries'].values())
for field in ['indiaNationalityResidenceIndependent','marshallNonCitizenNotWorkPermission','nauruSeparateExpatriateRoute','niueDesirableLanguageAndReferenceConflict']:
    assert browser[field], field
assert browser['sharedIndiaViewRestored'] is None and browser['indiaClearRestores102'] is None
assert (ROOT/(P+'browser-blocked.png')).exists()
assert 'ERR_BLOCKED_BY_CLIENT' in ' '.join(browser['failures'])
now = datetime.datetime.now(datetime.timezone.utc).isoformat()
receipt = {'checkedAt':now,'phase':85,'status':'directory preservation verified; browser acceptance incomplete',
    'registeredSources':240,'indiaSources':102,'japanSources':10,'usCountrySources':5,
    'sourcePresenceJurisdictions':119,'jurisdictionDenominator':250,'jurisdictionsWithoutRegisteredSources':131,
    'disabledSourcesAdded':5,'previousRegistryEntriesUnchanged':235,'previousCoverageRowsUnchanged':115,'indiaCoverageRowEnriched':True,
    'healthAndReviewFilesUnchanged':83,'pendingPackets':82,'pendingCycles':328,'humanApprovals':0,'publicListings':0,
    'newHealthTimestamps':0,'evidenceFiles':2355,'logicalEvidenceBytes':871622022,'collectorCapBytes':838860800,'evidenceBytesAdded':0,
    'browserAcceptance':{'status':'incomplete','earlierCountriesObserved':['IN','MH'],'currentPreviewBlocked':True,'sharedFilterChecksCompleted':False},
    'focusedTests':{'passed':6,'failed':0,'exitCode':0},'publicDataBuildExitCode':0,
    'priorFullSuite':{'phase':78,'passed':364,'typecheckExitCode':0,'rerunThisPhase':False},
    'runtimeUnchanged':True,'productionBuildRun':False,
    'limitations':['Directory sources are not accepted collectors or reviewed cycles.','Sample rules do not establish portal-wide eligibility.','Three-stage personalized eligibility remains unverified.','Storage choice, founder review, export gate and worldwide audit outstanding.','Current browser preview blocked by Chrome; Nauru/Niue browser and share/clear checks incomplete.']}
save(P+'verification.json', receipt)
paths = {*(ROOT/'phases').glob('phase-85-*'),*(ROOT/p for p in ['README.md','CONTEXT.md','sources/registry.json','data/published/coverage.json',MATRIX,'public/data/index.json'])}
paths.discard(ROOT/(P+'artifact-manifest.json'))
manifest = [{'path':str(p.relative_to(ROOT)),'bytes':p.stat().st_size,'sha256':digest(str(p.relative_to(ROOT)))} for p in sorted(paths)]
save(P+'artifact-manifest.json',{'savedAt':now,'status':receipt['status'],'files':manifest})
print(json.dumps({'registeredSources':240,'sourcePresenceJurisdictions':119,'sourcesAdded':5,
    'protectedFilesUnchanged':83,'focusedTests':6,'publicListings':0,'savedFiles':len(manifest)}),flush=True)

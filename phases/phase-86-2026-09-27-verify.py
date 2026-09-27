"""Check append-only directory changes against their actual verification scope."""
from pathlib import Path
import datetime
import hashlib
import json

ROOT = Path(__file__).resolve().parent.parent
P = 'phases/phase-86-2026-09-27-'
MATRIX = 'data/discovery/india-ntpc-bermuda-cayman-british-virgin-islands-recruitment-2026-09-27.json'

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
assert len(r['sources']) == len({s['id'] for s in r['sources']}) == 244
assert {s['country'] for s in added} == {'IN','BM','KY','VG'}
assert len(added) == 4
assert len({s['country'] for s in r['sources']}) == len(c) == 122
assert sum(s['country']=='IN' for s in r['sources']) == 103
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
assert len(matrix['sources'])==4 and {x['sourceId'] for x in matrix['sources']}=={x['id'] for x in added}
for source in matrix['sources']:
    assert source['registry'] == next(s for s in added if s['id']==source['sourceId'])
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
assert set(browser['countries'])=={'IN','BM','KY','VG'}
assert browser['status'] in {'passed','incomplete'}
if browser['status']=='passed':
    assert all(checks['currentPreview'] for checks in browser['countries'].values())
    assert browser['sharedIndiaViewRestored'] and browser['indiaClearRestores103']
    assert browser['shareContainsOnlyPublicDisplayState']
    assert (ROOT/browser['screenshot']).exists()
else:
    assert browser['failures'] and not browser['sharedIndiaViewRestored']
    assert (ROOT/(P+'browser-blocked.png')).exists()
assert matrix['sources'][0]['internationalApplicantAssessment']['status']=='needs verification'
assert matrix['sources'][1]['appointmentType']['value']=='permanent'
assert matrix['sources'][2]['appointmentType']['value'] is None
assert matrix['sources'][3]['appointmentType']['value'] is None
assert all(source['languageAssessment']['standardizedLevel'] is None for source in matrix['sources'])
now = datetime.datetime.now(datetime.timezone.utc).isoformat()
receipt = {'checkedAt':now,'phase':86,'status':'directory preservation verified; browser acceptance '+('passed' if browser['status']=='passed' else 'incomplete'),
    'registeredSources':244,'indiaSources':103,'japanSources':10,'usCountrySources':5,
    'sourcePresenceJurisdictions':122,'jurisdictionDenominator':250,'jurisdictionsWithoutRegisteredSources':128,
    'disabledSourcesAdded':4,'previousRegistryEntriesUnchanged':240,'previousCoverageRowsUnchanged':118,'indiaCoverageRowEnriched':True,
    'healthAndReviewFilesUnchanged':83,'pendingPackets':82,'pendingCycles':328,'humanApprovals':0,'publicListings':0,
    'newHealthTimestamps':0,'evidenceFiles':2355,'logicalEvidenceBytes':871622022,'collectorCapBytes':838860800,'evidenceBytesAdded':0,
    'browserAcceptance':{'status':browser['status'],'countriesObserved':[code for code,checks in browser['countries'].items() if checks['currentPreview']],'sharedFilterChecksCompleted':bool(browser['sharedIndiaViewRestored'])},
    'focusedTests':{'passed':6,'failed':0,'exitCode':0},'publicDataBuildExitCode':0,
    'priorFullSuite':{'phase':78,'passed':364,'typecheckExitCode':0,'rerunThisPhase':False},
    'runtimeUnchanged':True,'productionBuildRun':False,
    'limitations':['Directory sources are not accepted collectors or reviewed cycles.','Sample rules do not establish portal-wide eligibility.','Three-stage personalized eligibility remains unverified.','Storage choice, founder review, export gate and worldwide audit outstanding.','Browser acceptance scope recorded separately; pending observations are not passing checks.']}
save(P+'verification.json', receipt)
paths = {*(ROOT/'phases').glob('phase-86-*'),*(ROOT/p for p in ['README.md','CONTEXT.md','sources/registry.json','data/published/coverage.json',MATRIX,'public/data/index.json'])}
paths.discard(ROOT/(P+'artifact-manifest.json'))
manifest = [{'path':str(p.relative_to(ROOT)),'bytes':p.stat().st_size,'sha256':digest(str(p.relative_to(ROOT)))} for p in sorted(paths)]
save(P+'artifact-manifest.json',{'savedAt':now,'status':receipt['status'],'files':manifest})
print(json.dumps({'registeredSources':244,'sourcePresenceJurisdictions':122,'sourcesAdded':4,
    'protectedFilesUnchanged':83,'focusedTests':6,'publicListings':0,'savedFiles':len(manifest)}),flush=True)

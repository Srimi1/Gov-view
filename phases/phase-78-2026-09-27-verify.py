"""Verify two source enrichments and three narrowly corrected pending drafts."""
from pathlib import Path
import datetime
import hashlib
import json
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent
P = 'phases/phase-78-2026-09-27-'
MATRIX = 'data/discovery/india-andhra-cgpsc-original-corrections-2026-09-27.json'
retries = []

def load(path):
    return json.loads((ROOT/path).read_text())

def digest(path):
    code = 'import hashlib,sys;h=hashlib.sha256();f=open(sys.argv[1],"rb");\nwhile True:\n b=f.read(1048576)\n if not b:break\n h.update(b)\nprint(h.hexdigest())'
    for attempt in range(3):
        try:
            r = subprocess.run([sys.executable, '-c', code, str(ROOT/path)], capture_output=True, text=True, timeout=5, check=True)
            return r.stdout.strip()
        except subprocess.TimeoutExpired:
            retries.append({'path': path, 'attempt': attempt+1})
    raise RuntimeError('File cannot be hashed: '+path)

b = load(P+'baseline.json')
r = load('sources/registry.json')
c = load('data/published/coverage.json')
config = load(P+'source-config.json')
assert set(config['updates']) == {'in-ap-recruitment', 'in-ct-recruitment'}
expected = json.loads(json.dumps(b['registry']))
for source in expected['sources']:
    if source['id'] in config['updates']:
        assert set(config['updates'][source['id']]) == {'notes'}
        source.update(config['updates'][source['id']])
assert r == expected
assert len(r['sources']) == len({s['id'] for s in r['sources']}) == 210
assert sum(s['country'] == 'IN' for s in r['sources']) == 99
assert len({s['country'] for s in r['sources']}) == len(c) == 94
expected_c = json.loads(json.dumps(b['coverage']))
india = next(x for x in expected_c if x['jurisdictionCode'] == 'IN')
assert len(config['coverageGapEdits']) == 2
for edit in config['coverageGapEdits']:
    assert india['unresolvedGaps'][edit['index']] == edit['before']
    india['unresolvedGaps'][edit['index']] = edit['after']
assert c == expected_c
for path, sha in b['protectedFileHashes'].items():
    assert digest(path) == sha, path
for path, sha in b['retainedOriginals'].items():
    assert digest(path) == sha, path
app_paths = set(load('phases/phase-69-2026-09-27-baseline.json')['code']) | {'lib/source-directory.ts', 'lib/source-directory.test.ts'}
for record in load('phases/phase-69-2026-09-27-artifact-manifest.json')['files']:
    if record['path'] in app_paths:
        assert digest(record['path']) == record['sha256'], record['path']
for path, old in b['before'].items():
    assert digest(path) != old['sha256'], path

# Packet edits preserve identities, documents, original collection/fetch times,
# rules, fees, qualifications and every other field not named below.
for id in config['updates']:
    path = 'data/review/'+id+'.json'
    old = json.loads(b['before'][path]['content'])
    current = load(path)
    assert set(current) == set(old) | {'approvalRevisions', 'researchAmendedAt'}
    assert current['reviewStatus'] == 'pending'
    assert current['sourceId'] == old['sourceId']
    for key in set(old)-{'cycles'}:
        assert current[key] == old[key], (path, key)
    assert len(current['cycles']) == len(old['cycles'])
    for before, after in zip(old['cycles'], current['cycles']):
        allowed = {'applicationWindow', 'selectionStages', 'sources', 'lastVerifiedAt'}
        if id == 'in-ct-recruitment':
            allowed |= {'status', 'statusNote'}
            assert after['status'] == 'uncertain'
        assert set(before) == set(after)
        for key in set(before)-allowed:
            assert before[key] == after[key], (after['id'], key)
        assert after['lastVerifiedAt'] is None
        assert after['applicationWindow']['officialTimeZone'] is None
        for key in set(before['applicationWindow'])-{'officialTimeZone', 'note'}:
            assert before['applicationWindow'][key] == after['applicationWindow'][key]
        assert len(before['sources']) == len(after['sources'])
        for original, document in zip(before['sources'], after['sources']):
            expected_document = dict(original, fetchStatus='fetched', fetchedUrl=original['url'], lastValidatedAt=None)
            assert document == expected_document

code = '''import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {approvalRevisions,isApprovedCycle} from './lib/review.server.ts';
import {renderReviewSheet} from './scripts/review-sheet.ts';
import {verifyRetainedEvidence} from './scripts/approve-review.ts';
let checked=0;
for(const id of ['in-ap-recruitment','in-ct-recruitment']){
 const p=JSON.parse(readFileSync('data/review/'+id+'.json','utf8'));
 for(const c of p.cycles){
  assert.deepEqual(p.approvalRevisions[c.id],approvalRevisions(c));
  assert.equal(isApprovedCycle(c),false);
  verifyRetainedEvidence(process.cwd(),id,c);
  assert.equal(readFileSync('data/review/sheets/'+c.id+'.md','utf8'),renderReviewSheet(p,c,null));
  checked++;
 }
}assert.equal(checked,3);console.log(JSON.stringify({exactDraftsAndSheets:checked,approvals:0}));'''
node_check = subprocess.run(['node', '--experimental-strip-types', '--input-type=module', '-e', code], cwd=ROOT, capture_output=True, text=True, check=True)
assert json.loads(node_check.stdout)['exactDraftsAndSheets'] == 3
packets = list((ROOT/'data/review').glob('*.json'))
assert len(packets) == 82 and sum(len(json.loads(p.read_text())['cycles']) for p in packets) == 328
index = load('public/data/index.json')
assert index['total'] == 0 and index['countries'] == []
assert len(load('data/reference/jurisdictions.json')['jurisdictions']) == 250
assert 'MAX_RETAINED_EVIDENCE_BYTES = 800 * 1024 * 1024' in (ROOT/'scripts/collect.ts').read_text()
files = [p for p in (ROOT/'data/evidence').rglob('*') if p.is_file()]
assert len(files) == 2355 and sum(p.stat().st_size for p in files) == 871622022
matrix = load(MATRIX)
assert {s['sourceId'] for s in matrix['sources']} == set(config['updates'])
for source in matrix['sources']:
    assert source['newOriginalBytesRetained'] is False and source['newCollectorFetchAt'] is None and source['validatedAt'] is None
    assert source['officialTimeZone'] is None and set(source['threeStageEligibility'].values()) == {'needs verification'}
processes = load(P+'process-results.json')
for key in ['fullTests', 'connectorTests', 'typecheck', 'publicDataBuild', 'draftCorrection']:
    assert processes[key]['exitCode'] == 0, key
assert 'pass 364' in (ROOT/(P+'full-tests.txt')).read_text()
assert 'fail 0' in (ROOT/(P+'full-tests.txt')).read_text()
assert 'pass 8' in (ROOT/(P+'connector-tests.txt')).read_text()
browser = load(P+'browser-checks.json')
assert browser['apStateSourceCount'] == browser['ctStateSourceCount'] == 1
assert browser['clearCount'] == 99
for key in ['apNoticeFiltered','apSelectionVisible','apLanguageSeparationVisible','apTimezoneUnknown','apForeignUnknown',
            'ctNoticeFiltered','ctSeparatePostsVisible','ctForeignUnknown','ctMediumNotProficiency','ctTimezoneUnknown',
            'sharedViewRestored','reviewWarning','noEligibilityResultClaim','publicStateOnly']:
    assert browser[key], key
assert (ROOT/(P+'india-source-corrections.png')).exists()
now = datetime.datetime.now(datetime.timezone.utc).isoformat()
receipt = {'checkedAt':now,'phase':78,'status':'verified original-backed draft corrections',
           'registeredSources':210,'indiaSources':99,'sourcePresenceJurisdictions':94,'jurisdictionDenominator':250,
           'sourcesEnriched':2,'otherSourcesUnchanged':208,'coverageGapEdits':2,'otherCoverageRowsUnchanged':93,
           'healthAndOtherReviewFilesUnchanged':len(b['protectedFileHashes']),'amendedPackets':2,'amendedCycles':3,'exactReviewSheets':3,
           'pendingPackets':82,'pendingCycles':328,'humanApprovals':0,'publicListings':0,'newHealthTimestamps':0,
           'evidenceFiles':2355,'logicalEvidenceBytes':871622022,'collectorCapBytes':838860800,'evidenceBytesAdded':0,
           'fullTests':{'passed':364,'failed':0,'exitCode':0},'connectorTests':{'passed':8,'failed':0,'exitCode':0},
           'typecheckExitCode':0,'publicDataBuildExitCode':0,'explorationRuntimeUnchanged':True,'productionBuildRun':False,
           'localReadRetries':retries,'limitations':['Current browser originals not byte-matched to earlier retained originals.','Detailed AP notice, complete foreign routes and appointment tenure unverified.','No human approval or publication.','Storage choice, review, export gate and worldwide audit pending.']}
(ROOT/(P+'verification.json')).write_text(json.dumps(receipt,indent=2)+'\n')
paths = {* (ROOT/'phases').glob('phase-78-*'), *(ROOT/p for p in ['README.md','CONTEXT.md','sources/registry.json','data/published/coverage.json',MATRIX,'public/data/index.json',*b['before']])}
for id in config['updates']:
    paths |= {ROOT/('data/review/sheets/'+x['id']+'.md') for x in load('data/review/'+id+'.json')['cycles']}
paths.discard(ROOT/(P+'artifact-manifest.json'))
manifest = [{'path':str(p.relative_to(ROOT)),'bytes':p.stat().st_size,'sha256':digest(str(p.relative_to(ROOT)))} for p in sorted(paths)]
(ROOT/(P+'artifact-manifest.json')).write_text(json.dumps({'savedAt':now,'status':receipt['status'],'files':manifest},indent=2)+'\n')
print(json.dumps({'sourcesEnriched':2,'correctedDrafts':3,'exactReviewSheets':3,'protectedFilesUnchanged':81,'fullTests':364,'publicListings':0,'savedFiles':len(manifest)}),flush=True)

from pathlib import Path
import datetime
import json
import subprocess
import sys

PREFIX = 'phases/phase-68-2026-09-27-'
SOURCE = 'in-mp-esb-steno-asi-2026'
ERROR = 'Retained evidence storage budget reached; previous records preserved'
retries = []


def read(path):
    return json.loads(Path(path).read_text())


def write(path, value):
    Path(path).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def digest(path):
    for attempt in range(3):
        try:
            result = subprocess.run(
                [sys.executable, '-c', 'import hashlib,sys;print(hashlib.sha256(open(sys.argv[1],"rb").read()).hexdigest())', str(path)],
                capture_output=True, text=True, timeout=5, check=True,
            )
            return result.stdout.strip()
        except subprocess.TimeoutExpired:
            retries.append({'path': str(path), 'attempt': attempt + 1})
    raise RuntimeError('Local file could not be hashed: ' + str(path))


b = read(PREFIX + 'baseline.json')
r = read('sources/registry.json')
c = read('data/published/coverage.json')
h = read('data/published/sources-status.json')
old_ids = {x['id'] for x in b['registry']['sources']}
assert len(old_ids) == 182
assert [x for x in r['sources'] if x['id'] in old_ids] == b['registry']['sources']
assert len(r['sources']) == len({x['id'] for x in r['sources']}) == 183
new = [x for x in r['sources'] if x['id'] not in old_ids]
assert len(new) == 1 and new[0]['id'] == SOURCE
s = new[0]
assert s['enabled'] is False and s['reviewRequired'] is True and s['maxRecords'] == 1
assert s['connector'] == 'mpesb-steno-asi-2026' and s['country'] == 'IN'
assert s['subdivisionCodes'] == ['IN-MP'] and 'no review packet was created' in s['accessGap']
assert sum(x['country'] == 'IN' for x in r['sources']) == 99
assert len(c) == len(b['coverage']) == 70
for old in b['coverage']:
    current = next(x for x in c if x['jurisdictionCode'] == old['jurisdictionCode'])
    if old['jurisdictionCode'] != 'IN':
        assert current == old, old['jurisdictionCode']
    else:
        expected = dict(old)
        expected['unresolvedGaps'] = old['unresolvedGaps'] + [s['name'] + ': ' + s['accessGap']]
        assert current == expected, 'India baseline fields or previous gaps changed'
for key, value in b['health'].items():
    assert h[key] == value, key
assert set(h) - set(b['health']) == {SOURCE}
assert h[SOURCE]['lastError'] == ERROR and h[SOURCE]['lastSuccessfulFetchAt'] is None
assert h[SOURCE]['consecutiveFailures'] == 1 and h[SOURCE]['recordCount'] == 0
protected = {p: v for p, v in b['unchangedStateSha256'].items() if p != 'data/published/sources-status.json'}
assert len(protected) == 83
for path, value in protected.items():
    assert digest(path) == value, path
assert not Path('data/review/' + SOURCE + '.json').exists()

requests = read('data/discovery/mpesb-steno-asi-2026-09-27-requests.json')
outcomes = read('data/discovery/mpesb-steno-asi-2026-09-27-fetch-outcomes.json')
assert len(requests) == len(outcomes) == 4
assert {x['url'] for x in requests} == {x['url'] for x in outcomes}
for item in outcomes:
    assert item['status'] == 'retained' and item['sourceId'] == SOURCE
    assert item['evidence']['url'] == item['url']
    assert digest(item['path']) == item['evidence']['sha256']
    assert Path(item['path']).stat().st_size == item['evidence']['bytes']
    if item['format'] == 'PDF':
        assert Path(item['path']).read_bytes()[:5] == b'%PDF-'
        assert item['evidence']['sha256'] == '0af335cfde1efd8e339d1dab7c29c68127152d987d59cea35494ce9ce12b6f8c'
    else:
        assert 'html' in item['evidence']['contentType'].lower()
preview = read(PREFIX + 'candidate-preview.json')
assert 'Not a stored review packet' in preview['purpose'] and preview['complete'] is False
assert len(preview['cycles']) == 1 and len(preview['evidence']) == 4
cycle = preview['cycles'][0]
assert cycle['sourceId'] == SOURCE and cycle['lastVerifiedAt'] is None
assert cycle['rules']['complete'] is False and cycle['rules']['nationality']['allowed'] == ['IN']
window = cycle['applicationWindow']
assert window['opensOn'] == '2026-09-24' and window['closesOn'] == '2026-10-08'
assert window['cutoffLocalTime'] is None and window['officialTimeZone'] is None
assert 'midnight' in window['note'] and 'corrections only' in window['note']
languages = cycle['rules']['languages']
assert len(languages) == 2 and all(x['language'] == 'hi' for x in languages)
assert all('framework' not in x and 'minimumLevel' not in x for x in languages)
assert languages[0]['stage'] == 'apply' and languages[0]['certificateRequired'] is True
assert languages[1]['stage'] == 'selection' and languages[1]['certificateRequired'] is False
selection = next(x for x in cycle['rules']['manualChecks'] if x['stage'] == 'selection')
assert 'prior appointing-authority permission' in selection['text']
assert cycle['venues'][0]['kind'] == 'unknown'
assert {x['sha256'] for x in cycle['sources']} == {x['evidence']['sha256'] for x in outcomes}
assert all(x['lastValidatedAt'] is None and x['verificationStatus'] == 'pending-review' for x in cycle['sources'])
assert '100 words per minute' in cycle['qualifications']

m = read(PREFIX + 'metrics.json')
assert m['review']['pendingPackets'] == 82 and m['review']['pendingCycles'] == 328
assert m['review']['measuredDecisions'] == 0
assert m['coverage']['publicRecords'] == m['coverage']['approvedRecords'] == 0
assert m['coverage']['collectedRecords'] == 18760
assert m['coverage']['jurisdictionsWithRegisteredSource'] == 70
assert m['coverage']['unresearchedJurisdictions'] == 180
storage = read(PREFIX + 'storage-limit.json')
assert storage['stagingExitCode'] == 1 and storage['error'] == ERROR
assert storage['newReviewPackets'] == 0 and storage['writeFreeLiveDryRunExitCode'] == 0
assert storage['limitBytes'] == 838860800 and storage['limitChanged'] is False
assert storage['retainedEvidenceBytes'] - storage['limitBytes'] == storage['excessBytes'] == 32761222
assert ERROR in Path(PREFIX + 'collection.txt').read_text()
dry_run = Path(PREFIX + 'collection-dry-run.txt').read_text()
assert '1 collected, 0 approved, 1 pending, 0 kept' in dry_run and 'Dry run: nothing written.' in dry_run
assert '0 records across 0 countries' in Path(PREFIX + 'public-data-build.txt').read_text()
full = Path(PREFIX + 'test-results.txt').read_text()
focused = Path(PREFIX + 'tests-focused.txt').read_text()
assert 'pass 358' in full and 'fail 0' in full
assert 'pass 4' in focused and 'fail 0' in focused
assert 'error TS' not in Path(PREFIX + 'typecheck.txt').read_text()
assert Path(PREFIX + 'connector-index-before.ts.txt').exists()
assert not Path(PREFIX + 'connector-index-before.ts').exists()
index_before = b['codeBaseline']['connectors/index.ts']
index_now = Path('connectors/index.ts').read_text()
added_lines = [x for x in index_now.splitlines(keepends=True) if 'mpesb-steno-asi-2026' in x]
assert len(added_lines) == 1 and index_now.replace(added_lines[0], '') == index_before
reviews = read(PREFIX + 'review-results.json')
assert all(x['status'] == 'resolved' for x in reviews['initialSpecFindings'] + reviews['initialStandardsFindings'])
browser = read(PREFIX + 'browser-checks.json')
assert browser['indiaRegisteredSources'] == 99 and browser['matchingSources'] == 1
assert browser['stagingFailureVisible'] and Path(browser['screenshot']).exists()
now = datetime.datetime.now(datetime.timezone.utc).isoformat()
receipt = {
    'phase': 68, 'checkedAt': now, 'registeredSources': 183, 'indiaSources': 99,
    'existingSourcesUnchanged': 182, 'existingNonIndiaCoverageRowsUnchanged': 69,
    'protectedReviewAndPublishedFilesUnchanged': 83, 'existingHealthEntriesUnchanged': len(b['health']),
    'retainedOriginals': 4, 'draftPreviewCycles': 1, 'newReviewPackets': 0,
    'pendingPackets': 82, 'pendingCycles': 328, 'publicRecords': 0, 'approvedRecords': 0,
    'staging': {'exitCode': 1, 'error': ERROR}, 'writeFreeLiveDryRun': {'exitCode': 0},
    'tests': {'passed': 358, 'failed': 0, 'focusedPassed': 4},
    'typecheck': {'exitCode': 0, 'basis': 'Terminal process result recorded during this phase; current log checked for diagnostics.'},
    'publicDataBuild': {'exitCode': 0, 'records': 0}, 'codeReview': reviews,
    'browser': browser, 'localFileReadRetries': retries,
}
write(PREFIX + 'verification.json', receipt)
paths = {
    Path('README.md'), Path('sources/registry.json'), Path('data/published/coverage.json'),
    Path('data/published/sources-status.json'), Path('connectors/index.ts'),
    Path('connectors/mpesb-steno-asi-2026.ts'), Path('connectors/mpesb-steno-asi-2026.test.ts'),
    Path('data/extractions/mpesb-steno-asi-2026.json'),
    *Path('phases').glob('phase-68-*'),
    *Path('data/discovery').glob('mpesb-steno-asi-2026-09-27-*.json'),
    *(Path(x['path']) for x in outcomes),
}
paths.discard(Path(PREFIX + 'artifact-manifest.json'))
files = [{'path': str(p), 'bytes': p.stat().st_size, 'sha256': digest(p)} for p in sorted(paths)]
write(PREFIX + 'artifact-manifest.json', {'savedAt': now, 'files': files, 'localFileReadRetries': retries})
print(json.dumps({'phase': 68, 'sources': 183, 'india': 99, 'protected': 83, 'savedFiles': len(files), 'tests': 358, 'staging': 'storage-limit', 'newReviewPackets': 0}), flush=True)

"""Verify completed UI work and separately recorded storage audit reconciliation."""
from pathlib import Path
import datetime
import json
import subprocess
import sys

PREFIX = 'phases/phase-69-2026-09-27-'
retries = []


def read(path):
    return json.loads(Path(path).read_text())


def digest(path):
    for attempt in range(3):
        try:
            result = subprocess.run([sys.executable, '-c', 'import hashlib,sys;print(hashlib.sha256(open(sys.argv[1],"rb").read()).hexdigest())', str(path)], capture_output=True, text=True, timeout=5, check=True)
            return result.stdout.strip()
        except subprocess.TimeoutExpired:
            retries.append({'path': str(path), 'attempt': attempt + 1})
    raise RuntimeError('Protected file could not be hashed: ' + str(path))


baseline = read(PREFIX + 'baseline.json')
for path, sha in baseline['unchanged'].items():
    assert digest(path) == sha, path
registry = read('sources/registry.json')['sources']
assert len(registry) == 183 and sum(s['country'] == 'IN' for s in registry) == 99
assert len(list(Path('data/review').glob('*.json'))) == 82
assert not Path('data/review/in-mp-esb-steno-asi-2026.json').exists()
full = Path(PREFIX + 'test-results.txt').read_text()
assert 'pass 362' in full and 'fail 0' in full
assert 'pass 4' in Path(PREFIX + 'tests-focused.txt').read_text()
processes = read(PREFIX + 'process-results.json')
assert processes['fullTests']['exitCode'] == processes['typecheck']['exitCode'] == 0
assert 'error TS' not in Path(PREFIX + 'typecheck.txt').read_text()
assert read(PREFIX + 'audit-worker-tests.json')['passed'] == 4
assert 'MAX_RETAINED_EVIDENCE_BYTES = 800 * 1024 * 1024' in Path('scripts/collect.ts').read_text()
browser = read(PREFIX + 'browser-checks.json')
assert browser['indiaJurisdictionOptions'] == 36 and browser['mpCpctSources'] == 1
assert browser['punjabCpctSources'] == 0 and browser['punjabSources'] == 3
assert browser['punjabWithUnscopedSources'] == 29 and browser['clearSources'] == 99
assert browser['reloadRestoresPunjabAfterHydration'] and browser['browserBackRestoresIndia']
assert browser['californiaSources'] == 1 and browser['usRegisteredSources'] == 5
assert Path(browser['screenshot']).exists()
now = datetime.datetime.now(datetime.timezone.utc).isoformat()
audit = read(PREFIX + 'evidence-storage-audit.json')
reconciled = read(PREFIX + 'audit-reconciliation.json')
assert audit['auditedFiles'] == 2353 and not audit['complete']
assert reconciled['completeReconciledInventory'] and reconciled['auditedFiles'] == 2355
assert not reconciled['collectorBodyHashMismatches'] and reconciled['collectorBodiesChecked'] == 617
receipt = {
    'checkedAt': now, 'phase': 69, 'status': 'UI verified; storage inventory reconciled',
    'registeredSources': 183, 'indiaSources': 99, 'protectedFilesUnchanged': len(baseline['unchanged']),
    'pendingPackets': 82, 'pendingCycles': 328, 'publicListings': 0,
    'tests': {'passed': 362, 'failed': 0, 'focusedPassed': 4},
    'typecheck': {'exitCode': 0}, 'auditWorkerChecks': 4,
    'storageAudit': {'status': 'terminal; original snapshot incomplete; supplemental inventory reconciled', 'sessionId': 37874, 'exitCode': 0, 'firstAttemptExitCode': 1, 'firstAttemptError': 'Evidence tree changed during audit; do not use mixed-time totals', 'originalAuditedFiles': 2353, 'reconciledAuditedFiles': 2355, 'collectorBodiesChecked': 617, 'collectorBodyHashMismatches': 0},
    'collectorEvidenceCapBytes': 838860800, 'browser': browser, 'localFileReadRetries': retries,
    'scope': 'Completed source-filter changes, source/review state preservation and read-only reconciled storage inventory. Does not establish physical disk savings, founder approval or worldwide coverage.',
}
Path(PREFIX + 'checkpoint.json').write_text(json.dumps(receipt, indent=2) + '\n')
paths = {*Path('phases').glob('phase-69-*'), Path('README.md'),
         Path('lib/source-directory.ts'), Path('lib/source-directory.test.ts'),
         *(Path(p) for p in baseline['code'])}
excluded = {Path(PREFIX + 'artifact-manifest.json')}
files = [{'path': str(p), 'bytes': p.stat().st_size, 'sha256': digest(p)} for p in sorted(paths - excluded)]
Path(PREFIX + 'artifact-manifest.json').write_text(json.dumps({'savedAt': now, 'status': 'UI verified; storage inventory reconciled', 'excludedLiveOutputs': [], 'files': files}, indent=2) + '\n')
print(json.dumps({'tests': 362, 'protectedFilesUnchanged': len(baseline['unchanged']), 'savedFiles': len(files), 'storageAudit': 'reconciled'}), flush=True)

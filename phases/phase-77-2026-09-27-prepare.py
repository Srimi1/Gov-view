"""Apply two reader-only India source enrichments; preserve collection state."""
from pathlib import Path
import datetime
import hashlib
import json

ROOT = Path(__file__).resolve().parent.parent
P = 'phases/phase-77-2026-09-27-'
MATRIX = 'data/discovery/india-mppsc-ppsc-reader-research-2026-09-27.json'

def load(path):
    return json.loads((ROOT/path).read_text())

def save(path, value):
    (ROOT/path).write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n')

research = load(P+'research-input.json')
registry = load('sources/registry.json')
coverage = load('data/published/coverage.json')
assert len(registry['sources']) == 210 and len(coverage) == 94
for record in load('phases/phase-76-2026-09-27-artifact-manifest.json')['files']:
    if record['path'] in {'sources/registry.json', 'data/published/coverage.json'}:
        assert hashlib.sha256((ROOT/record['path']).read_bytes()).hexdigest() == record['sha256']
previous = load('phases/phase-76-2026-09-27-baseline.json')
save(P+'baseline.json', {
    'savedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'registry': registry, 'coverage': coverage,
    'protectedFileHashes': previous['protectedFileHashes'],
    'protectedHashesProvenance': 'Phase 76 terminal verifier confirmed protected files; current registry/coverage match Phase 76 manifest before this mutation.'
})
edits = []
india = next(row for row in coverage if row['jurisdictionCode'] == 'IN')
for source in registry['sources']:
    if source['id'] not in research['updates']:
        continue
    assert source['enabled'] is False and source['connector'] == 'none'
    assert source.get('reviewRequired', True) is True
    for field, value in research['updates'][source['id']].items():
        if field in {'notes', 'accessGap'}:
            old = source['name']+': '+source[field]
            new = source['name']+': '+value
            assert india['unresolvedGaps'].count(old) == 1
            index = india['unresolvedGaps'].index(old)
            india['unresolvedGaps'][index] = new
            edits.append({'sourceId': source['id'], 'field': field, 'index': index, 'before': old, 'after': new})
        source[field] = value
save('sources/registry.json', registry)
save('data/published/coverage.json', coverage)
save(P+'source-config.json', {'updates': research['updates'], 'coverageGapEdits': edits})
for source in research['sources']:
    source['status'] = 'reader-only-research-awaiting-review'
    source['threeStageEligibility'] = dict.fromkeys(['canApply', 'canEnterSelection', 'canObtainJobOrLicence'], 'needs verification')
    for document in source['documents']:
        document.update({'observationDate': '2026-09-27', 'rawOriginalRetained': False,
                         'originalSha256': None, 'collectorSuccessfulFetchAt': None, 'validatedAt': None})
        document.setdefault('sourceLanguage', 'English')
save(MATRIX, {
    'researchDate': '2026-09-27', 'phase': 77, 'notPublishedEligibility': True,
    'rawOriginalsRetained': False, 'readerObservationIsNotCollectorFetchOrValidation': True,
    'translationAcceptance': 'pending-human-review',
    'registrySourceCountUnchanged': 210, 'indiaSourceCountUnchanged': 99,
    'sourcePresenceJurisdictionsUnchanged': 94,
    'storagePolicy': 'No writes to data/evidence; cap and collection pause unchanged.',
    'sources': research['sources']
})
print(json.dumps({'sourcesEnriched': 2, 'registrySources': 210, 'indiaSources': 99,
                  'sourcePresenceJurisdictions': 94, 'coverageGapEdits': len(edits), 'evidenceBytesAdded': 0}))

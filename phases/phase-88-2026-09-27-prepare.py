"""Register four official directory sources including India and two new jurisdictions, preserving collection and review state."""
from pathlib import Path
import datetime
import hashlib
import json

ROOT = Path(__file__).resolve().parent.parent
P = 'phases/phase-88-2026-09-27-'
MATRIX = 'data/discovery/india-hal-npcil-egypt-lebanon-recruitment-2026-09-27.json'

def load(path):
    return json.loads((ROOT/path).read_text())

def save(path, value):
    (ROOT/path).write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n')

def digest(path):
    return hashlib.sha256((ROOT/path).read_bytes()).hexdigest()

items = load(P+'research-input.json')
r = load('sources/registry.json')
c = load('data/published/coverage.json')
assert len(r['sources']) == 248 and len(c) == 125
assert {x['country'] for x in items} == {'IN','EG','LB'}
assert ({x['country'] for x in items} & {x['jurisdictionCode'] for x in c}) == {'IN'}
assert not ({x['id'] for x in items} & {x['id'] for x in r['sources']})
previous = load('phases/phase-87-2026-09-27-baseline.json')
protected = previous['protectedFileHashes']
runtime = previous['runtimeHashes']
for path, sha in {**protected, **runtime}.items():
    assert digest(path) == sha, path
assert len(protected) == 83
for entry in load('phases/phase-87-2026-09-27-artifact-manifest.json')['files']:
    if entry['path'] in {'sources/registry.json','data/published/coverage.json'}:
        assert digest(entry['path']) == entry['sha256'], entry['path']
save(P+'baseline.json', {'savedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'registry':r,'coverage':c,'protectedFileHashes':protected,'runtimeHashes':runtime,
    'provenance':'83 health/review hashes from terminal Phase 87 verification rechecked before changes; Phase 69 exploration runtime and Phase 78 corrected connectors preserved.'})
added = []
research = []
for item in items:
    s = {key:item[key] for key in ['id','name','country','authority','homepage','discoveredFrom','notes','accessGap']}
    s.update(connector='none',cadenceHours=24,enabled=False,reviewRequired=True,discoveredAt='2026-09-27',
        licence='Official public-authority reader-only discovery. Original notices, collection terms, translations and extracted summaries require review before connector acceptance or publication.')
    added.append(s)
    documents = item['documents']
    for document in documents:
        document.update(observationDate='2026-09-27',rawOriginalRetained=False,originalSha256=None,
            collectorSuccessfulFetchAt=None,validatedAt=None)
    research.append({'sourceId':s['id'],'country':s['country'],'pathways':['recruitment'],
        'status':'reader-only-research-awaiting-review','registry':s,'documents':documents,
        **{key:item[key] for key in ['appointmentType','internationalApplicantAssessment','languageAssessment']},
        'threeStageEligibility':{'canApply':'needs verification','canEnterSelection':'needs verification','canObtainJobOrLicence':'needs verification'}})
for country in sorted({s['country'] for s in added}):
    country_sources = [s for s in added if s['country'] == country]
    existing = next((row for row in c if row['jurisdictionCode'] == country), None)
    if existing:
        assert country == 'IN'
        existing['researchedAuthorities'].extend(s['authority'] for s in country_sources if s['authority'] not in existing['researchedAuthorities'])
        existing['unresolvedGaps'].extend(s['name']+': '+s['accessGap'] for s in country_sources)
        continue
    c.append({'jurisdictionCode':country,'fixture':False,'status':'no-verified-listings',
        'researchedAuthorities':[s['authority'] for s in country_sources], 'connectedSourceCount':0,
        'unresolvedGaps':[s['name']+': '+s['accessGap'] for s in country_sources],
        'lastSuccessfulFetchAt':None,'lastValidatedAt':None})
r['sources'].extend(added)
save('sources/registry.json',r)
save('data/published/coverage.json',c)
save(P+'source-config.json',added)
save(MATRIX,{'researchDate':'2026-09-27','phase':88,'notPublishedEligibility':True,
    'rawOriginalsRetained':False,'readerObservationIsNotCollectorFetchOrValidation':True,
    'translationAcceptance':'pending-human-review','sourceCountIsNotCycleCount':True,
    'sourcePresenceIsNotCompleteCoverage':True,'storagePolicy':'No raw source writes; collector cap and pause unchanged.',
    'sources':research})
print(json.dumps({'registeredSources':len(r['sources']),'sourcePresenceJurisdictions':len(c),
    'disabledAdded':len(added),'protectedFilesRechecked':len(protected),'evidenceBytesAdded':0}),flush=True)

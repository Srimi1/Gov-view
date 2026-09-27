"""Register three official directory sources, preserving collection and review state."""
from pathlib import Path
import datetime
import hashlib
import json

ROOT = Path(__file__).resolve().parent.parent
P = 'phases/phase-79-2026-09-27-'
MATRIX = 'data/discovery/turkiye-morocco-tunisia-recruitment-2026-09-27.json'

def load(path):
    return json.loads((ROOT/path).read_text())

def save(path, value):
    (ROOT/path).write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n')

def digest(path):
    return hashlib.sha256((ROOT/path).read_bytes()).hexdigest()

items = load(P+'research-input.json')
r = load('sources/registry.json')
c = load('data/published/coverage.json')
assert len(r['sources']) == 210 and len(c) == 94
assert {x['country'] for x in items} == {'TR','MA','TN'}
assert not ({x['country'] for x in items} & {x['jurisdictionCode'] for x in c})
assert not ({x['id'] for x in items} & {x['id'] for x in r['sources']})
protected = load('phases/phase-78-2026-09-27-baseline.json')['protectedFileHashes']
previous_manifest = load('phases/phase-78-2026-09-27-artifact-manifest.json')['files']
for entry in previous_manifest:
    if entry['path'] in {'data/review/in-ap-recruitment.json','data/review/in-ct-recruitment.json'}:
        protected[entry['path']] = entry['sha256']
for path, sha in protected.items():
    assert digest(path) == sha, path
assert len(protected) == 83
runtime = {entry['path']:entry['sha256'] for entry in previous_manifest
           if entry['path'].startswith('connectors/')}
runtime.update({entry['path']:entry['sha256'] for entry in load('phases/phase-69-2026-09-27-artifact-manifest.json')['files']
                if entry['path'] in set(load('phases/phase-69-2026-09-27-baseline.json')['code']) | {'lib/source-directory.ts','lib/source-directory.test.ts'}})
for path, sha in runtime.items():
    assert digest(path) == sha, path
save(P+'baseline.json', {'savedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'registry':r,'coverage':c,'protectedFileHashes':protected,'runtimeHashes':runtime,
    'provenance':'83 health/review hashes from terminal Phase 78 verification rechecked before changes; Phase 69 exploration runtime and Phase 78 corrected connectors preserved.'})
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
    c.append({'jurisdictionCode':s['country'],'fixture':False,'status':'no-verified-listings',
        'researchedAuthorities':[s['authority']],'connectedSourceCount':0,
        'unresolvedGaps':[s['name']+': '+s['accessGap']],'lastSuccessfulFetchAt':None,'lastValidatedAt':None})
r['sources'].extend(added)
save('sources/registry.json',r)
save('data/published/coverage.json',c)
save(P+'source-config.json',added)
save(MATRIX,{'researchDate':'2026-09-27','phase':79,'notPublishedEligibility':True,
    'rawOriginalsRetained':False,'readerObservationIsNotCollectorFetchOrValidation':True,
    'translationAcceptance':'pending-human-review','sourceCountIsNotCycleCount':True,
    'sourcePresenceIsNotCompleteCoverage':True,'storagePolicy':'No raw source writes; collector cap and pause unchanged.',
    'sources':research,'unregisteredLead':{'country':'EG','homepage':'https://jobs.caoa.gov.eg/',
        'status':'current-reader-failed; no accepted current page, registry entry, closure or checked-empty claim'}})
print(json.dumps({'registeredSources':len(r['sources']),'sourcePresenceJurisdictions':len(c),
    'disabledAdded':len(added),'protectedFilesRechecked':len(protected),'evidenceBytesAdded':0}),flush=True)

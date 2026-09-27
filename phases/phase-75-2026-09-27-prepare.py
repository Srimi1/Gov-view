"""Register four official recruitment discovery sources without collecting evidence."""
from pathlib import Path
import datetime
import json

ROOT = Path(__file__).resolve().parent.parent
P = 'phases/phase-75-2026-09-27-'
MATRIX = 'data/discovery/japan-northern-pacific-recruitment-2026-09-27.json'

def load(path):
    return json.loads((ROOT/path).read_text())

def save(path, value):
    (ROOT/path).write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n')

def doc(url, label, language, status='reader-accessible', **extra):
    return {'url':url,'label':label,'sourceLanguage':language,'readerStatus':status,
            'observationDate':'2026-09-27','rawOriginalRetained':False,'originalSha256':None,
            'collectorSuccessfulFetchAt':None,'validatedAt':None,**extra}

common = 'Reader-only discovery; no original bytes retained, accepted connector, health timestamp or published cycle. Collection terms, exact notices, translations and amendments need review.'
items = load(P+'research-input.json')
for item in items:
    for d in item['documents']:
        d.update(observationDate='2026-09-27',rawOriginalRetained=False,originalSha256=None,collectorSuccessfulFetchAt=None,validatedAt=None)

r=load('sources/registry.json');c=load('data/published/coverage.json')
assert len(r['sources'])==206 and len(c)==92
assert not ({i['id'] for i in items}&{s['id'] for s in r['sources']})
previous=load('phases/phase-74-2026-09-27-baseline.json')
save(P+'baseline.json',{'savedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
     'registry':r,'coverage':c,'protectedFileHashes':previous['protectedFileHashes'],
     'protectedHashesProvenance':'Phase 74 terminal verifier confirmed all 83 health/review files; registry and coverage hashes rechecked before Phase 74 research.'})
added=[];research=[]
for item in items:
    s={k:item[k] for k in ['id','name','country','authority','homepage','discoveredFrom','notes','accessGap']}
    s.update(connector='none',cadenceHours=24,enabled=False,reviewRequired=True,discoveredAt='2026-09-27',
             licence='Official public-authority reader-only discovery. Original notices, collection terms, translations and extracted summaries require review before connector acceptance or publication.')
    added.append(s)
    research.append({'sourceId':s['id'],'country':s['country'],'pathways':['recruitment'],
                     'status':'reader-only-research-awaiting-review','registry':s,
                     'appointmentType':item['appointmentType'],'internationalApplicantAssessment':item['internationalApplicantAssessment'],
                     'languageAssessment':item['languageAssessment'],'documents':item['documents'],
                     'threeStageEligibility':{'canApply':'needs verification','canEnterSelection':'needs verification','canObtainJobOrLicence':'needs verification'}})
    row=next((x for x in c if x['jurisdictionCode']==s['country']),None)
    if row is None:
        c.append({'jurisdictionCode':s['country'],'fixture':False,'status':'no-verified-listings',
                  'researchedAuthorities':[s['authority']],'connectedSourceCount':0,
                  'unresolvedGaps':[s['name']+': '+s['accessGap']],
                  'lastSuccessfulFetchAt':None,'lastValidatedAt':None})
    else:
        row['researchedAuthorities'].append(s['authority'])
        row['unresolvedGaps'].append(s['name']+': '+s['accessGap'])
r['sources'].extend(added)
save('sources/registry.json',r);save('data/published/coverage.json',c)
save(P+'source-config.json',added)
save(MATRIX,{'researchDate':'2026-09-27','phase':75,'notPublishedEligibility':True,
     'rawOriginalsRetained':False,'readerObservationIsNotCollectorFetchOrValidation':True,
     'translationAcceptance':'pending-human-review','sourceCountIsNotCycleCount':True,
     'territoryAccounting':'AS and MP use existing separate jurisdiction codes; not added again as US-country sources.',
     'regionalScope':'Tokyo and Hokkaido regional authorities are labelled in text; Japan subdivision UI inventory does not yet exist.',
     'storagePolicy':'No writes to data/evidence; cap and collection pause unchanged.','sources':research})
print(json.dumps({'registeredSources':len(r['sources']),'indiaSources':sum(s['country']=='IN' for s in r['sources']),
      'japanSources':sum(s['country']=='JP' for s in r['sources']),'sourcePresenceJurisdictions':len(c),
      'disabledAdded':len(added),'evidenceBytesAdded':0}))

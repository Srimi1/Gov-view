"""Enrich two India source entries using reader-only observations."""
from pathlib import Path
import datetime
import json

ROOT = Path(__file__).resolve().parent.parent
P = 'phases/phase-73-2026-09-27-'
MATRIX = 'data/discovery/india-hppsc-mpsc-reader-research-2026-09-27.json'

def load(path):
    return json.loads((ROOT/path).read_text())

def save(path, value):
    (ROOT/path).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')

def doc(url, label, status, language='English', **extra):
    return {'url':url,'label':label,'sourceLanguage':language,'readerStatus':status,
            'observationDate':'2026-09-27','rawOriginalRetained':False,'originalSha256':None,
            'collectorSuccessfulFetchAt':None,'validatedAt':None,**extra}

index = 'https://hppsc.hp.gov.in/CommonControls/CMSContinuousLinkPagePV?qs=mhlKjiXMMItGo46f60VBXX8%2B1SQ83OzVLj9MfDScpvboDSdMygkK4iLV47Bu%2FJzMpJLanI%2BihrK9p8W6JsSQUgHTy39NyiuO%2BFtbEmiPQyc%3D'
ado = 'https://hppsc.hp.gov.in/CommonControls/CMSFileView?qs=oeMK915q2HkdpWSZ%2B0aaIFmLDoF0cTjGvKykbXugJ5FH4sUacllacTF%2B5RqdIHDUbyy0Z1o%2FJ5mdBZRhOdQiJ2dT4h8rHe34qs%2FBwPNGPmM%3D'
medical = 'https://hppsc.hp.gov.in/CommonControls/CMSFileView?qs=oeMK915q2HkdpWSZ%2B0aaIFmLDoF0cTjGvKykbXugJ5FH4sUacllacTF%2B5RqdIHDU8OVHeK1TpVx4SlpZJoOUOt5MFxW3W1BbDCF2vzmM4nE%3D'
updates = {
    'in-hp-recruitment': {
        'homepage':'https://hppsc.hp.gov.in/Home/',
        'discoveredFrom':'https://hppsc.hp.gov.in/Home/',
        'notes':'Reader-only research, awaiting review. Current CMS links September 2026 Agriculture Development Officer 63/9 and Medical Officer 62/9 notices under fixed-emolument job-trainee scheme; permanent tenure is not established. All 23 ADO vacancies are wards-of-ex-servicemen backlog categories, including UR wards; UR is not unrestricted here. ADO requires four-year BSc Agriculture AND second-class MSc Agriculture; first-class MSc and HP customs/dialects are desirable. Both selection schemes include Hindi and English knowledge sections, 20 marks each; no formal proficiency level established. Original closes: ADO 22 October, medical 16 October, both 11:59 PM; official timezone and opening dates unknown. Foreign-citizen permission remains unverified.',
        'accessGap':'Earlier 27 September collector recheck could not reach robots.txt; legacy TLS failure remains history. Current CMS and two linked PDFs are readable through web research, which does not establish collector access, accepted output or source health. No original bytes retained in this phase. Exact originals, current amendments, job-trainee scheme, nationality, category/domicile evidence and full selection/appointment criteria require review. Other-state reservation wording cannot override ADO wards-only vacancy table. Medical qualifications follow notice-referenced statutory schedules and compulsory rotating internship; foreign qualification or application acceptance does not establish employment or licence permission. No new cycle, venue pin or validation timestamp.',
    },
    'in-mh-recruitment': {
        'notes':'Reader-only browser research confirms official MPSC home, footer dated 24 September 2026, showing interview schedule 105/2025, revised candidate instructions, FAQ and examination/typing guidance. Interview, answer-sheet and mock-test announcements do not establish fresh application windows. Revised-instructions link did not expose its document during this check. No individual appointment type, foreign-citizen rule or mandatory language level was accepted; English interface is not a proficiency requirement.',
        'accessGap':'Earlier public notice API robots restrictions remain unresolved. Reader initially failed; ordinary browser subsequently displayed the official homepage, but no current original advertisement or revised-instructions document was read. Browser rendering does not clear scheduled collector access or prove complete/empty vacancy coverage. Permitted feed, exact notices and amendment history remain required; no new original bytes, health timestamp, connector or review packet.',
    },
}
r=load('sources/registry.json');c=load('data/published/coverage.json')
assert len(r['sources'])==202 and len(c)==89
previous=load('phases/phase-72-2026-09-27-baseline.json')
save(P+'baseline.json',{'savedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
     'registry':r,'coverage':c,'protectedFileHashes':previous['protectedFileHashes'],
     'protectedHashesProvenance':'Phase 72 terminal verifier confirmed all 83 health/review files; Phase 72 registry and coverage hashes rechecked before Phase 73 research.'})
gap_edits=[]
for s in r['sources']:
    if s['id'] not in updates:continue
    assert s['enabled'] is False and s['connector']=='none' and s['reviewRequired'] is True
    for field,value in updates[s['id']].items():
        if field in {'notes','accessGap'}:
            old=s['name']+': '+s[field];new=s['name']+': '+value
            row=next(x for x in c if x['jurisdictionCode']=='IN')
            assert row['unresolvedGaps'].count(old)==1,(s['id'],field)
            i=row['unresolvedGaps'].index(old);row['unresolvedGaps'][i]=new
            gap_edits.append({'sourceId':s['id'],'field':field,'index':i,'before':old,'after':new})
        s[field]=value
save('sources/registry.json',r);save('data/published/coverage.json',c)
save(P+'source-config.json',{'updates':updates,'coverageGapEdits':gap_edits})
sources=[{
    'sourceId':'in-hp-recruitment','country':'IN','subdivisionCodes':['IN-HP'],
    'status':'reader-only-research-awaiting-review','documents':[
        doc('https://hppsc.hp.gov.in/Home/','Current official CMS home and notice navigation','reader-accessible'),
        doc(index,'Current advertisements index','reader-accessible',notCompleteInventory=True),
        doc(ado,'Agriculture Development Officer 63/9-2026','reader-accessible-pdf',publishedDate='2026-09-25',applicationOpening=None,observedApplicationClose='2026-10-22',observedCutoffClock='23:59',officialTimezone=None,deadlineAccepted=False,rawAppointmentLabel='Group-A (Job Trainee)',permanentTenureEstablished=False,qualificationSummary='Four-year BSc Agriculture AND second-class MSc Agriculture; first-class MSc is desirable.',categorySummary='All 23 vacancies are wards-of-ex-servicemen backlog posts: 19 UR wards, 3 SC wards, 1 OBC wards. UR is not an unrestricted vacancy.',nationalityPermission=None,languageSummary='Hindi and English knowledge: 20 marks each in selection; HP customs/dialects desirable. No formal level established.'),
        doc(medical,'Medical Officer 62/9-2026','reader-accessible-pdf',publishedDate='2026-09-19',applicationOpening=None,observedApplicationClose='2026-10-16',observedCutoffClock='23:59',officialTimezone=None,deadlineAccepted=False,rawAppointmentLabel='Group-A (Job Trainee)',permanentTenureEstablished=False,qualificationSummary='Medical qualification within notice-referenced statutory schedules AND compulsory rotating internship; foreign qualification recognition needs review.',nationalityPermission=None,languageSummary='Hindi and English knowledge: 20 marks each in selection; HP customs/dialects desirable. No formal level established.',readerPageCount=13,printedBodyPageCount=12,paginationReconciliationPending=True),
    ],
    'threeStageEligibility':{'canApply':'needs verification','canEnterSelection':'needs verification','canObtainJobOrLicence':'needs verification'},
    'knownGaps':['Raw originals and current amendments unretained.','No affirmative nationality permission established.','General out-of-state reservation wording cannot override horizontal reservation in the vacancy table.','Job-trainee scheme does not establish a permanent appointment.','Notice publication dates are not application openings; printed clock has no established timezone.','The corrigendum navigation reader exposed no rows; this does not prove no amendments.'],
},{
    'sourceId':'in-mh-recruitment','country':'IN','subdivisionCodes':['IN-MH'],
    'status':'reader-only-research-awaiting-review','documents':[
        doc('https://www.mpsc.gov.in/home','Official home navigation attempt','reader-error; browser-navigation-initial-error-followed-by-visible-home',redirectedUrl='https://mpsc.gov.in/home',observedFooterDate='2026-09-24'),
        doc('https://mpsc.gov.in/home','Official home and revised-instructions link','browser-accessible; revised-instructions-click-did-not-expose-document',language='English interface with Marathi branding',noIndividualNoticeRead=True),
    ],
    'threeStageEligibility':{'canApply':'needs verification','canEnterSelection':'needs verification','canObtainJobOrLicence':'needs verification'},
    'knownGaps':['No current individual notice or revised general-instructions document read.','Current browser rendering is not scheduled collector health or permission.','Interface language and recruitment-stage announcements do not establish applicant eligibility.'],
}]
save(MATRIX,{'researchDate':'2026-09-27','phase':73,'notPublishedEligibility':True,'rawOriginalsRetained':False,
     'readerObservationIsNotCollectorFetchOrValidation':True,'translationAcceptance':'pending-human-review',
     'registrySourceCountUnchanged':202,'indiaSourceCountUnchanged':99,'sourcePresenceJurisdictionsUnchanged':89,
     'storagePolicy':'No writes to data/evidence; cap and collection pause unchanged.','sources':sources})
print(json.dumps({'sourcesEnriched':2,'registrySources':202,'indiaSources':99,'sourcePresenceJurisdictions':89,'coverageGapEdits':len(gap_edits),'evidenceBytesAdded':0}))

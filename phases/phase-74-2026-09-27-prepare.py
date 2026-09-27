"""Register four official recruitment discovery sources without collecting evidence."""
from pathlib import Path
import datetime
import json

ROOT = Path(__file__).resolve().parent.parent
P = 'phases/phase-74-2026-09-27-'
MATRIX = 'data/discovery/japan-us-territories-recruitment-2026-09-27.json'

def load(path):
    return json.loads((ROOT/path).read_text())

def save(path, value):
    (ROOT/path).write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n')

def doc(url, label, language, status='reader-accessible', **extra):
    return {'url':url,'label':label,'sourceLanguage':language,'readerStatus':status,
            'observationDate':'2026-09-27','rawOriginalRetained':False,'originalSha256':None,
            'collectorSuccessfulFetchAt':None,'validatedAt':None,**extra}

common = 'Reader-only discovery; no original bytes retained, accepted connector, health timestamp or published cycle. Collection terms, exact notices, translations and amendments need review.'
items = [
    {
        'id':'jp-osaka-prefecture-recruitment','country':'JP',
        'name':'Japan — Osaka Prefecture staff recruitment',
        'authority':'Osaka Prefectural Government — Personnel Commission and Human Resources Division',
        'homepage':'https://www.pref.osaka.lg.jp/o210010/jinji-i/saiyo/index.html',
        'discoveredFrom':'https://www.pref.osaka.lg.jp/o040030/jinji/senkou/index.html',
        'notes':'Research only; Osaka prefectural scope, not nationwide. Official FAQ allows non-Japanese candidates in competitive categories except police administration; resulting appointments exclude public-power/public-decision roles. Current guard/civil-construction selection explicitly accepts foreign citizens, but requires residence status permitting the duties at appointment. Born on/after 2 April 1977; education/work experience not required. Original application window 28 August 10:00–1 October 18:00, 2026; official timezone unestablished. General-knowledge test, guard essay and interview; no formal Japanese level stated. Appointment tenure unverified.',
        'accessGap':common+' Current HTML guide and PDF attachment must be reconciled. Nationality permission cannot override age, disqualifications or lawful residence at appointment. Japanese test/page text does not establish JLPT or CEFR threshold. Police, education and other selection routes need separate notices. Osaka name describes authority scope; no geographic code or venue pin added.',
        'appointmentType':'prefectural guard/civil-construction employment; permanent versus fixed-term unverified',
        'internationalApplicantAssessment':'current selection expressly permits non-Japanese candidates; lawful residence for duties required at appointment; public-power/public-decision roles excluded',
        'languageAssessment':'Japanese guide describes general-knowledge test, guard essay and interview; no mandatory JLPT/CEFR level established',
        'documents':[
            doc('https://www.pref.osaka.lg.jp/o210010/jinji-i/saiyo/index.html','Official prefectural recruitment directory','Japanese',lastChangedDate='2026-08-26'),
            doc('https://www.pref.osaka.lg.jp/faq/o210010/faq_001643.html','Nationality FAQ for competitive examinations','Japanese',lastChangedDate='2026-03-17',policeAdministrationException=True),
            doc('https://www.pref.osaka.lg.jp/o040030/jinji/senkou/r8_ginou.html','2026 guard and civil-construction selection guide','Japanese',lastChangedDate='2026-08-28',observedApplicationOpening='2026-08-28',observedOpeningClock='10:00',observedApplicationClose='2026-10-01',observedCutoffClock='18:00',officialTimezone=None,deadlineAccepted=False,foreignCitizenPermissionObserved=True,residenceAtAppointmentRequired=True,minimumBirthDate='1977-04-02',pdfReconciliationPending=True),
        ],
    },
    {
        'id':'gu-doa-public-recruitment','country':'GU',
        'name':'Guam — Department of Administration recruitment',
        'authority':'Government of Guam — Department of Administration, Human Resources Recruitment Branch',
        'homepage':'https://hr.doa.guam.gov/branches/recruitment/',
        'discoveredFrom':'https://doa.guam.gov/hrd/',
        'notes':'Research only. Official branch posts recruitment for non-autonomous departments/agencies and establishes eligible lists. Meeting minimum qualifications does not guarantee a passing numerical rating or appointment. Employment listing link failed in reader. Job type, international-applicant rules and mandatory language levels require individual notices. Central branch scope does not cover every autonomous authority.',
        'accessGap':common+' Employment route reader error cannot establish empty coverage or closure. Current complete notice inventory, autonomous bodies, citizenship/work authorization, appointment terms and language criteria remain gaps. Application form fields and site language cannot decide eligibility.',
        'appointmentType':'needs verification; eligible-list process does not establish appointment tenure',
        'internationalApplicantAssessment':'needs verification; no current notice citizenship or work-authorization rule accepted',
        'languageAssessment':'needs verification; English interface is not a proficiency requirement',
        'documents':[
            doc('https://hr.doa.guam.gov/branches/recruitment/','Official branch scope and selection process','English'),
            doc('https://hr.doa.guam.gov/employment/','Officially linked employment listing','English','reader-error'),
        ],
    },
    {
        'id':'pr-central-public-recruitment','country':'PR',
        'name':'Puerto Rico — Central recruitment registry',
        'authority':'Government of Puerto Rico — Office of Administration and Transformation of Human Resources (OATRH)',
        'homepage':'https://empleos.pr.gov/','discoveredFrom':'https://pr.gov/',
        'notes':'Research only. Official OATRH directory separates internal, external, reopened and transitory recruitment; internal is not open to every applicant. Aguadilla nutrition-services coordinator 09-2026-HSAr is labelled Transitorio, until further notice. Notice accepts foreigners authorized by federal immigration authorities to work in Puerto Rico; this is not visa sponsorship or permission for all foreign applicants. Academic conditions apply at application, with post-selection medical/drug tests. Clear oral/written expression required; no named language or formal level established.',
        'accessGap':common+' Reconcile downloadable original, amendment history, online/offline instructions and general conditions. Until further notice has no invented cutoff. Transitorio label does not establish exact duration. Portal index exposes both date and until-further-notice text on some other cards; unresolved dates must not become deadlines. Municipality/duty location is not an examination venue.',
        'appointmentType':'Aguadilla example labelled Transitorio; exact term and duration unverified',
        'internationalApplicantAssessment':'Aguadilla example accepts foreigners authorized to work in Puerto Rico; employer sponsorship and other post conditions unverified',
        'languageAssessment':'example requires clear oral/written expression; no language name or formal proficiency level inferred',
        'documents':[
            doc('https://pr.gov/','Official government referral to central employment registry','Spanish'),
            doc('https://empleos.pr.gov/','OATRH recruitment directory and route types','Spanish',completeNoticeInventory=False),
            doc('https://empleos.pr.gov/convocatorias/09-2026-hsar','Aguadilla nutrition-services coordinator 09-2026-HSAr','Spanish',rawAppointmentLabel='Transitorio',observedClosingText='Hasta Nuevo Aviso',applicationClose=None,officialTimezone=None,deadlineAccepted=False,foreignWorkAuthorizationRequired=True,downloadableOriginalReconciliationPending=True),
        ],
    },
    {
        'id':'vi-personnel-public-recruitment','country':'VI',
        'name':'United States Virgin Islands — Division of Personnel careers',
        'authority':'Government of the United States Virgin Islands — Division of Personnel',
        'homepage':'https://www.dopusvi.org/careers/',
        'discoveredFrom':'https://dpp.vi.gov/careers/',
        'notes':'Research only. Government Property and Procurement department refers applicants to Division of Personnel; official careers page links GovernmentJobs portal. Open careers and promotional opportunities are distinct. September exam announcements repeat correction-officer and call-center entries: duplicate display does not create extra cycles. Applications closed 18 September 2026; October testing does not reopen them. Foreign qualification evaluation is separate from foreign-citizen permission. Individual job type and mandatory language level unverified.',
        'accessGap':common+' Embedded/external vacancy inventory and exact employer notices need review; sparse reader output is not checked-empty coverage. Promotion, retiree and Army PaYS routes are distinct; interview access does not guarantee employment. Official timezone, citizenship/work authorization and appointment tenure unestablished. No location coordinates inferred.',
        'appointmentType':'needs verification; examination eligibility and eligible lists do not establish tenure',
        'internationalApplicantAssessment':'needs verification; foreign-credential evaluation guidance is not foreign-citizen permission',
        'languageAssessment':'needs verification; English interface and exam titles do not establish a required level',
        'documents':[
            doc('https://dpp.vi.gov/careers/','Government department referral to Division of Personnel','English'),
            doc('https://www.dopusvi.org/careers/','Official career page and outsourced portal referral','English',externalVacancyInventoryAccepted=False),
            doc('https://www.dopusvi.org/recruitment-and-classification/','Selection services, duplicated September announcements and credential guidance','English',observedApplicationClose='2026-09-18',observedCutoffClock='23:59',officialTimezone=None,deadlineAccepted=False,duplicateAnnouncementsObserved=True,notFreshApplicationWindow=True),
        ],
    },
]
r=load('sources/registry.json');c=load('data/published/coverage.json')
assert len(r['sources'])==202 and len(c)==89
assert not ({i['id'] for i in items}&{s['id'] for s in r['sources']})
previous=load('phases/phase-73-2026-09-27-baseline.json')
save(P+'baseline.json',{'savedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
     'registry':r,'coverage':c,'protectedFileHashes':previous['protectedFileHashes'],
     'protectedHashesProvenance':'Phase 73 terminal verifier confirmed all 83 health/review files; registry and coverage hashes rechecked before Phase 74 research.'})
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
save(MATRIX,{'researchDate':'2026-09-27','phase':74,'notPublishedEligibility':True,
     'rawOriginalsRetained':False,'readerObservationIsNotCollectorFetchOrValidation':True,
     'translationAcceptance':'pending-human-review','sourceCountIsNotCycleCount':True,
     'territoryAccounting':'GU, PR and VI use existing separate jurisdiction codes; not added again as US-country sources.',
     'regionalScope':'Osaka prefectural authority is labelled in text; Japan subdivision UI inventory does not yet exist.',
     'storagePolicy':'No writes to data/evidence; cap and collection pause unchanged.','sources':research})
print(json.dumps({'registeredSources':len(r['sources']),'indiaSources':sum(s['country']=='IN' for s in r['sources']),
      'japanSources':sum(s['country']=='JP' for s in r['sources']),'sourcePresenceJurisdictions':len(c),
      'disabledAdded':len(added),'evidenceBytesAdded':0}))

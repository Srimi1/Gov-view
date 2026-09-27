"""Register eight reader-only sources without evidence or review-queue writes."""
from pathlib import Path
import datetime
import json

ROOT = Path(__file__).resolve().parent.parent
P = 'phases/phase-72-2026-09-27-'
MATRIX = 'data/discovery/europe-recruitment-routes-matrix-2026-09-27.json'

def load(path):
    return json.loads((ROOT/path).read_text())

def save(path, value):
    (ROOT/path).write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n')

def doc(url, label, language, status, **extra):
    return {'url':url,'label':label,'sourceLanguage':language,'observationDate':'2026-09-27',
            'readerStatus':status,'rawOriginalRetained':False,'originalSha256':None,
            'collectorSuccessfulFetchAt':None,'validatedAt':None,**extra}

common = 'Reader-only research; no retained original bytes, adapter, accepted translation or reviewed cycle. Automated access and reuse terms remain unassessed. Current notice-specific nationality, residence, age, qualifications, fees, deadline timezone and selection venues require review. Other authorities and pathways remain gaps.'
items = [
    {
        'id':'cz-mpo-public-recruitment','country':'CZ',
        'name':'Czechia — Ministry of Industry and Trade recruitment',
        'authority':'Ministry of Industry and Trade, Czech Republic',
        'homepage':'https://mpo.gov.cz/zprava61716.html','discoveredFrom':'https://mpo.gov.cz/zprava61716.html',
        'notes':'Research only. Ministry directory separates statutory civil-service posts from Labour Code employment. Live reader page dated 18 September 2026 differs from indexed content dated 24 September. Its service-post deadlines are 23/25 September, while an internal-auditor employment row closes 30 September. No deadline is accepted until individual notices and amendments reconcile. Employment regime does not establish permanent tenure. Citizenship and mandatory language level are unverified.',
        'accessGap':common+' Ministry Interior vacancy link redirects to an archive, so it is not registered as a current index. Central civil-service portal and other ministries remain gaps. Preserve indexed/live disagreement; do not publish closed service entries as open.',
        'appointmentType':'statutory service versus Labour Code employment observed; tenure unknown',
        'internationalApplicantAssessment':'needs verification; no individual citizenship or residence route established',
        'languageAssessment':'needs verification; Czech page language is not a required level',
        'documents':[
            doc('https://mpo.gov.cz/zprava61716.html','Ministry vacancy overview with indexed/live disagreement','Czech','reader-accessible; official-index-content-differs',observedPageDate='2026-09-18',indexedPageDate='2026-09-24',deadlineAcceptance=False),
            doc('https://mv.gov.cz/sluzba/nabidky-sluzebnich-mist.aspx','Former ministry index redirects to archive','Czech','reader-redirect-to-archive',redirectedUrl='https://archiv.mv.gov.cz/sluzba/nabidky-sluzebnich-mist.aspx',notCurrentVacancyIndex=True),
        ],
    },
    {
        'id':'sk-cisss-state-service-recruitment','country':'SK',
        'name':'Slovakia — CISŠS state-service competitions',
        'authority':'Office of the Government of the Slovak Republic (Úrad vlády SR)',
        'homepage':'https://cisss.gov.sk/','discoveredFrom':'https://open.slovensko.sk/VK/Info',
        'notes':'Research only. CISŠS replaces the old selection portal from 1 June 2024. Current home links advertised competitions. Government guidance last changed 8 March 2021 describes indefinite and fixed-term service; Slovak, EU, EEA and Swiss citizens may seek admission, with reserved posts limited to Slovak citizens. State-language knowledge is required, but no CEFR threshold is given. Current legislation, full post requirements and the new application workflow need review.',
        'accessGap':common+' Legacy transition page is indexed but direct reader redirects to login error. Do not use pre-migration instructions for current submissions. eID access does not establish citizenship permission. Older general guidance is not accepted as current notice eligibility.',
        'appointmentType':'older guidance distinguishes indefinite and fixed-term service; current cycle terms unknown',
        'internationalApplicantAssessment':'older guidance includes EU/EEA/Swiss routes and Slovak-only reserved posts; applicability pending',
        'languageAssessment':'older guidance requires state-language knowledge; no formal level established',
        'documents':[
            doc('https://cisss.gov.sk/','Current official state-service portal','Slovak','reader-accessible'),
            doc('https://open.slovensko.sk/VK/Info','Official migration notice','Slovak','official-search-index-only; direct-reader-login-error',migrationEffectiveDate='2024-06-01'),
            doc('https://www.slovensko.sk/sk/zivotne-situacie/zivotna-situacia/_druhy-statnej-sluzby-a-podmie','General service types and admission guidance','Slovak','reader-accessible',publishedDate='2021-03-05',lastChangedDate='2021-03-08',currentLegalApplicabilityAccepted=False),
        ],
    },
    {
        'id':'si-gov-public-vacancies','country':'SI',
        'name':'Slovenia — GOV.SI public vacancies',
        'authority':'Government of Slovenia — GOV.SI vacancy directory',
        'homepage':'https://www.gov.si/zbirke/delovna-mesta/','discoveredFrom':'https://www.gov.si/zbirke/delovna-mesta/?nrOfItems=100&start=0&status=ongoing%40title',
        'notes':'Research only. Government vacancy table separates public competitions and other job advertisements, ongoing/closed status, fixed-term/indefinite employment, employer and duty city. September rows show both appointment terms. Table dates and locations need individual employer evidence; duty cities are not examination venues. No current individual nationality rule, language certificate or CEFR threshold was accepted.',
        'accessGap':common+' Filtered table reader initially worked, then subsequent base/filtered reads failed. Reader failure cannot prove no vacancies or closure. Reconcile individual notices, attached documents and amendments; public competition and other job advertisement are distinct routes.',
        'appointmentType':'table explicitly contains fixed-term and indefinite roles; individual cycle unaccepted',
        'internationalApplicantAssessment':'needs verification; no individual notice citizenship or residence rule accepted',
        'languageAssessment':'needs verification; Slovene interface does not establish proficiency',
        'documents':[
            doc('https://www.gov.si/zbirke/delovna-mesta/?nrOfItems=100&start=0&status=ongoing%40title','Official filtered vacancy table','Slovene','reader-accessible-initially; later-reader-timeout'),
            doc('https://www.gov.si/zbirke/delovna-mesta/','Government vacancy directory','Slovene','direct-reader-error'),
        ],
    },
    {
        'id':'gr-asep-public-recruitment','country':'GR',
        'name':'Greece — ASEP recruitment information portal',
        'authority':'Supreme Council for Civil Personnel Selection (ASEP), Greece',
        'homepage':'https://info.asep.gr/','discoveredFrom':'https://www.asep.gr/',
        'notes':'Research only. ASEP home links the official information portal for jobs, competitions and announcements. Home announces electronic services and helpdesk unavailable 25–30 September 2026 for maintenance/upgrades. This service outage does not establish application extensions or cancellations. Government service referral names ASEP and describes authenticated submissions and fees. Current cycle eligibility, appointment terms and mandatory language levels remain unknown.',
        'accessGap':common+' Separate information pages from applicant registry, results and electronic submissions. Do not infer open application cycles from announcements or exam appointments. Service outage notice is research context, not an accepted collector failure or deadline revision.',
        'appointmentType':'needs verification; no individual notice accepted',
        'internationalApplicantAssessment':'needs verification; Taxisnet registration is not nationality permission',
        'languageAssessment':'needs verification; Greek interface does not establish required language level',
        'documents':[
            doc('https://www.asep.gr/','ASEP home and electronic-service maintenance notice','Greek','reader-accessible',serviceOutageStart='2026-09-25',serviceOutageEnd='2026-09-30',doesNotEstablishDeadlineExtension=True),
            doc('https://info.asep.gr/','Officially linked recruitment information portal','Greek','reader-accessible'),
            doc('https://www.gov.gr/en/services/1001321/summetokhe-se-diagonismo-asep','Government competition service referral','English','official-search-index-only; direct-reader-empty',lastUpdatedDate='2025-07-15'),
        ],
    },
    {
        'id':'cy-psc-public-service-recruitment','country':'CY',
        'name':'Cyprus — Public Service Commission recruitment',
        'authority':'Public Service Commission, Republic of Cyprus',
        'homepage':'https://www.psc.gov.cy/PSC/psc.nsf/home_en/home_en',
        'discoveredFrom':'https://www.gov.cy/en/service/application-for-appointment-or-promotion-in-the-public-sector/',
        'notes':'Research only. Government service referral identifies the Public Service Commission as responsible for appointment/promotion applications via CY Login. Commission English home confirms authority identity but supplies no vacancy details. English referral contains a contradictory expansion of PSC; responsible department and commission identity support Public Service Commission, while translation requires review. Nationality, appointment type and mandatory language level remain unknown.',
        'accessGap':common+' English commission home is identity evidence, not a complete current recruitment index. Official Greek language link reader failed. Obtain current original competition notices and separate promotion from externally open appointments. CY Login does not establish eligibility.',
        'appointmentType':'needs verification; appointment versus promotion is not tenure',
        'internationalApplicantAssessment':'needs verification; account access is not foreign-citizen permission',
        'languageAssessment':'needs verification; English/Greek interface is not required proficiency',
        'documents':[
            doc('https://www.gov.cy/en/service/application-for-appointment-or-promotion-in-the-public-sector/','Government service and responsible commission referral','English','official-search-index-only; direct-reader-error',translationConflict='One sentence expands PSC as Political and Security Committee; responsible department identifies Public Service Commission.'),
            doc('https://www.psc.gov.cy/PSC/psc.nsf/home_en/home_en','Official commission identity','English with Greek navigation','reader-accessible; no-vacancy-details',greekLanguageLinkReader='failed'),
        ],
    },
    {
        'id':'mt-government-recruitment-portal','country':'MT',
        'name':'Malta — Government recruitment portal',
        'authority':'People & Standards Division, Government of Malta',
        'homepage':'https://recruitment.gov.mt/en/page/home','discoveredFrom':'https://recruitment.gov.mt/en/page/aboutus',
        'notes':'Research only. Portal separates internal/public recruitment. Closed Radiography example (29 December 2025) targets third-country nationals, definite employment, permits/entry conditions, EU-institution degree and professional registration. Closed Dental Technology example (17 July 2026) is indefinite and lists conditional citizenship/residence routes. Both allow alternative English proof by interview and Medical Maltese assessment before appointment confirmation. These historical routes are not general permission for foreign applicants.',
        'accessGap':common+' Exact English/Maltese originals and general provisions remain unretained; Maltese version controls interpretation. Interview-stage English alternatives include English-taught qualification, listed test certificates or qualifying work experience. IELTS wording and certificate validity require original-version review. Medical Maltese is not inferred CEFR. No unknown official timezone or venue is filled.',
        'appointmentType':'closed Radiography definite; closed Dental Technology indefinite; no current cycle accepted',
        'internationalApplicantAssessment':'historical Radiography explicitly targets third-country nationals; permits, entry, qualification and registration conditions remain separate from application permission',
        'languageAssessment':'historical examples offer English evidence alternatives by interview; listed IELTS 6 or source-listed equivalent certificates include CEFR B2; Medical Maltese before confirmation within one year, no CEFR inferred',
        'documents':[
            doc('https://recruitment.gov.mt/en/page/aboutus','Portal purpose and People & Standards Division','English','reader-accessible'),
            doc('https://recruitment.gov.mt/en/page/home','Official recruitment categories','English','reader-accessible'),
            doc('https://recruitment.gov.mt/en/job/e7dc44711414%285%288802-4c79-ba%28133%284c79-ba1a-980a215%2878435','Historical Radiography third-country-national call','English','reader-accessible-after-initial-timeout',publishedDate='2025-12-12',applicationClose='2025-12-29',observedCutoffClock='17:15',officialTimezone=None,exampleOnly=True,notCurrentOpportunity=True,originalMalteseRead=False),
            doc('https://recruitment.gov.mt/en/job/c187e3a12055%285%285270-48ea-b7%28133%2848ea-b726-1056d6e%2878435','Historical Dental Technology call','English','reader-accessible',publishedDate='2026-07-03',applicationClose='2026-07-17',observedCutoffClock='13:30',officialTimezone=None,exampleOnly=True,notCurrentOpportunity=True,originalMalteseRead=False),
        ],
    },
    {
        'id':'lu-govjobs-public-recruitment','country':'LU',
        'name':'Luxembourg — GovJobs public recruitment',
        'authority':'Government of Luxembourg — GovJobs / CGPO recruitment guidance',
        'homepage':'https://govjobs.public.lu/','discoveredFrom':'https://govjobs.public.lu/fr/nous-rejoindre/votre-parcours-de-recrutement.html',
        'notes':'Research only. Since 15 September 2026 most common-route recruitment begins with a post application, then integrated EAG and selection; language verification follows selection. General official-language thresholds are chosen order B2/B1/B1 for Luxembourgish, French and German, with exemptions and possible higher post-specific needs. EU/Swiss routes coexist with Luxembourg-only reserved posts and some non-EU education/exception routes. Salarié recruitment has separate rules. Status does not establish permanent tenure; full notice eligibility needs review.',
        'accessGap':common+' Preserve September reform and transition exceptions; older standalone-EAG prerequisites and language tables cannot drive current rules. Applicant chooses language order, so do not assign fixed B2 to French or Luxembourgish. Exact legislation, exemptions, individual posts and lawful work/residence conditions remain unaccepted.',
        'appointmentType':'fonctionnaire/employé/salarié are recruitment statuses; current tenure unknown',
        'internationalApplicantAssessment':'official guidance describes EU/Swiss access, reserved Luxembourg citizenship and limited non-EU routes; exact post permission unaccepted',
        'languageAssessment':'current common admission guide: candidate-chosen administrative-language order CEFR B2/B1/B1, assessed after selection; exemptions and post-specific higher requirements need review',
        'documents':[
            doc('https://govjobs.public.lu/fr/actualites/2026/reforme-recrutement-dans-la-fonction-publique.html','September recruitment reform announcement','French','reader-accessible-initially; later-reader-timeout; official-index-accessible',publishedDate='2026-09-17',lastChangedDate='2026-09-18',effectiveDate='2026-09-15'),
            doc('https://govjobs.public.lu/fr/nous-rejoindre/votre-parcours-de-recrutement.html','Current common recruitment stages and exceptions','French','reader-accessible',lastChangedDate='2026-09-14',effectiveDate='2026-09-15'),
            doc('https://govjobs.public.lu/fr/nous-rejoindre/conditions-admission.html','Admission overview','French','browser-accessible-after-reader-timeouts',lastChangedDate='2026-08-28'),
            doc('https://govjobs.public.lu/fr/nous-rejoindre/conditions-admission/langues-et-nationalite.html','Current nationality routes and language order','French','browser-and-reader-accessible',lastChangedDate='2026-09-14',effectiveDate='2026-09-15',languageOrderChosenByApplicant=True,currentLegalApplicabilityAccepted=False),
        ],
    },
    {
        'id':'md-cariere-public-service-recruitment','country':'MD',
        'name':'Moldova — Cariere public-service vacancies',
        'authority':'State Chancellery (Cancelaria de Stat), Republic of Moldova',
        'homepage':'https://cariere.gov.md/ro','discoveredFrom':'https://cariere.gov.md/ro/despre-noi-3477.html',
        'notes':'Research only. State Chancellery describes the unified portal for vacant/temporarily vacant public-service positions under the cited public-service framework. Ministry of Justice general conditions PDF lists Moldovan citizenship and state-language knowledge, with no formal language level. PDF is undated; current applicability and exact post conditions need review. Portal partner private job links do not become public-pathway evidence. General publication lead-time is not an application deadline.',
        'accessGap':common+' Reconcile portal and original employer notices. General citizenship PDF is not a portal-wide foreign-applicant ban for all employment regimes; date and current legislation need review. No account, CV or applicant profile collected; private partner vacancies excluded.',
        'appointmentType':'portal covers vacant and temporarily vacant posts; individual appointment terms unknown',
        'internationalApplicantAssessment':'undated Ministry of Justice public-service guidance requires Moldovan citizenship; scope/current applicability pending',
        'languageAssessment':'undated guidance requires state-language knowledge; no CEFR level or language name invented',
        'documents':[
            doc('https://cariere.gov.md/ro/despre-noi-3477.html','Official unified portal and State Chancellery identity','Romanian','reader-accessible'),
            doc('https://cariere.gov.md/ro','Current portal vacancy discovery','Romanian','official-search-index-only'),
            doc('https://justice.gov.md/public/files/file/posturi%20vacante/conditii.pdf','General public-service admission conditions','Romanian','reader-accessible-pdf',publishedDate=None,currentLegalApplicabilityAccepted=False),
        ],
    },
]
r=load('sources/registry.json'); c=load('data/published/coverage.json')
assert len(r['sources'])==194 and len(c)==81
assert not any(s['country'] in {i['country'] for i in items} for s in r['sources'])
previous=load('phases/phase-71-2026-09-27-baseline.json')
baseline={'savedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'registry':r,'coverage':c,
          'protectedFileHashes':previous['protectedFileHashes'],'protectedHashesProvenance':'Phase 71 terminal verifier confirmed all 83 health/review files; registry and coverage hashes rechecked before Phase 72 changes.'}
save(P+'baseline.json',baseline)
research=[]; added=[]
for item in items:
    s={k:item[k] for k in ['id','name','country','authority','homepage','discoveredFrom','notes','accessGap']}
    s.update(connector='none',cadenceHours=24,enabled=False,reviewRequired=True,discoveredAt='2026-09-27',
             licence='Official public-authority reader-only discovery. Original notices, collection terms, translations and extracted summaries require review before connector acceptance or publication.')
    added.append(s)
    research.append({'sourceId':s['id'],'country':s['country'],'pathways':['recruitment'],'status':'reader-only-research-awaiting-review','registry':s,
                     'appointmentType':item['appointmentType'],'internationalApplicantAssessment':item['internationalApplicantAssessment'],'languageAssessment':item['languageAssessment'],
                     'threeStageEligibility':{'canApply':'needs verification','canEnterSelection':'needs verification','canObtainJobOrLicence':'needs verification'},'documents':item['documents']})
    c.append({'jurisdictionCode':s['country'],'fixture':False,'status':'no-verified-listings','researchedAuthorities':[s['authority']],
              'connectedSourceCount':0,'unresolvedGaps':[s['name']+': '+s['accessGap']],'lastSuccessfulFetchAt':None,'lastValidatedAt':None})
save(MATRIX,{'researchDate':'2026-09-27','notPublishedEligibility':True,'sourceCountIsNotCycleCount':True,'translationAcceptance':'pending-human-review','rawOriginalsRetained':False,
             'readerObservationIsNotCollectorFetchOrValidation':True,'storagePolicy':'No writes to data/evidence; cap and collection pause unchanged.','sources':research})
r['sources'].extend(added); save('sources/registry.json',r); save('data/published/coverage.json',c); save(P+'source-config.json',added)
print(json.dumps({'registeredSources':len(r['sources']),'indiaSources':sum(s['country']=='IN' for s in r['sources']),'sourcePresenceJurisdictions':len({s['country'] for s in r['sources']}),'disabledAdded':len(added),'evidenceBytesAdded':0}))

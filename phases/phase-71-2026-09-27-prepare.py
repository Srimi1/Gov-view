"""Register six reader-only official sources without evidence or review-queue writes."""
from pathlib import Path
import datetime
import json

ROOT = Path(__file__).resolve().parent.parent
P = 'phases/phase-71-2026-09-27-'
MATRIX = 'data/discovery/central-southeast-europe-public-source-matrix-2026-09-27.json'

def load(path):
    return json.loads((ROOT/path).read_text())

def save(path, value):
    (ROOT/path).write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n')

def doc(url, label, language, status, **extra):
    return {'url':url,'label':label,'sourceLanguage':language,'observationDate':'2026-09-27',
            'readerStatus':status,'rawOriginalRetained':False,'originalSha256':None,
            'collectorSuccessfulFetchAt':None,'validatedAt':None,**extra}

common = 'Reader-only discovery; no retained original bytes, adapter, accepted translation or reviewed cycle. Automated access and reuse terms remain unassessed. Notice-specific residence, qualifications, age, fees, official timezone, venues and complete eligibility need review. Other authorities and pathways remain gaps.'
items = [
    {
        'id':'ro-posturi-public-contractual-recruitment','country':'RO',
        'name':'Romania — Posturi public-sector contractual recruitment',
        'authority':'Government of Romania — Information Technology Directorate',
        'homepage':'https://posturi.gov.ro/','discoveredFrom':'https://posturi.gov.ro/despre/',
        'notes':'Research only. Portal covers central/local public institutions, especially contractual personnel. Government Decision 1336/2022 lists Romanian, EU, EEA or Swiss citizenship and written/spoken Romanian for covered posts; no CEFR threshold was established. Scope exclusions and current post criteria need review. Sample SGG consilier II is indefinite employment. Its header deadline is 23 October 2026, while the application calendar ends 5 October; do not rely on the header as an application deadline.',
        'accessGap':common+' Reconcile sample header/body date conflict with original employer notice; some calendar rows have missing days. The linked original could not be read. Legislative reader shows a 27 April 2023 consolidation history; applicability and subsequent changes need review. Separate statutory civil-service and contractual routes.',
        'appointmentType':'sample SGG consilier II explicitly indefinite employment; portal-wide tenure is not uniform',
        'internationalApplicantAssessment':'covered contractual framework includes qualifying EU/EEA/Swiss citizenship; scope exclusions and complete cycle criteria need review',
        'languageAssessment':'written and spoken Romanian in framework; no formal proficiency level established',
        'documents':[
            doc('https://posturi.gov.ro/despre/','Official portal scope and operator','Romanian','reader-accessible'),
            doc('https://posturi.gov.ro/joburi/consilier-ii-4/','SGG consilier II sample with date conflict','Romanian','reader-accessible',publishedDate='2026-09-22',observedHeaderDeadline='2026-10-23',observedBodyApplicationClose='2026-10-05',officialTimezone=None,originalEmployerNoticeReader='failed'),
            doc('https://legislatie.just.ro/public/DetaliiDocument/261250','Government Decision 1336/2022, articles 3, 14 and 15','Romanian','reader-accessible',publishedDate='2022-11-08',observedConsolidationHistoryDate='2023-04-27',currentLegalApplicabilityAccepted=False),
        ],
    },
    {
        'id':'hu-kozszolgallas-public-recruitment','country':'HU',
        'name':'Hungary — KÖZSZOLGÁLLÁS public-service jobs',
        'authority':'Government of Hungary — KÖZSZOLGÁLLÁS public-service portal',
        'homepage':'https://kozszolgallas.ksz.gov.hu/','discoveredFrom':'https://bmprojektek.kormany.hu/verseny',
        'notes':'Research only. Official portal indexed content identifies KÖZSZOLGÁLLÁS as public-service job search. Interior Ministry project history identifies this system among public-service recruitment tools. Current reader access failed, so no individual notice, foreign-citizen route, appointment term or mandatory language level was verified. Hungarian interface language is not a proficiency requirement. Search results, profile registration and general mobility tools do not establish applicant eligibility.',
        'accessGap':common+' Portal identity is supported by its official indexed page and historical government project material; current operator details and live vacancy access require confirmation. Keep employer notices and legal employment regimes distinct. No applicant profiles or CV data collected.',
        'appointmentType':'needs verification; no individual notice accepted',
        'internationalApplicantAssessment':'needs verification; no notice-specific citizenship or residence route established',
        'languageAssessment':'needs verification; Hungarian interface is not a required level',
        'documents':[
            doc('https://kozszolgallas.ksz.gov.hu/','Official public-service portal identity','Hungarian','official-search-index-only; direct-reader-error'),
            doc('https://bmprojektek.kormany.hu/verseny','Interior Ministry project history identifying recruitment systems','Hungarian','official-search-index-only',historicalProjectEnd='2023-11-15',notCurrentOperatorAudit=True),
        ],
    },
    {
        'id':'hr-centralized-civil-service-recruitment','country':'HR',
        'name':'Croatia — centralized civil-service recruitment',
        'authority':'Ministry of Justice, Public Administration and Digital Transformation, Croatia',
        'homepage':'https://selekcija.gov.hr/',
        'discoveredFrom':'https://mpudt.gov.hr/pristup-informacijama-6341/centralizirani-sustav-za-zaposljavanje/29518?lang=de',
        'notes':'Research only. Ministry guidance covers fixed-term and indefinite civil-service recruitment and permits public notice browsing without login. Applications use NIAS authentication; test dates and places are later notified to candidates. September 2026 ministry news distinguishes internal advertisements, candidate-pool recruitment and public competitions. Electronic testing does not prove an online exam venue. Citizenship, required language level and full post criteria remain unverified.',
        'accessGap':common+' Linked portal reader returned no content. Guidance cites 2023/2024 legislation; September 2026 news discusses proposed amendments, not proof of enacted final rules. Verify current legislation and employer notices. Authentication access is separate from legal eligibility; no published exam pin inferred.',
        'appointmentType':'directory supports fixed-term and indefinite service; each cycle needs its own term',
        'internationalApplicantAssessment':'needs verification; NIAS login capability does not establish citizenship eligibility',
        'languageAssessment':'needs verification; no formal language requirement read',
        'documents':[
            doc('https://mpudt.gov.hr/pristup-informacijama-6341/centralizirani-sustav-za-zaposljavanje/29518?lang=de','Ministry guidance and official portal referral','Croatian','reader-accessible',queryLanguageParameterDoesNotEstablishContentLanguage=True),
            doc('https://selekcija.gov.hr/','Central recruitment portal','Croatian','reader-empty; no-notice-rows'),
            doc('https://mpudt.gov.hr/vijesti-8/sjednica-vlade-unaprjedjuje-se-centralizirani-sustav-za-zaposljavanje/31064','Ministry news on recruitment routes and proposed amendments','Croatian','reader-accessible',publishedDate='2026-09-04',proposalNotAcceptedAsEnactedLaw=True),
        ],
    },
    {
        'id':'bg-iisda-administrative-competitions','country':'BG',
        'name':'Bulgaria — Administrative Register recruitment competitions',
        'authority':'Government of Bulgaria — Administrative Register',
        'homepage':'https://iisda.government.bg/competitions/competitions_list/for_positions',
        'discoveredFrom':'https://jobs.government.bg/PJobs/adverJobs.jsf?sect=6',
        'notes':'Research only. Official Administrative Register distinguishes service relationships from employment relationships and provides competitions by role and administrative body. Government jobs guidance describes notice requirements, application documents and deadlines; its portal separates recruitment, mobility and student internships. Mobility is not an open route for every applicant. Employment regime does not establish permanent tenure. Nationality, residence and mandatory language levels remain notice-specific and unverified.',
        'accessGap':common+' Register reader initially returned a page, then timed out; jobs portal direct reader failed. Obtain current individual notice and reconcile register, portal and employer amendments without double counting. Portal or role-category totals are not distinct application-cycle totals. No automatic health timestamp recorded.',
        'appointmentType':'service versus employment relationship visible; permanent/fixed-term tenure remains unknown',
        'internationalApplicantAssessment':'needs verification; recruitment, mobility and internships have distinct admission rules',
        'languageAssessment':'needs verification; Bulgarian interface does not establish proficiency threshold',
        'documents':[
            doc('https://iisda.government.bg/competitions/competitions_list/for_positions','Administrative Register competitions by position','Bulgarian','reader-accessible-initially; later-reader-timeout'),
            doc('https://jobs.government.bg/PJobs/adverJobs.jsf?sect=6','Government jobs notice guidance','Bulgarian','official-search-index-only; direct-reader-error'),
            doc('https://www.jobs.government.bg/PJobs/index.jsf','Recruitment, mobility and internship portal','Bulgarian','official-search-index-only; direct-reader-error'),
        ],
    },
    {
        'id':'rs-suk-public-recruitment','country':'RS',
        'name':'Serbia — SUK public recruitment competitions',
        'authority':'Human Resource Management Service (Služba za upravljanje kadrovima), Serbia',
        'homepage':'https://www.suk.gov.rs/konkursi/170',
        'discoveredFrom':'https://www.suk.gov.rs/konkursi/170',
        'notes':'Research only. SUK separates public/internal competitions and international competitions. A Basic Court in Vranje record published 10 June 2026 closed 25 June; it is a historical example, not an open application. That role requires Serbian citizenship and indefinite employment. Written business communication is assessed, but no language certificate or CEFR level was established. These criteria cannot be generalized to every Serbian public employer or international competition.',
        'accessGap':common+' Index reader returned a filter form with no result rows; this cannot prove no current opportunities. Vranje original employer amendments and full evidence remain unretained. September State Audit notice appeared in official indexed content but direct reader failed; it was not extracted or published. Preserve annual notice identities and exclude candidate/result lists.',
        'appointmentType':'historical Vranje example explicitly indefinite employment; current roles need notice evidence',
        'internationalApplicantAssessment':'historical Vranje role requires Serbian citizenship; other competitions remain unverified',
        'languageAssessment':'written business communication assessed in historical sample; no formal language level established',
        'documents':[
            doc('https://www.suk.gov.rs/konkursi/170','Public recruitment index and categories','Serbian Cyrillic','reader-accessible; no-result-rows'),
            doc('https://www.suk.gov.rs/konkurs/170/6a2a877bcb737','Basic Court Vranje historical court-recording role','Serbian Cyrillic','reader-accessible',publishedDate='2026-06-10',applicationClose='2026-06-25',exampleOnly=True,notCurrentOpportunity=True),
            doc('https://suk.gov.rs/konkurs/170/6aa1168e510b0','State Audit September notice discovery lead','Serbian Cyrillic','official-search-index-only; direct-reader-error',publishedDate='2026-09-09',indexedApplicationClose='2026-09-24',notExtracted=True),
        ],
    },
    {
        'id':'ba-ads-state-civil-service-recruitment','country':'BA',
        'name':'Bosnia and Herzegovina — state Civil Service Agency recruitment',
        'authority':'Civil Service Agency of Bosnia and Herzegovina (Agencija za državnu službu BiH)',
        'homepage':'https://ads.gov.ba/open-vacancies','discoveredFrom':'https://ads.gov.ba/',
        'notes':'Research only. State Civil Service Agency separates open, in-progress, trainee and finished competitions. In-progress selection and completed results are not new application windows. An indexed legacy competition directory includes expired and internal advertisements; no live notice was accepted. Nationality, residence, appointment type and mandatory language level remain unknown. State-institution recruitment does not establish coverage of entity, cantonal, municipal or Brčko District employers.',
        'accessGap':common+' Open-vacancy reader showed agency navigation without vacancy details; legacy directory and sampled PDF reader failed. Reconcile the current agency interface with legacy notice identities before collection. Federation, Republika Srpska, cantonal and Brčko authorities require separate research. Do not treat empty reader output as a checked-empty source.',
        'appointmentType':'needs verification; no live individual notice accepted',
        'internationalApplicantAssessment':'needs verification; no nationality or residence criteria accepted',
        'languageAssessment':'needs verification; original notice languages and levels not accepted',
        'documents':[
            doc('https://ads.gov.ba/','State Civil Service Agency identity and competition categories','Bosnian/Croatian/Serbian Latin interface; exact variety unverified','reader-accessible; agency-navigation'),
            doc('https://ads.gov.ba/open-vacancies','Officially linked open competitions','Bosnian/Croatian/Serbian Latin interface; exact variety unverified','reader-accessible; no-vacancy-details'),
            doc('https://konkursi.ads.gov.ba/Konkurs/KonkursiList','Legacy official competition directory','Bosnian/Croatian/Serbian Latin indexed content; exact variety unverified','official-search-index-only; direct-reader-error'),
            doc('https://konkursi.ads.gov.ba/Konkurs/GetTekstObjaveKonkursaPDF?konkursId=535','Sample legacy original notice','unverified; document not read','direct-reader-error; original-not-read'),
        ],
    },
]
r=load('sources/registry.json'); c=load('data/published/coverage.json')
assert len(r['sources'])==188 and len(c)==75
assert not any(s['country'] in {'RO','HU','HR','BG','RS','BA'} for s in r['sources'])
previous=load('phases/phase-70-2026-09-27-baseline.json')
baseline={'savedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'registry':r,'coverage':c,
          'protectedFileHashes':previous['protectedFileHashes'],'protectedHashesProvenance':'Phase 70 terminal verifier confirmed all 83 health/review files; registry and coverage hashes rechecked before Phase 71 changes.'}
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

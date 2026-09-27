"""Save reader-only official discovery and add five disabled sources, preserving prior state."""
from pathlib import Path
import datetime
import hashlib
import json

ROOT = Path(__file__).resolve().parent.parent
P = 'phases/phase-70-2026-09-27-'
MATRIX = 'data/discovery/europe-public-source-matrix-2026-09-27.json'

def load(path):
    return json.loads((ROOT / path).read_text())

def save(path, data):
    (ROOT / path).write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')

def document(url, label, language, reader_status, **extra):
    return {'url': url, 'label': label, 'sourceLanguage': language,
            'observationDate': '2026-09-27', 'readerStatus': reader_status,
            'rawOriginalRetained': False, 'originalSha256': None,
            'collectorSuccessfulFetchAt': None, 'validatedAt': None, **extra}

common_gap = ('Reader-only discovery; no exact original bytes retained, adapter, accepted translation or reviewed cycle. '
              'Permitted automated access and reuse terms remain unassessed. Verify current notice-specific nationality, '
              'residence, age, qualifications, appointment type, language, dates/timezone, fees and venues before any eligibility result. '
              'Original notices remain unverified.')
items = [
    {
        'id': 'is-starfatorg', 'country': 'IS',
        'name': 'Iceland — Starfatorg government vacancies',
        'authority': 'Financial Management Authority (Fjársýslan), Iceland',
        'homepage': 'https://island.is/starfatorg',
        'discoveredFrom': 'https://island.is/en/o/the-financial-management-authority/starfatorg',
        'notes': 'Research only. Official indexed authority page identifies Starfatorg as the government vacancy platform for A-section state institutions. Live reader access failed; current job details were not verified. Citizenship, residence, appointment type and required language level remain unknown. Icelandic or English page language does not establish applicant proficiency requirements or foreign-citizen eligibility.',
        'accessGap': common_gap + ' Authority identification uses official search-indexed pages and crosslinks; homepage/authority reader errors and a Directorate of Immigration crosslink returning 403 leave current notice access unresolved. Other public employers and pathways remain gaps.',
        'internationalApplicantAssessment': 'needs verification; no notice-level nationality or residence criteria verified',
        'languageAssessment': 'required language and level unknown; interface languages are not criteria',
        'documents': [
            document('https://island.is/en/o/the-financial-management-authority/starfatorg', 'Official platform identity', 'English', 'official-search-index-only; direct-reader-error'),
            document('https://island.is/starfatorg', 'Vacancy platform', 'Icelandic', 'direct-reader-error'),
            document('https://island.is/en/o/directorate-of-immigration/vacancies', 'Official employer referral', 'English', 'official-search-index-only; direct-reader-403'),
        ],
    },
    {
        'id': 'ee-public-service-competitions', 'country': 'EE',
        'name': 'Estonia — central public-service competitions',
        'authority': 'Ministry of Finance (Rahandusministeerium), Estonia',
        'homepage': 'https://www.rahandusministeerium.ee/et/avalikud-konkursid',
        'discoveredFrom': 'https://www.fin.ee/riigihaldus-ja-avalik-teenistus-kinnisvara/avalik-teenistus/varbamine-ja-valik',
        'notes': 'Research only. Ministry guidance distinguishes public-power officials under the Public Service Act from support employees under employment contracts. It permits qualifying EU-member citizens to apply for official posts and requires Estonian at the legally prescribed level; no numeric CEFR level was established. Position restrictions and complete criteria need review. Contract employee advertisements are optional in the central directory, so it cannot prove complete public employment coverage. Generic 14-day advertisement duration is not a verified cycle deadline.',
        'accessGap': common_gap + ' Ministry guidance was reader-accessible; its linked central competitions URL timed out. Check current legislation, reserved posts, employment-contract routes and employer notices. Other public employers and pathways remain gaps.',
        'internationalApplicantAssessment': 'general guidance includes qualifying EU citizens; role restrictions and non-EU employment routes need verification',
        'languageAssessment': 'Estonian at statutory level; exact level and additional languages must come from current role evidence',
        'documents': [
            document('https://www.fin.ee/riigihaldus-ja-avalik-teenistus-kinnisvara/avalik-teenistus/varbamine-ja-valik', 'Recruitment and selection guidance', 'Estonian', 'reader-accessible', locator='Recruitment and selection section'),
            document('https://www.rahandusministeerium.ee/et/avalikud-konkursid', 'Officially linked competitions portal', 'Estonian', 'direct-reader-timeout'),
        ],
    },
    {
        'id': 'lv-nva-public-vacancy-discovery', 'country': 'LV',
        'name': 'Latvia — NVA public-employer vacancy discovery',
        'authority': 'State Employment Agency (Nodarbinātības valsts aģentūra), Latvia',
        'homepage': 'https://cvvp.nva.gov.lv/',
        'discoveredFrom': 'https://www.nva.gov.lv/lv/registret-vakanci',
        'notes': 'Research only. NVA guidance says state/municipal institutions and companies with more than 50% state/municipal ownership must publish open recruitment competitions in its portal. Public vacancy search is available without registration. The portal mixes public and private employers; only evidenced public employers belong in GOV View recruitment discovery. Nationality, residence, appointment type and mandatory language levels were not established. General EURES recruitment guidance does not grant access to every public-service post.',
        'accessGap': common_gap + ' NVA guidance was reader-accessible; portal reader yielded a JavaScript template without vacancy rows. Public-employer classification, current original notices and portal access remain unresolved. Exclude private jobs and applicant CV/profile data. Other authorities and pathways remain gaps.',
        'internationalApplicantAssessment': 'needs verification; general European recruitment guidance does not prove civil-service permission',
        'languageAssessment': 'notice-specific requirements unknown; Latvian interface does not establish a proficiency threshold',
        'documents': [
            document('https://www.nva.gov.lv/lv/registret-vakanci', 'Vacancy registration and mandatory public-employer publication guidance', 'Latvian', 'reader-accessible', publishedDate='2020-05-14', updatedDate='2026-04-21'),
            document('https://www.nva.gov.lv/lv/meklet-vakances', 'Public search and official portal referral', 'Latvian', 'reader-accessible'),
            document('https://cvvp.nva.gov.lv/', 'Official vacancy portal', 'Latvian', 'reader-template-only; no-vacancy-rows'),
        ],
    },
    {
        'id': 'lt-vva-dirbuvalstybei', 'country': 'LT',
        'name': 'Lithuania — VVA public-sector vacancy portal',
        'authority': 'Public Management Agency (Viešojo valdymo agentūra), Lithuania',
        'homepage': 'https://dirbuvalstybei.vva.lt/',
        'discoveredFrom': 'https://vva.lrv.lt/lt/prasymo-teikimas/',
        'notes': 'Research only. Agency guidance for statutory civil servants requires Lithuanian citizenship and Lithuanian at government-set categories; this does not establish restrictions for every public-sector employment contract. Role-required foreign-language competence is checked before commission assessment or functional-skills evaluation. Conditional C1 credit for specified education or a required native language is an exemption route, not a universal minimum. Current notices, legal categories and appointment type need verification; portal reader access returned 403.',
        'accessGap': common_gap + ' Citizenship guidance was last updated 13 December 2024; current consolidated law reader access failed. Foreign-language guidance was updated 31 August 2026. Separate statutory and contractual posts, language proof routes and post-specific levels. Other public employers and pathways remain gaps.',
        'internationalApplicantAssessment': 'statutory-service guidance requires Lithuanian citizenship; current law and other public employment routes need review',
        'languageAssessment': 'Lithuanian statutory categories; required foreign-language proof before selection; conditional C1 credits are not a universal level',
        'documents': [
            document('https://vva.lrv.lt/lt/prasymo-teikimas/', 'Application guidance and official portal referral', 'Lithuanian', 'reader-accessible'),
            document('https://dirbuvalstybei.vva.lt/', 'Public-sector vacancy portal', 'Lithuanian', 'direct-reader-403'),
            document('https://vva.lrv.lt/lt/aktualu-planuojantiems-grizti-gyventi-i-lietuva/', 'Returning-resident statutory-service guidance', 'Lithuanian', 'reader-accessible', updatedDate='2024-12-13'),
            document('https://vva.lrv.lt/lt/uzsienio-kalbu-tikrinimas/', 'Foreign-language verification guidance', 'Lithuanian', 'reader-accessible', updatedDate='2026-08-31'),
            document('https://www.e-tar.lt/rs/actualedition/TAR.D3ED3792F52B/xIXGdlhbmC/', 'Linked consolidated Public Service Act', 'Lithuanian', 'direct-reader-error; current-consolidation-not-verified'),
        ],
    },
    {
        'id': 'pl-kprm-civil-service-recruitment', 'country': 'PL',
        'name': 'Poland — KPRM civil-service recruitment',
        'authority': 'Chancellery of the Prime Minister, Civil Service Department, Poland',
        'homepage': 'https://nabory.kprm.gov.pl/',
        'discoveredFrom': 'https://www.gov.pl/web/sluzbacywilna/praca',
        'notes': 'Research only. Official civil-service guidance links this recruitment database and distinguishes essential from additional requirements: all essential conditions must be met for the next stage. The portal separates recruitment advertisements from results and active from archived notices. Remote recruitment is a selection-process label, not permission to work online or an exam venue. Appointment term, foreign-citizen routes and required language level remain notice-specific and unverified. Portal job totals are not GOV View distinct-cycle counts.',
        'accessGap': common_gap + ' Portal and authority guidance were reader-accessible, but no individual notice or full selection bases were reviewed. Keep results, archived notices and current applications distinct. Central civil-service directory is not complete government-employer or pathway coverage.',
        'internationalApplicantAssessment': 'needs verification; no individual notice foreign-citizen route accepted',
        'languageAssessment': 'required language and formal level unknown until role notice and selection bases reviewed',
        'documents': [
            document('https://www.gov.pl/web/sluzbacywilna/praca', 'Civil-service application guidance', 'Polish', 'reader-accessible'),
            document('https://nabory.kprm.gov.pl/', 'Recruitment database', 'Polish', 'reader-accessible; search-form-without-reviewed-individual-notice'),
        ],
    },
]
registry = load('sources/registry.json')
coverage = load('data/published/coverage.json')
assert len(registry['sources']) == 183 and len(coverage) == 70
assert sum(s['country'] == 'IN' for s in registry['sources']) == 99
assert not any(s['country'] in {'IS','EE','LV','LT','PL'} for s in registry['sources'])
prior = load('phases/phase-69-2026-09-27-baseline.json')
assert load('phases/phase-69-2026-09-27-checkpoint.json')['storageAudit']['exitCode'] == 0
baseline = {
    'savedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'registry': registry, 'coverage': coverage,
    'protectedFileHashes': {p: h for p,h in prior['unchanged'].items()
                            if p not in {'sources/registry.json','data/published/coverage.json'}},
    'protectedHashesProvenance': 'Phase 69 terminal verifier confirmed all 85 files before Phase 70 registry/coverage changes.',
}
save(P + 'baseline.json', baseline)
research = []
new_sources = []
for item in items:
    s = {k:item[k] for k in ['id','name','country','authority','homepage','discoveredFrom','notes','accessGap']}
    s.update(connector='none', cadenceHours=24, enabled=False, reviewRequired=True,
             discoveredAt='2026-09-27', licence='Official public-authority reader-only discovery. Original notices, collection terms, translations and extracted summaries require review before connector acceptance or publication.')
    new_sources.append(s)
    research.append({
        'sourceId': s['id'], 'country': s['country'], 'pathways': ['recruitment'],
        'status': 'reader-only-research-awaiting-review', 'registry': s,
        'appointmentType': 'needs verification; no cycle accepted',
        'internationalApplicantAssessment': item['internationalApplicantAssessment'],
        'languageAssessment': item['languageAssessment'],
        'threeStageEligibility': {'canApply': 'needs verification', 'canEnterSelection': 'needs verification', 'canObtainJobOrLicence': 'needs verification'},
        'documents': item['documents'],
    })
    coverage.append({
        'jurisdictionCode': s['country'], 'fixture': False, 'status': 'no-verified-listings',
        'researchedAuthorities': [s['authority']], 'connectedSourceCount': 0,
        'unresolvedGaps': [s['name'] + ': ' + s['accessGap']],
        'lastSuccessfulFetchAt': None, 'lastValidatedAt': None,
    })
save(MATRIX, {'researchDate': '2026-09-27', 'notPublishedEligibility': True,
              'sourceCountIsNotCycleCount': True, 'translationAcceptance': 'pending-human-review',
              'rawOriginalsRetained': False, 'readerObservationIsNotCollectorFetchOrValidation': True,
              'storagePolicy': 'No writes to data/evidence; cap and collection pause unchanged.', 'sources': research})
registry['sources'].extend(new_sources)
save('sources/registry.json', registry)
save('data/published/coverage.json', coverage)
save(P + 'source-config.json', new_sources)
print(json.dumps({'registeredSources': len(registry['sources']), 'indiaSources': 99, 'jurisdictionsWithSourcePresence': len({s['country'] for s in registry['sources']}), 'disabledAdded': len(new_sources), 'evidenceBytesAdded': 0}))

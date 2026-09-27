"""Save Phase 90 curated research, browser observations and process receipts."""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parent.parent
P = 'phases/phase-90-2026-09-27-'
M = 'data/discovery/india-coal-india-irel-cote-ivoire-togo-recruitment-2026-09-27.json'

def save(path, value):
    (ROOT/path).write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n')

identity = {
    'url': 'https://dae.gov.in/public-sector-units/',
    'type': 'official-parent-identity-index',
    'observationMethod': 'primary-government-search-index',
    'summary': 'DAE public-sector-units primary index identifies IREL (India) Limited. Direct reader request timed out; current ownership percentage and recruitment conditions are not accepted from indexed identity. Direct official identity/original review remains pending.',
}
research = json.loads((ROOT/(P+'research-input.json')).read_text())
matrix = json.loads((ROOT/M).read_text())
if not any(d['url']==identity['url'] for d in research[1]['documents']):
    research[1]['documents'].append(identity)
    matrix['sources'][1]['documents'].append(dict(identity, observationDate='2026-09-27',
        rawOriginalRetained=False, originalSha256=None, collectorSuccessfulFetchAt=None, validatedAt=None))
save(P+'research-input.json', research)
save(M, matrix)

browser = {
    'phase':90, 'status':'passed',
    'countries': {
        'IN': {'currentPreview':True,'registeredSources':110,'filteredSources':1,
            'coalIndiaFilterMatches':1,'irelFullNameFilterMatches':1,'reviewWarning':True,
            'newSourceLinks':['https://www.coalindia.in/career-cil/jobs-coal-india/','https://irel.co.in/careers']},
        'CI': {'currentPreview':True,'registeredSources':1,'publicListings':0,'sourcesFetched':0,
            'lastSuccessfulFetch':'Never','lastValidation':'Never','reviewWarning':True,
            'newSourceLinks':['https://www.fonctionpublique.gouv.ci/']},
        'TG': {'currentPreview':True,'registeredSources':1,'publicListings':0,'sourcesFetched':0,
            'lastSuccessfulFetch':'Never','lastValidation':'Never','reviewWarning':True,
            'newSourceLinks':['https://www.fonctionpublique.gouv.tg/actualites']},
    },
    'sharedIndiaViewRestored':True, 'indiaClearRestores110':True,
    'shareURL':'http://localhost:3003/coverage/IN/?sourceQuery=Coal%20India#official-sources',
    'shareContainsOnlyPublicDisplayState':True,
    'screenshot':P+'source-preview.png','failures':[],
    'observations':[
        'Initial India navigation timeout; same handle rendered Coal India one of 110 with correct official link.',
        'IREL full-name filter one of 110 with correct source and review warning.',
        'Clear restored all 110 and removed sourceQuery.',
        'Fresh share initially rendered server default 110; after hydration Coal India query restored one of 110.',
        'CI/TG each one source, zero public/fetched, Never fetch/validation, research warning and explicit access gaps.',
        'Local preview screenshot saved and visually checked. No browser protection changes.',
    ],
    'scope':'Directory and public filter checks only; no extraction acceptance or worldwide audit.',
}
save(P+'browser-checks.json', browser)
processes = {
    'phase':90,
    'preparation':{'exitCode':0,'chunkId':'d88be3','sourcesAdded':4,'protectedFilesRechecked':83},
    'focusedTests':{'exitCode':0,'chunkId':'4edfae','passed':6,'failed':0,'log':P+'focused-tests.txt'},
    'publicDataBuild':{'exitCode':0,'chunkId':'f940ef','publicListings':0,'log':P+'public-data-build.txt'},
    'logRead':{'exitCode':0,'chunkId':'e5c024','actualPass6Fail0Verified':True},
    'priorFullSuite':{'phase':78,'passed':364,'typecheckExitCode':0,'rerunThisPhase':False},
    'newEvidenceBytes':0,'productionBuildRun':False,
    'researchFailures':[
        'Coal employer reader 403; GATE original unreviewed; CBT original available through reader only.',
        'IREL CMD PDF reader text unavailable and browser viewer blank; DAE identity direct reader timed out.',
        'CI order primary indexed but direct reader/browser PDF unread; indexed translation unaccepted.',
        'Togo migrated pages show ministry shell; old PDF path now HTML under construction.',
    ],
    'browser':{'status':'passed','countries':['IN','CI','TG'],'sharedFilterRestored':True,
        'clearRestored':110,'screenshot':P+'source-preview.png','noProtectionChanges':True},
    'finalVerifier':{'status':'pending'},
}
save(P+'process-results.json', processes)

report = '''# Phase 90 — Coal India, IREL, Côte d’Ivoire and Togo

Research date: 27 September 2026. Directory expansion only. Observations remain drafts awaiting original-evidence and founder review. No accepted collector or published cycle added.

## Official source findings

| Source | Observed | Unresolved |
| --- | --- | --- |
| [Coal India jobs](https://www.coalindia.in/career-cil/jobs-coal-india/) | Career hub and mixed index; original CBT 03/2026 read through official-host referral. | Complete inventory, GATE originals, amendments, timezone and collection permission. |
| [IREL careers](https://irel.co.in/careers) | Regular executive row, CMD appointment and separate apprenticeships. | Current original, citizenship/residence, language, tenure and direct authority identity review. |
| [Côte d’Ivoire public service](https://www.fonctionpublique.gouv.ci/) | Ministry browser page refers 2026 administrative order and GUCA portal. | Original unread; indexed nationality/age translation unaccepted, opening communiqués needed. |
| [Togo recruitment notices](https://www.fonctionpublique.gouv.tg/actualites) | Primary indexed teacher/forestry and ENA notices; migrated direct page shows ministry shell. | Original URLs and full current inventory, revised dates and all critical fields. |

### Coal India sample

[Original CBT advertisement 03/2026, 5 May](https://d3u7ubx0okog7j.cloudfront.net/documents/Advertisement_03_2026_dated_05.05.2026.pdf) identifies government undertaking under Ministry of Coal. Section 11(a) restricts applicants to Indian nationals. Foreign-degree recognition does not waive citizenship. Role-specific degree, age and experience, provisional CBT entry, document verification, medical fitness and employment/NOC requirements remain independent.

Original application window 12 May 10:00–11 June 2026 18:00, governing timezone unstated. Original application has ended; later September CBT notice was not reconciled. One-year training/probation leads to confirmed E-1 officer service; service bond is not fixed-term duration. Hindi/English question papers, English governs discrepancies, General English component; Hindi Rajbhasha role has specific Hindi/English academic qualifications. No CEFR level stated.

Index displayed 187 entries; first 20 inspected. Entries mix annual intakes, results, cancellations, advisor contracts and medical admission. Count is not distinct current cycles. GATE-2027 notice appeared but original was not accepted; CBT rules cannot transfer. Nationwide subsidiaries do not establish subdivision collection scopes or examination venues. Employer reader 403, ordinary browser rendered after non-binding notice; no bypass.

### IREL

Index labels CO/HRM/35/2026 regular executive recruitment, closed 17 August, with separate corrigendum. Current Chairman/Managing Director index end is 8 October, date only. Original reader returned PDF with no extracted text; browser viewer remained blank after timeout. Current nationality/residence, qualifications, cutoff hour/timezone, language and appointment duration remain unknown. Regular executive title does not establish CMD duration. Chavara apprenticeship extension to 10 April is a separate training route, not a current permanent job.

[DAE primary public-sector-units page](https://dae.gov.in/public-sector-units/) indexed IREL; direct reader timed out. [DAE overview](https://dae.gov.in/about-dae/) also indexed IREL among public-sector undertakings. Parent identity lead saved; exact ownership percentage and recruitment rules not accepted from index. Registry retains direct identity review gap. English/Hindi interface is not applicant proficiency. Operating units are not examination venues or state collection scopes.

### Côte d’Ivoire

Ministry homepage browser refers [2026 administrative opening order](https://www.fonctionpublique.gouv.ci/assets/css/ARRETE_OUVERTURE_CONCOURS_ADMINISTRATIFS_26.pdf) and [GUCA](https://gucaci.ciconcours.com/). Portal was not opened for account creation or personal results. Current results and 2025 medical-visit relaunch do not establish new applications.

Primary indexed Article 3 names Ivorian nationality, civic/integration criteria and grade-specific age thresholds; foreign diploma equivalence is separate. Indexed age text: minimum 18 at 31 December 2025, maximum 42 for D1–A3 and 47 for A4 under 2026 exception. Direct three-page PDF reader has no text and browser pages blank, so translation and critical fields remain unaccepted. Article 5 points registration dates to opening communiqués; general order does not establish complete application window. French interface is not language level. Tenure and selection/appointment conditions remain unknown.

### Togo

Primary ministry indexed [initial teacher opening](https://fonctionpublique.gouv.tg/actualites/concours-national-de-recrutement-de-fonctionnaires-enseignants-annee-2026), order dated 30 December 2025, and [later center announcement](https://fonctionpublique.gouv.tg/actualites/candidats-au-cnrfe-consultez-les-listes-et-la-repartition-par-centre). Initial indexed 11 April examination differs from later 18 April. September results and later revisions belong to annual cycle; they do not create new application cycles.

Old original PDF URL now returns HTML under construction. Current browser index shows ministry shell without announcements; this is not verified absence of opportunities. Primary indexed forestry, ENA internal/external admission and teacher entries require migration/original reconciliation. No nationality, tenure or formal language accepted. French UI and narrative mention of young Togolese do not establish legal applicant restriction. Named candidate lists not opened or retained; older health-recruitment rules not transferred.

## Preservation and acceptance

Registry 257 → 261; India 108 → 110; source-presence jurisdictions 130 → 132 of 250, leaving 118 without registered sources. Existing 257 sources and 129 non-India previous coverage rows preserved; India authority/gaps appended. CI/TG new rows have no verified listings, zero connected and null collector/validation timestamps. All 36 India state/UT discovery scopes remain distinct from employer footprint. Sources disabled, connector `none`, review required, proposed daily cadence.

Six focused tests passed with zero failures. Public-data generation exited zero with zero records/countries. IN/CI/TG local previews passed. Coal India and IREL full-name searches each one of 110; clear restored all 110; fresh public Coal share restored after hydration. CI/TG each display one source, zero public/fetched and Never validation/fetch. Screenshot saved and visually checked. Final preservation verifier pending; authoritative status is recorded in `phase-90-2026-09-27-verification.json` when completed.

Runtime and 83 health/review files protected. Queue 328 drafts/82 packets, zero founder approvals/public listings. All three personalized stages remain **needs verification**. Reader/browser observations do not update successful scheduled fetch or validation. Prior full suite Phase 78: 364 tests/typecheck; runtime unchanged, no full rerun or production build.

Evidence unchanged: 2,355 files / 871,622,022 logical bytes, above unchanged 800 MiB cap. No raw originals, external DOM or external screenshots retained. Storage choice unanswered; collection paused. Original/translation/connector acceptance, founder review, export gate and worldwide authority audit pending. Source presence does not establish complete coverage.

## Saved files

- Curated matrix: `data/discovery/india-coal-india-irel-cote-ivoire-togo-recruitment-2026-09-27.json`.
- Baseline, guarded preparation, source config, tests/data logs, browser receipt/local preview, process results, verification and SHA-256 manifest in `phases/phase-90-2026-09-27-*`.
- README and CONTEXT latest checkpoint updated. Continue India depth and missing jurisdictions. Generic continuation does not authorize publication or storage changes.
'''
(ROOT/(P+'worldwide-source-expansion.md')).write_text(report)

latest = 'Latest development: [Phase 90 Coal India/IREL and Côte d’Ivoire, Togo](phases/phase-90-2026-09-27-worldwide-source-expansion.md) adds four official recruitment discovery sources. Registry 261: India 110, Japan 10, five US-country sources. Source presence 132/250; 118 without registered sources. Coal India sample nationality/language/appointment rules, IREL indexed appointment types and original gap, Côte d’Ivoire unaccepted indexed rules, Togo migrated-source gaps saved for review. Four sources disabled; no accepted collector or published cycle. Six focused tests/data generation passed; IN/CI/TG previews and India filter/share/reset passed. Final preservation pending; outcomes tracked in Phase 90 receipts. Prior Phase 78 full suite 364/typecheck. Queue 328 drafts/82 packets, zero approvals/public listings. Storage decision, founder review, worldwide audit and export gate pending.'
readme = (ROOT/'README.md').read_text().splitlines()
readme = [latest if line.startswith('Latest development:') else line for line in readme]
(ROOT/'README.md').write_text('\n'.join(readme)+'\n')

checkpoint = '''## Latest saved checkpoint — Phase 90, 27 September 2026

Four official discovery sources added: Coal India, IREL, Côte d’Ivoire public-service administrative competitions and Togo ministry notices. Existing 257 sources preserved. Registry 261: India 110, Japan 10, US-country five. Presence 132/250; 118 missing. India authority/gaps appended; other 129 previous coverage rows unchanged. CI/TG zero connected/null fetch/validation. All additions disabled/connector none/review required; all 36 India state/UT discovery scopes preserved.

Coal India CBT 03/2026 original restricts applications to Indian nationals; foreign-degree recognition separate. Closed original 12 May 10:00–11 June 18:00, timezone unstated. One-year training/probation precedes confirmed E-1 officer service, bond not fixed tenure. Hindi/English papers, General English and role-specific Rajbhasha academic requirements, no CEFR. Degree/age/experience, provisional CBT entry, verification/fitness/NOC independent. GATE originals unreviewed, no transfer of CBT rules; 187 mixed index entries not cycles or complete inventory.

IREL regular executive index CO/HRM/35/2026 closed August; current CMD end 8 October date-only, original unread/blank PDF viewer. Nationality, language, exact cutoff/timezone, terms unknown. Apprenticeships separate training. DAE parent public-sector identity indexed, direct reader timeout; direct identity/ownership/original review remains pending. English/Hindi UI not proficiency.

Côte d’Ivoire ministry refers 2026 order and GUCA external portal; no account created. Indexed Ivorian nationality/grade-age rules unaccepted because direct original unread; foreign-degree equivalence separate. Registration dates in opening communiqués, current results/medical relaunch not new intake. Language/tenure unknown. Togo primary indexed notices versus migrated empty ministry shell/old PDF now HTML construction, not verified empty coverage. Initial teacher exam 11 April versus later 18 April needs annual revision reconciliation. Nationality/tenure/language unknown; no named candidate lists opened.

Six focused tests and data generation terminal zero. IN/CI/TG previews and Coal/IREL query/clear/share checks passed. Final verifier pending; status in Phase 90 receipts. Runtime and 83 health/review hashes protected against Phase 89 baseline. No raw originals, collector timestamps, cycles or approvals. Prior full gate 78: 364/typecheck, not rerun; no production build. Queue 328/82, public zero. Evidence 2,355/871,622,022 above unchanged 800 MiB cap; storage choice unanswered, collection paused. Founder review, accepted originals/translations/connectors, worldwide audit and export gate pending.

Resume phases/phase-90-2026-09-27-worldwide-source-expansion.md, verification/manifest and data/discovery/india-coal-india-irel-cote-ivoire-togo-recruitment-2026-09-27.json. Continue India depth and missing jurisdictions; generic continuation does not authorize storage changes or publication.

'''
context=(ROOT/'CONTEXT.md').read_text().replace('## Latest saved checkpoint — Phase 89','## Previous saved checkpoint — Phase 89',1)
position=context.index('## Previous saved checkpoint — Phase 89')
context=context[:position]+checkpoint+context[position:]
(ROOT/'CONTEXT.md').write_text(context)
print('Phase 90 report, checkpoint, research and browser/process receipts saved.',flush=True)

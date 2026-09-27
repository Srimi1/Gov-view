# Phase 09: IISER Kolkata regular non-teaching recruitment

- Date: 2026-09-25
- Status: saved locally; founder review pending; no publication or deployment

## Goal

Add current salaried India government-linked roles with explicit job type, international-applicant criterion and notice-specific language evidence.

## Changes

- Registered disabled, review-required `in-wb-iiserkol-nt04-2026` official source. Bound its current-opening row to advertisement NT-04/2026 and retained exact English/Hindi PDF bytes and hashes.
- Staged seven separately applied regular post types: Senior Superintendent, Counsellor, Junior Engineer (Civil), Nursing Assistant, Jr. Office Assistant (MS), Jr. Assistant (MS) and Attendant. They total 17 vacancies; vacancy count does not inflate application-cycle count.
- Captured online opening 19 September and closing 19 October 2026 at 17:30. Mandatory printed application and documents must arrive by 29 October at 17:30. Neither deadline prints a governing timezone.
- Recorded explicit Indian-citizenship requirement. Foreign citizens fail published criterion; Indian citizenship alone does not prove full eligibility. No formal language proficiency level or exam medium is printed. English and Hindi publication alone does not make either an applicant requirement.
- Flagged material eligibility-date conflict: notice page 1 says age, qualifications and experience are reckoned on 19 September; instruction 35 says online closing date, 19 October. Automated age matching is withheld until authority/founder resolves it.
- Recorded seven founder worksheets, original-source review JSON and current coverage gap. Job location in Mohanpur is not treated as exam venue or applicant domicile.

## Verification

- Official index and English/Hindi PDFs fetched; application login returned HTTP 200 without account use. `robots.txt` returned HTTP 404. Hashes are in `data/evidence/research/iiserkol-nt04-2026-source-review.json`.
- Focused connector tests: 2 passed, including date/link drift, PDF change, separate-cycle count, foreign-citizen rejection and age-date conflict.
- Collector stage: 7 collected, 0 approved, 7 pending, 0 kept. Seven founder sheets saved.
- `npm run review:packet`: 193 pending drafts from 55 staged sources. Registry now has 83 registered sources across 10 countries/territories.
- `git diff --check`: passed. `npm test`: 279 passed, 0 failed. `npm run build`: TypeScript and 259 static pages passed; secure export checked 1,709 files (26.0 MiB) with no detected secrets.
- `http://localhost:3003/coverage/IN/`: HTTP 200; 69 India sources, including IISER Kolkata with 7 pending drafts and no public listing.

## Limits

- Source index spells its heading `IIISER-K` while signed English PDF spells `IISER-K`; collector binds exact links and dates, and uses PDF advertisement spelling.
- Notice conflict blocks founder approval of age/qualification eligibility until authority interpretation is documented.
- Other IISER Kolkata advertisements, later corrigenda and West Bengal authorities remain gaps. Public launch remains blocked by wider audited worldwide coverage requirement.

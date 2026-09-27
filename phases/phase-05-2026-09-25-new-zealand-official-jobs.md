# Phase 05: New Zealand official jobs pilot

- Date: 2026-09-25
- Status: saved locally; founder review pending; no publication or deployment

## Goal

Add an official recruitment source in an uncovered country and distinguish foreign-citizen eligibility from citizenship, residence and work rights.

## Changes

- Registered `nz-gov-jobs` as a disabled, review-required source. It checks two exact public job pages: Rotorua Probation Officer (NZ/1946342) and Auckland MSD Customer Service Representative (NZ/1948355).
- Staged two recruitment drafts, each bound to visible article text, employer, position type, published and closing dates, job reference, and official linked application target. Exact source HTML and robots policy are retained under `data/evidence/research/`; collector evidence and founder sheets are under `data/evidence/` and `data/review/sheets/`.
- Kept applicant routes distinct: Probation notice requires existing legal NZ work rights and may not support visa applications. MSD requires NZ citizenship **or** a Permanent Resident visa at application. Nationality alone cannot decide either route in current profile model, so automated assessment remains `needs-verification`.
- Recorded no formal language level for either checked page. Probation notice requires excellent spoken and written communication and prioritises relevant cultural experience; this is not converted into a fabricated language certificate or level.
- Preserved original deadline precision: 4 October 2026 date-only for Probation; 4 October at 23:59 for MSD. Neither page prints the governing cutoff timezone. Work locations are not mapped as selection venues.

## Verification

- Public `/jobs/` pages and `robots.txt` responded; generic robot rules allow job-detail paths and disallow listed application actions.
- `node --experimental-strip-types --test connectors/nz-gov-jobs.test.ts`: 2 passed, including critical-field drift and foreign eligibility uncertainty.
- `npm run collect -- --source nz-gov-jobs --stage`: 2 collected, 0 approved, 2 pending, 0 kept.
- Both founder review sheets generated and retained evidence hashes verified.
- `npm run review:packet`: 182 drafts from 51 sources.
- `npm run metrics`: 79 sources across 10 of 250 jurisdictions; 0 approved and 0 public records.
- `npm run build`: passed TypeScript, generated 259 static pages, and secured 1,709 export files with no detected secrets. `/coverage/NZ/` serves HTTP 200 and displays 1 fetched source, 2 pending drafts, 0 public records.
- Full `npm test`: 271 passed, 0 failed. iCloud reads made the run take about 8.4 minutes.

## Limits

- This pilot checks only two jobs, not the full jobs.govt.nz inventory or all NZ agencies. It does not establish worldwide or NZ completeness.
- Agency application endpoints and linked position descriptions were not fetched; founder must review before approval.
- Source pages may change, close early or disappear; collector cannot infer official cancellation from disappearance.
- Formal language requirements and official cutoff timezone remain unknown in these checked pages.
- No founder decision has been recorded. Public opportunity list remains empty by design.

## Next work

- Founder checks original notices, linked position descriptions, application routes, and visa/PR wording; records approval or correction with reason and review time.
- Extend NZ connector through a permitted, complete listing endpoint with detail and amendment coverage, then continue uncovered countries and India authority coverage.

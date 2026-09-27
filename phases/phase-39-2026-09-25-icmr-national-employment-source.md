# Phase 39 — ICMR national employment source, NITHR walk-in pilot

Date: 2026-09-25. Saved in Gov-view folder. One upcoming, founder-review contract recruitment cycle staged; zero new public listings.

## Official evidence

- [ICMR Employment Opportunities](https://www.icmr.gov.in/employment-opportunities) provides a national index across its institutes. Its Jabalpur row links exact [English](https://www.icmr.gov.in/icmrobject/uploads/Recruitment/1790224152_yps_eng.pdf) and [Hindi](https://www.icmr.gov.in/icmrobject/uploads/Recruitment/1790224152_ypshindi.pdf) notices for Young Professional-I (Admin). Original HTML/PDF bytes are retained in `data/evidence/research/icmr-*`; document hashes and dates are in `data/extractions/icmr-nithr-yp1-admin-2026.json`.
- This notice covers **one temporary contract** at ICMR-NITHR, Jabalpur: ₹35,000/month, initially one year, possible annual extensions up to three years. Candidate attends a **6 October 2026 walk-in from 09:00** with completed form and original documents. The 09:00 time is interview start, not a stated last arrival or application cutoff.
- Essential qualifications: graduation in any discipline with at least 55% and one year of relevant post-qualification experience. Page 1 says age maximum 30; Table A says less than 30, so the age boundary and relaxation require founder clarification. Current regular central/state government, autonomous-body, department or PSU staff are excluded by this notice.
- Strong writing in Hindi and English is **desirable**, with no formal level. Nationality and foreign-citizen route are unstated; international-applicant assessment stays uncertain. Interview street address is shown in details without an invented geocoded pin.
- ICMR-NITHR's separate vacancies site is visible in manual official-source research but its `robots.txt` returned non-text content to the project collector. Later institute-only corrigenda remain a gap; founder must check them before approval.

## Staging and checks

- Registered disabled, review-required source `in-icmr-nithr-yp1-admin-2026`. Connector binds the exact index row and both PDF hashes. It handles **one role**; other ICMR index rows and other positions sharing advertisement 05/2026-27 remain gaps. Source does not imply complete national ICMR coverage.
- Live `npm run collect -- --source in-icmr-nithr-yp1-admin-2026 --stage`: **1 collected, 0 approved, 1 pending, 0 kept publicly**. [Founder sheet](../data/review/sheets/icmr-nithr-yp1-admin-2026.md) records evidence and unresolved age, nationality and form details.
- Added `published-address` venue type so an official street address can appear in details without a map pin until coordinates are verified. Focused tests **2 passed**; TypeScript check passed after excluding generated `.next`/`out` files from source typechecking. `npm run data` generated **0 public records**. Queue: **273 drafts from 74 sources**.
- Production build verification was interrupted after Next stalled reading an iCloud-synced `node_modules/styled-jsx/package.json`. Existing generated `out/` also contains numbered iCloud duplicate files; metrics show **18,383 files**, above project's **18,000** export gate. No successful build is claimed for this phase. Source and review artifacts remain saved.

## Next review

Founder checks English/Hindi documents, age boundary, regular-service exclusion, form availability, institute amendments, nationality/work authorization and final contract terms. Full ICMR pagination and other institute notices need connector expansion.

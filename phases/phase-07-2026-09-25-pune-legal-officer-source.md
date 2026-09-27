# Phase 07: Pune Legal Officer source pilot

- Date: 2026-09-25
- Status: saved locally; founder review pending; no publication or deployment

## Goal

Add an accessible Maharashtra government recruitment source while keeping foreign-citizen and language assessments faithful to its notice.

## Changes

- Registered disabled, review-required `in-mh-pune-divcomm-legal` source and exact-document connector. Existing Maharashtra PSC access restriction remains separate.
- Staged one closed Legal Officer contract cycle from Pune Divisional Commissioner's official recruitment page and its 12-page scanned Marathi PDF. The index row, date, PDF URL and original PDF hash gate extracted fields; a later Legal Officer corrigendum row stops reuse of old fields.
- Recorded one 11-month contract, 31 August 2026 date-only application receipt deadline, law degree, Bar Council membership, seven years' practice, age limit and published pay for founder review. Office hours are not converted to a made-up cutoff hour.
- Recorded adequate Marathi, Hindi and English knowledge without a formal level. The notice page gives no foreign-citizen rule, so all three eligibility stages require further verification. Work location is not treated as interview venue.
- Saved source bytes, rendered research pages, source-access note, extraction data and founder worksheet under `data/`. A separate HPRCA access check is saved in `data/evidence/research/hprca-access-2026-09-25.json` without activating a collector.

## Verification

- Pune government `robots.txt` returned text rules permitting public recruitment page. Linked PDF host's `robots.txt` returned HTTP 404. Both official source documents fetched and hashes retained.
- `npm run collect -- --source in-mh-pune-divcomm-legal --stage`: 1 collected, 0 approved, 1 pending, 0 kept.
- Founder sheet generated with retained evidence hashes; `npm run review:packet` recorded 184 pending drafts from 53 sources.
- Focused connector tests passed 2/2, including index date/link drift, new corrigendum row, changed PDF bytes and international eligibility uncertainty.
- `npm test`: 275 passed, 0 failed. `git diff --check`: passed.
- `npm run metrics`: 81 registered sources across 10 of 250 jurisdictions; 184 pending cycles; 0 approved and 0 public.
- `npm run build`: TypeScript and 259 static pages passed; secure export scanned 1,710 files with no detected secrets. `/coverage/IN/` returned HTTP 200 and displayed Pune source, one pending revision and explicit coverage gap.

## Limits

- This is one closed Pune Division advertisement, not a Maharashtra recruitment inventory or source completeness audit.
- Scanned Marathi notice needs founder translation and full-condition review, including any later amendments, submission method, foreign-citizen contract permission and exact interview venue.
- Public launch remains blocked by worldwide coverage gaps and zero founder approvals.

## Next work

- Founder records an approval, correction or rejection with reason and time after reading the official scan.
- Seek permitted current Maharashtra and Himachal recruitment feeds, then continue India and worldwide authority coverage.

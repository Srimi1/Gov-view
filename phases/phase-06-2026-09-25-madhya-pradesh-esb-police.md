# Phase 06: Madhya Pradesh police source pilot

- Date: 2026-09-25
- Status: saved locally; founder review pending; no publication or deployment

## Goal

Fill one usable Madhya Pradesh recruitment gap while keeping international-applicant eligibility grounded in official notice text.

## Changes

- Registered disabled, review-required `in-mp-esb-police-gd` source and exact `mpesb-pcrt-2026` connector. Existing MPPSC source stays separate because its robots policy blocks automated access.
- Staged one Police Constable GD 2026 application cycle from MPESB homepage, MPOnline form row, original Hindi rulebook and scanned revised first page. Collector retains original bytes and pins both PDF hashes. Founder sheet: `data/review/sheets/mpesb-police-constable-gd-2026.md`.
- Recorded new-application dates 22 September–6 October 2026. Separate 11 October correction deadline is not treated as an extension. Official cutoff hour and timezone remain unknown.
- Original rulebook §3(i) requires Indian citizenship. Foreign citizens without Indian citizenship fail published application criterion; Indian citizens still need individual qualification, age, physical and document checks. Hindi is written-test medium; no formal proficiency level is claimed. Exam venues stay unknown.
- Saved source URLs, findings, access status, limits and local evidence hashes in `data/evidence/research/mpesb-pcrt-2026-source-review.json`. README and India coverage page show pilot and gaps.

## Verification

- Both official HTML pages and both PDF documents fetched. MPESB and MPOnline `robots.txt` returned HTTP 404; existing MPPSC policy remains respected.
- `npm run collect -- --source in-mp-esb-police-gd --stage`: 1 collected, 0 approved, 1 pending, 0 kept.
- `npm run review:sheet -- --source in-mp-esb-police-gd --id mpesb-police-constable-gd-2026`: founder worksheet generated with retained evidence hashes.
- `npm run review:packet`: 183 drafts from 52 sources.
- `npm test`: 273 passed, 0 failed. `git diff --check`: passed.
- `npm run build`: TypeScript and 259 static pages passed; secure export scanned 1,709 files, no detected secrets.
- `npm run metrics`: 80 registered sources across 10 of 250 jurisdictions; 183 pending cycles; 0 approved and 0 public. `/coverage/IN/` returned HTTP 200 and displayed MPESB source, one pending revision and coverage limit.

## Limits

- One police intake only. Other MPESB tests, MPPSC recruitment and remaining Madhya Pradesh authorities are coverage gaps.
- Fee amendment is scanned; category fees, qualifications, age, physical standards, later amendments and exact application route need founder review. No approval recorded.
- Public launch remains blocked by missing worldwide audited coverage and review. India source registration across all 36 states and union territories does not mean full notice coverage.

## Next work

- Founder reviews original and revised rulebooks against extracted fields; records approval or correction with reason and review time.
- Continue permitted official-source collection across India and worldwide jurisdictions, with language and foreign-citizen rules tied to notice-specific evidence.

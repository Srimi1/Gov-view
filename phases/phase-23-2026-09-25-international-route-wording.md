# Phase 23 — precise international route wording

Date: 2026-09-25. Saved in Gov-view folder. No founder approval or public listing.

## Change

- Added source-specific explanations for conditional and uncertain nationality routes. Existing notices with actual conflicting clauses retain the conflict message.
- IGNOU's Nepal/Bhutan route now names the Government of India certificate required before appointment. Applicants from listed migration/refugee countries see that nationality alone cannot prove the narrow route, instead of being told that the notice conflicts with itself.
- Regenerated the IGNOU pending packet, all 12 founder worksheets and the 237-cycle review queue. Review summary distinguishes conditional routes from cases needing individual verification.

## Verification

- TypeScript check and 16 focused connector/eligibility tests passed.
- Live stage collection returned 12 pending, 0 approved and 0 published; review summary generated 237 drafts from 63 sources.
- Source-specific wording appears in the retained review packet and founder queue. `git diff --check` passed before this note was written.

## Limit

- The profile does not prove refugee status, Indian-origin migration, or possession of an eligibility certificate. These routes remain “needs verification” until the authority checks the applicant's documents.

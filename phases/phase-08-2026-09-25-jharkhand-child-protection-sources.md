# Phase 08: Jharkhand child-protection recruitment

- Date: 2026-09-25
- Status: saved locally; founder review pending; no publication or deployment

## Goal

Add current India state applications with clear role type, international-applicant uncertainty and notice-specific language evidence.

## Changes

- Found Jharkhand's official recruitment portal through the current National Career Service Government Portals directory. Saved its 20 links as **discovery leads only**, without counting them as verified opportunity sources.
- Registered disabled, review-required `in-jh-jjb-cwc-2026` source. Collector binds two exact Jharkhand child-protection PDFs to distinct current portal rows: notification 2979 (six JJB roles; 10 October at 23:59) and notification 3062 (four JJB and seven CWC roles; 15 October at 23:59). Distinct district vacancy sets and application deadlines support two cycles. JJB and CWC preferences under 3062 share one district application, so they count once.
- Labelled both engagements honorary three-year appointments with ₹2,000 per sitting, not salaried government employment. No venue pins were inferred from appointment districts.
- Kept foreign-citizen eligibility and language level unverified. Nationality, Aadhaar and other-language form fields do not establish a rule; neither notice prints a governing cutoff timezone.
- Excluded Deoghar Home Guard advertisement 01/2026 from job cycles because page 1 expressly says volunteer duty is neither daily government employment nor a livelihood avenue. Original PDF and reason are retained.
- Added exact PDF hash and notice-set drift checks, including later JJB/CWC rows in the portal's separate Notice section. Saved source review and two founder sheets.

## Verification

- Official portal and three PDFs fetched. Portal `robots.txt` returned HTTP 404. Exact evidence hashes are in `data/evidence/research/jharkhand-jjb-cwc-2026-source-review.json`.
- `npm run collect -- --source in-jh-jjb-cwc-2026 --stage`: 2 collected, 0 approved, 2 pending, 0 kept.
- Two founder worksheets generated with retained evidence hashes. `npm run review:packet`: 186 drafts from 54 sources.
- Focused connector tests: 2 passed, including index drift, later notice, changed PDF, cycle counts and unknown international/language eligibility.
- `git diff --check`: passed. `npm test`: 277 passed, 0 failed. `npm run build`: TypeScript and 259 static pages passed; secure export checked 1,709 files with no detected secrets. `/coverage/IN/` returned HTTP 200 and showed two pending Jharkhand drafts, no public listing and explicit gaps.
- Registry has 82 sources across 10 countries/territories; 186 drafts await founder review across 54 staged sources.

## Limits

- Notification 2979 bears 1 September issue date while its annexure is labelled as of 22 September. Founder must resolve revision history before approving.
- Two honorary notices do not establish complete Jharkhand recruitment coverage. Portal NGO call, Deoghar volunteer enrollment, JPSC, other departments and districts require separate scope decisions or collection.
- Public list remains empty until founder review. Worldwide public launch remains blocked by audited coverage gaps.

## Next work

- Founder checks PDFs, district forms, statutory appointment rules and nationality permission, then records approval/correction/rejection with reason and review time.
- Continue permitted official state and national sources from NCS leads, checking actual notices rather than treating directory links as job listings.

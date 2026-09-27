# Phase 04: Canada source and international eligibility

- Date: 2026-09-25
- Status: local development; no publication or deployment

## Goal

Extend official-source research beyond India while keeping foreign-citizen eligibility and unknown deadline time zones honest.

## Changes

- Registered Canada FSWEP Great Lakes 2027 as one official-source draft. Collector checks exact programme card, organization, application date, work dates, poster link, and general student criteria before staging. Evidence and founder review sheet are retained under `data/evidence/` and `data/review/`.
- Kept GC Jobs poster 2042 as an access gap. Its programme-specific requirements, language level, work authorization, and deadline time zone need review. Canada's citizen/permanent-resident preference does not establish a blanket foreign-citizen ban.
- Researched official APSJobs (Australia) and Careers@Gov (Singapore) entry points. Registered both as disabled, with source-access gaps and retained research snapshots. No listing was imported from their inaccessible dynamic/job-detail pages.
- Allowed `ApplicationWindow.officialTimeZone` to be null. Date-only notices with no official time zone show that uncertainty; deadline export requires a zone for precise cutoffs. Closure uses the last possible civil date globally so a draft cannot close early based on an invented zone.
- Stage-only collection now records source health and coverage timestamps. It still writes no approved opportunities or country cycle files. Canada coverage now reports one fetched source and one review draft.
- Added `CONTEXT.md` glossary for application cycle, deadline precision, official time zone, and foreign-applicant assessment.

## Verification

- `npm run collect -- --source ca-fswep-great-lakes --stage`: one draft staged; zero approved.
- `npm run review:packet`: 180 pending drafts from 50 sources.
- `npm run typecheck`: passed.
- `npm test`: 269 passed, 0 failed. Full run took about nine minutes because iCloud document reads were slow.
- `npm run metrics`: 78 registered sources across 9 of 250 jurisdictions; 0 approved and 0 public records. Registry contains 65 India sources. Research coverage is not audited public coverage.
- First `npm run build`: passed; 259 static pages, 1,738 export files, no detected secrets. It preceded the stage-only source-health fix.
- Final `npm run build` after the source-health fix: passed TypeScript, generated 259 static pages, secured 1,709 export files with no detected secrets. Local `/coverage/CA/` reports 1 registered source, 1 fetched source and 1 pending review draft; `/coverage/IN/` reports 65 registered sources.

## Limits

- Canada source is a review draft. GC Jobs poster was not fetched, and foreign-citizen permission remains unresolved.
- Australia and Singapore sources are research entries only; no connector is enabled for them.
- Founder has not approved any draft. Public browsing still shows fixtures and coverage gaps, not verified worldwide opportunities.
- Worldwide launch gate remains blocked: 241 jurisdictions have no registered source, and independent coverage audit is pending.

## Next work

- Founder reviews pending source packets and resolves accessible poster-specific requirements.
- Continue official-source inventory, prioritizing uncovered jurisdictions and full India state coverage.
- Measure review time and connector reliability before expanding active collection.

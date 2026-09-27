# Phase 53 — Ireland AO Specialist: one cycle, international routes and conditional Irish B2

Date: 27 September 2026 (Asia/Kolkata). Actual fetch timestamps remain UTC. First output is pending founder review; no publication approval recorded.

## Official competition and job type

[Official competition 9005](https://publicjobs.tal.net/candidate/so/pm/1/pl/3/opp/9005-Graduate-Opportunities-2026-Administrative-Officer-Specialist/en-GB) advertises Graduate Opportunities 2026, Administrative Officer Specialist, for Ireland's Civil Service. The government publicjobs homepage links the public board; competition detail identifies Civil Service employer, permanent contract, full-time pattern and Dublin location.

The candidate booklet requires **one application choosing exactly one specialist role**: Energy, Environment and Climate; Finance Policy; Health Policy Analyst; or Human Resources. This is **one distinct application cycle**, not four role totals or multiple venue totals. Successful candidates join merit panels for current/future posts; no vacancy count or job guarantee is printed. Most vacancies are in Dublin; possible regional appointments do not establish exam venues or applicant domicile. Panel appointments are not expected after January 2028.

[Incorporated service conditions](https://publicjobs.tal.net/cached/spa-1/share/d/32/077bfe81961c9b397da42dcc2d4d1887d3f0e0b8) confirm permanent post with nine-month probation, starting pay €41,176 and specified conditions. Employment classification is permanent, not a temporary internship or contract solely because probation is contractual.

## International applicants

[Incorporated citizenship and restrictions PDF](https://publicjobs.tal.net/cached/spa-1/share/d/33/557efe9fd970288dd2779120e856083a7431aa25) permits EEA, UK or Swiss citizens, or non-EEA citizens with Stamp 4 or Stamp 5 permission. It expressly accepts 50 TEU permission as a Stamp 4 equivalent. One of these routes must be met **by any job-offer date**.

The deterministic nationality rule therefore starts at **outcome**, not application or selection. EEA/UK/Swiss nationality can satisfy only that criterion. Other nationalities remain **needs verification**, because existing profile does not collect relevant immigration permission. Indian citizenship, even with Irish residence, cannot prove Stamp 4/5; Indian citizenship alone also cannot justify rejecting this expressly conditional route. No visa sponsorship, future permission or appointment is promised.

Specialist qualifications, health/character, references, any security/Garda vetting, public-service retirement/redundancy restrictions, Dublin availability and probation remain separate checks. A nationality match never establishes full eligibility.

## Qualifications and language

Six incorporated PDFs retained: service conditions; citizenship/re-employment restrictions; and four specialist role definitions. Qualification alternatives are preserved in [extraction metadata](../data/extractions/ie-ao-specialist-2026.json) and [evidence bindings](../data/discovery/ie-publicjobs-ao-specialist-9005-2026-bindings.json).

- Energy and Finance routes contain exact NFQ levels, grades and subject-module proportions; each requires average at least 50% of course modules in its printed subject list.
- Finance also permits a specified professional accountant/tax-advisor qualification and membership/entitlement route. HR includes a CIPD Associate Diploma alternative; desirable HR experience and membership are not silently made essential.
- Health includes prescribed degree/diploma alternatives and regulated health/social-care fields. Qualifications must be held by 13 October; foreign equivalence and official transcripts require authority verification.
- Existing generic education selector cannot represent every alternative, so connector keeps full requirements manual instead of inventing a degree minimum that would reject valid professional routes.

Main booklet says **Irish-language opt-in posts require minimum B2 on the linked Europass self-assessment framework**, with further assessments through Irish before consideration for those posts. General campaign does not impose blanket Irish B2 or print a standardized English level. Conditional language wording remains in detail and stage-specific manual checks; a mandatory B2 rule is not applied to every candidate.

English/Irish application choice controls communications. The two separately labelled booklet links returned **identical English PDF bytes**, SHA-256 `09cbe5f3f3b843a4d38fe3a0437652e73ab9bf7a55e75258c7f8bc84f4083247`. Both responses are retained and Irish translation remains an explicit gap.

## Dates and locations

Completed applications are due **13 October 2026 at 15:00**. Neither candidate booklet nor detail prints official timezone, so field remains null and no UTC cutoff is inferred. Advertising date 25 September is not treated as confirmed opening date. Closing-date status stays uncertain while world civil dates straddle that day.

Provisional online assessment 5–10 November and capability interview/exercise 18–22 January 2027 remain provisional. Online assessment is explicitly labelled online; interview/exercise and optional external Irish assessment centre locations remain unknown. Dublin work location is not an interview pin.

## Connector, review and verification

Added [connector](../connectors/ie-ao-specialist-2026.ts), [focused tests](../connectors/ie-ao-specialist-2026.test.ts), extraction metadata and lazy registry dispatch. Specific source `ie-publicjobs-ao-specialist-2026` is disabled, review-required and separate from general research-only `ie-publicjobs` source.

Connector discovers current public job-board and booklet links from official HTML. Public session route components are refreshed rather than hardcoded as permanent URLs. Normalized competition card/content, exact opportunity/file IDs and all original PDF hashes gate extracted fields. New card dates, changed notices, missing/duplicate cards, replaced editions, changed original/Irish-labelled bytes, redirected documents and unexpected recruitment hosts stop extraction. Missing notices never imply cancellation.

Live command `npm run collect -- --source ie-publicjobs-ao-specialist-2026 --stage` succeeded: **1 collected, 0 approved, 1 pending, 0 public**, retaining **11 official responses** (homepage, board, detail, two language-labelled booklet downloads and six incorporated PDFs). [Pending packet](../data/review/ie-publicjobs-ao-specialist-2026.json) and [founder worksheet](../data/review/sheets/ie-ao-specialist-9005-2026.md) bind exact proposed revision; worksheet generation verified retained evidence and recorded no approval. Research HTML, PDFs, readable text and fetch metadata remain in `data/evidence/research/ie-publicjobs-ao-specialist-*`. Ireland coverage now records one successfully fetched source with the actual fetch timestamp; validation remains null and approved/public counts remain zero. A staged fetch updates source health and coverage without publishing applicant records.

Four focused tests passed: three Irish connector tests plus registry startup isolation. Covered one-cycle count, refreshed public session routes, conditional offer-date nationality, no invented global B2, altered documents/editions/hosts, unknown timezone and civil-day closure. TypeScript check, public-data build and `git diff --check` passed. Review index regenerated.

## Measured state and remaining scope

[Saved metrics](phase-53-2026-09-27-metrics.json): **129 sources**, including **91 India sources**, across **32 of 250 jurisdictions**; **326 draft cycles in 81 pending packets**; **0 approved/public records**, **0 measured review decisions**. Stored-record denominator remains 18,760. Source stays disabled pending first-output acceptance. One Irish competition does not constitute Ireland-wide collection, and registered jurisdictions do not constitute worldwide audited coverage.

Other notices, amendments, official timezone, missing Irish translation, professional equivalence, individual immigration proof, conditional language assessment, source acceptance set, measured review workload, further India/Japan/US collection and independent worldwide coverage audit remain unfinished. Existing generated export file-count gate remains unresolved; no launch readiness claimed.

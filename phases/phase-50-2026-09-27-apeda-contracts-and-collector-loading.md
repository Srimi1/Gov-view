# Phase 50 — APEDA contracts and source-selected collector loading

Date: 2026-09-27. Saved in Gov-view folder. Two new India drafts; zero approvals/public records.

## Official source added

[APEDA recruitment index](https://apeda.gov.in/recruitment-appointment) belongs to the Agricultural and Processed Food Products Export Development Authority under the Department of Commerce, Ministry of Commerce and Industry. NCS rows 8 and 18 led to two August notices. The index and [archive](https://apeda.gov.in/recruitment-appointment-archive) were fetched with the existing polite-fetch policy. Original PDFs were retained and text extracted locally.

| Draft cycle | Official notice | Arrangement | Printed application deadline |
| --- | --- | --- | --- |
| Associate (Legal), August 2026 | [27 August notice and form](https://apeda.gov.in/sites/default/files/recruitment_appointment/Advertisement_Associate_Legal_27_08_2026.pdf) | One contract vacancy, initially one year | 9 September 2026, 1700 hrs; official timezone unstated |
| Associate (Trade), August 2026 | [11 August notice and form](https://apeda.gov.in/sites/default/files/recruitment_appointment/Advertisement_Associate_Trade_11_08_2026.pdf) | One contract vacancy, initially one year | 24 August 2026; cutoff time and official timezone unstated |

Both deadlines have passed. Their continued NCS/index presence is not proof applications remain open. Both contracts include three-week probation, possible performance-based annual extensions up to three years and no right to subsequent government employment. Separate role applications count as two cycles even though file number PAD-2023-24-000091 is shared. Earlier Trade editions remain separate, uncollected cycles.

Legal requires LL.B., relevant experience, intellectual-property knowledge and effective verbal/written communication. Trade requires a relevant Master's, two years post-Master's experience and visualization/office software skills. Upper age 45 is stated without a reckoning date; the connector therefore does not invent a deterministic age assessment.

Neither notice gives a nationality permission rule. A nationality field does not establish permission for foreign applicants. Neither gives a named mandatory language or standardized level; the form's language-proficiency field is not another eligibility criterion. Application, selection and appointment remain three separate assessments requiring verification. Interview venue and application opening date remain unknown. APEDA's office address is not mapped as a selection venue.

## Connector and review evidence

- Registered `in-apeda-associates-2026`, disabled, with first-output review required and daily cadence for these closed calls.
- Added `connectors/apeda-associates-2026.ts`, extraction metadata and tests. Exact original PDF hashes bind extracted fields. Normalized current/archive document-row digests catch additions, removals, replacement links and changed editions; changed rows or PDF bytes stop extraction for review.
- Current index contains seven document rows; archive contains 206. Only the two August Associate notices were extracted. Other recruitment notices, results, amendments and prior editions remain coverage gaps; connector returns `complete: false`.
- Live staging: **2 collected, 0 approved, 2 pending, 0 public**. [Review packet](../data/review/in-apeda-associates-2026.json) retains four index/archive/PDF responses. [Legal worksheet](../data/review/sheets/apeda-associate-legal-2026-08.md) and [Trade worksheet](../data/review/sheets/apeda-associate-trade-2026-08.md) verify retained evidence and record no approval.
- Research HTML, PDF, text and fetch metadata are retained under `data/evidence/research/apeda-*`. PDF hashes: Legal `1864645263621cb83506f0508bbe9dd0a792d7437e0fe91ea420e45bb00e92d6`; Trade `08306466792e991b2275c6b1f4e57aa05c7f124698acaa091156c1f55bbd31b4`.

## NCS reconciliation

[Saved triage](../data/discovery/ncs-classified-jobs-2026-09-27-triage.json) compares all 145 captured target hostnames with registry homepage hostnames: 79 have candidates and 66 do not. These are review hints, not verified source identity, coverage, or duplicate-cycle decisions. Rows 125–126 share all compared call fields except Type wording and are flagged as a possible duplicate. Raw Type remains unchanged because it mixes appointment arrangements and reservation categories.

## Collector startup bug resolved

A source-only APEDA run remained live while reading unrelated `navbrasil-2026-tower-control.json` during eager import of the connector registry. A deterministic subprocess test reproduced the unwanted read by rejecting unrelated extraction metadata; before the fix it failed on Kerala metadata before source selection.

`connectors/index.ts` now dynamically imports only the selected connector, preserving all 83 existing route keys and export names. Regression test verifies registry startup reads no extraction data, all registered adapter keys resolve to callable routes, and APEDA invocation reads only APEDA extraction metadata before reaching its fetch.

The old process completed staging before the planned stop; its PID was then missing, so no signal was sent. A fresh CLI dry run using lazy loading reached APEDA selection within the initial command response and fetched all four evidence responses successfully. No competing collector remains from this phase.

## Verification and remaining scope

- Four focused tests passed: three APEDA tests covering changed evidence, prior editions, duplicate-cycle prevention, foreign/language uncertainty and unknown-timezone boundaries; one startup isolation regression.
- `npm run typecheck` passed after lazy-loading change. `git diff --check` passed. `npm run data` exported zero public records. Live staging and subsequent CLI dry run both collected two candidates.
- Registry now contains **119 sources**, including **90 India sources**, across **24 of 250 jurisdictions**.
- [Metrics](phase-50-2026-09-27-metrics.json): **323 distinct draft cycles in 79 pending packets**, zero measured review decisions, zero approved/public records. Stored-record count remains 18,760 and uses a separate denominator.
- Founder decisions, 200-notice connector acceptance evaluation, further India employer coverage, Japan/US expansion, worldwide inventory reconciliation and independent coverage audit remain incomplete. No public launch or connector acceptance is claimed.

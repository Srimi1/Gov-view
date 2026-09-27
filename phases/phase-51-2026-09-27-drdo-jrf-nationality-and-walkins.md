# Phase 51 — DRDO JRF nationality and walk-in evidence

Date: 2026-09-27. Saved in Gov-view folder. Two new India draft cycles; zero approvals or public listings.

## Source and applicant facts

Added disabled, review-required source `in-drdo-jrf-september-2026` for two exact calls discovered through NCS rows 1 and 3. [DRDO vacancy index](https://drdo.gov.in/drdo/offerings/vacancies) and its [second page](https://drdo.gov.in/drdo/offerings/vacancies?page=1) contain fourteen cards, including result notices. Only the two bound JRF advertisements are extracted; no result list is counted as a new application cycle.

| Call | Places / arrangement | Application and selection timing | International / language treatment |
| --- | --- | --- | --- |
| [DYSL-SM Hyderabad, DYSL-SM/HRD/JRF/REC/2026/1](https://drdo.gov.in/drdo/en/offerings/vacancies/dysl-sm-hyderabad-invites-eligible-candidates-walk-interview-award-junior) | One temporary JRF, initially two years; ₹37,000/month plus applicable HRA/emoluments | Walk-in 6 October at 09:30; latecomers excluded. Prescribed form/supporting PDF must also be emailed; no email deadline is stated. | Indian nationals invited. No named mandatory language or standardized level. |
| [LRDE Bengaluru, 03/2026/JRF](https://drdo.gov.in/drdo/en/offerings/vacancies/lrde-bengaluru-invites-eligible-candidates-walk-interview-post-junior-research) | Two JRF places in one call; initial two years, extendable to four; ₹37,000/month plus admissible HRA | Willingness email advised by 25 September; walk-in 8 October with reporting 08:30–09:30. Eligibility to attend after missing email advisory remains unresolved. | Only Indian nationals may apply. Non-English documents need self-attested English transcripts; this does not establish a proficiency level. |

Both notices state fellowship gives no right to absorption in DRDO. The two calls are two cycles, despite three fellowship places and multiple source/index appearances. Indian citizenship alone does not satisfy degree, age, GATE, screening, reporting or appointment checks. Foreign citizenship, including OCI without Indian citizenship, does not meet the published Indian-national criterion. Profile citizenship cannot bypass qualification failures.

## Dates, qualifications and uncertainties

- Original [DYSL-SM notice](https://drdo.gov.in/drdo/sites/default/files/vacancy/advtDYSLSM08092026.pdf) is dated 4 September; index publication is 8 September. Neither is silently treated as application opening. Bachelor route requires first-class Mechanical/Mechatronics Engineering with valid GATE; postgraduate alternative also requires first-class undergraduate degree. The PDF literally prints **“MechanicalMechatronics”** in postgraduate disciplines without a separator. [Rendered original page](../data/evidence/research/drdo-dysl-sm-jrf-2026-page-1.png) was visually checked; compound wording is preserved and flagged for authority clarification. Desirable technical skills are recorded separately from essential criteria.
- DYSL-SM maximum age 28 is reckoned on actual application date, with printed SC/ST five-year and OBC three-year relaxations. Application date is not a fixed published calendar date; no deterministic age rule is invented. Previous DRDO JRF award excludes reapplication; government/PSU/autonomous-body employees need NOC.
- Original [LRDE notice](https://drdo.gov.in/drdo/sites/default/files/vacancy/advtLRDE07092026.pdf) requires completed first-division degree in listed electronics disciplines with valid qualifying GATE (2024/2025/2026), or relevant first-division postgraduate route with first division at both levels. Age 28 is reckoned on 1 September; category relaxations are not quantified in the notice, so age checks remain manual.
- LRDE current status is **uncertain**, not closed merely because the willingness advisory passed and not unconditionally open merely because portal End Date is 8 October. Confirm missed-advisory attendance with authority. The field's 09:30 is published walk-in reporting cutoff, not an email deadline.
- DYSL-SM current call is open before walk-in, with email/arrival procedures requiring verification. Its 09:30 event start is shown in details, without inventing a separate email or closing cutoff.
- Neither notice prints an official timezone. Source times and dates are retained without UTC conversion. Event-day clock status remains uncertain; cycles close only after all civil timezones have passed the walk-in date.
- Official street addresses are published-address venues. No coordinates or jurisdiction-centre pins are manufactured. Residence restriction and application fee are not stated.

## Pipeline and evidence

- Added connector, extraction metadata and focused tests using existing collector contract and lazy registry dispatch. Exact PDF SHA-256, both current index page/card digests, pager links, role identity, dates and detail PDF link sets gate extraction. Pagination changes, amended cards, replaced notices or PDF bytes stop extraction for review. Removal never implies cancellation.
- Live collection after visual-check amendment: **2 collected, 0 approved, 2 pending, 0 public**, from six official index/detail/PDF responses. [Pending review packet](../data/review/in-drdo-jrf-september-2026.json) contains both exact proposals. [DYSL-SM worksheet](../data/review/sheets/drdo-dysl-sm-jrf-2026-1.md) and [LRDE worksheet](../data/review/sheets/drdo-lrde-jrf-03-2026.md) verify retained evidence and record no approval.
- [NCS notice bindings](../data/discovery/ncs-drdo-notice-bindings-2026-09-27.json) tie rows 1 and 3 to exact PDF hashes and staged cycle IDs. NCS posting date remains discovery metadata.
- Retained research PDFs, HTML, text extraction, fetch metadata and rendered DYSL-SM page are under `data/evidence/research/drdo-*`. PDF hashes: DYSL-SM `28cf82d3165bdef0e93864eb419358b7ac67e7b2ef90f74ae07f6bb33e874b4f`; LRDE `030f57db69a1e6d60ef925a53e06de4881202d1e2e5a0356770cddd1ba3586f5`.

## Verification and remaining scope

Four focused tests passed: three DRDO tests plus collector startup isolation. Tests reject changed pagination/editions/documents, count two cycles regardless of vacancies/venues/results, enforce published nationality without OCI override, preserve qualification failures, distinguish advisory from reporting deadlines, and keep language translations separate from proficiency rules. `npm run typecheck`, `git diff --check` and `npm run data` passed; public export remains zero.

Registry now has **120 sources**, including **91 India sources**, across **24 of 250 jurisdictions**. [Saved metrics](phase-51-2026-09-27-metrics.json) report **325 draft cycles in 80 pending packets**, zero measured review decisions and zero approved/public records. Stored-record count remains 18,760 with a separate denominator.

Other DRDO calls, archive notices/amendments, unresolved qualification and willingness wording, connector acceptance evaluation, measured review capacity, further India/Japan/US collection and worldwide coverage audit remain unfinished. Source stays disabled pending review; no publication or launch approval is claimed.

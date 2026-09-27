# Phase 10: NIT Uttarakhand non-teaching recruitment

- Date: 2026-09-25
- Status: saved locally; founder review pending; no publication or deployment

## Goal

Extend current India job coverage with distinct application choices and route-specific international eligibility.

## Changes

- Registered disabled, review-required `in-ut-nituk-nt08-2026` source. Collector binds NIT Uttarakhand's 21 September recruitment-register row to exact 15-page advertisement 08/2026 and official application route.
- Identified 15 distinct post choices in the public registration selector, across five job families and 21 indicative vacancies. Technical Assistant, Technician (SG-II) and Technician branches are separate choices; multiple vacancies in one branch count once. No account was created.
- Marked one-year contractual/deputation appointments as their actual job type. Superintendent, Technical Assistant and Technician (SG-II) have mixed routes; Technician and Junior Assistant are contract only. These are not promised permanent government positions.
- Preserved 4 November 2026 date-only online close and separate mandatory hard-copy receipt by 11 November at 17:30. Neither prints a governing timezone. The 21 September notice date is not assumed to be opening date.
- For contract-only choices, Indian citizenship is deterministic and foreign citizens fail the published rule. Mixed choices keep foreign-applicant assessment unresolved because deputation requires specified existing public service but prints no separate nationality clause.
- No formal language level or test medium is printed. Junior Assistant has a 35 w.p.m. typing threshold without named language.
- Retained older 06/2024 edition as background only; 08/2026 requires fresh applications. Scanned annexed 2019 rules were OCR-read for draft qualifications but original bytes control review. Technician (SG-II) contract terms need reconciliation with annexed rule's no-direct-recruitment field.
- Kept separate DNS Patna scanned Employment News ad as a discovery lead. Its current detailed terms could not be matched to institute's older Lecturer documents, so no cycle was staged from it.

## Verification

- Official register, original PDF and public registration selector checked. Both NIT host robots files allow public paths. Exact PDF hash and sanitized post choices are in `data/evidence/research/nituk-nt08-2026-source-review.json`.
- Focused connector tests: 2 passed, including register drift, changed PDF, 15 choices/21 vacancies, mixed-route uncertainty, contract-only foreign rejection and unknown language/venue.
- Collector staged 15 cycles with 0 approvals and 15 pending reviews. Fifteen founder review sheets were saved. Aggregated queue now has 208 draft cycles from 56 source connectors; none of these drafts enters public export.
- Registry now holds 84 sources across 10 countries, including 70 India sources. These are registered sources, not proof of complete jurisdiction coverage.
- `git diff --check` passed. `npm run build` passed: TypeScript, 259 static pages and secure export (1,709 files, 26.0 MiB, per-page CSP hashes, no detected secrets). Exported India coverage page includes the NIT source and is served at `http://localhost:3003/coverage/IN/`. Previous phase's full 279-test suite passed before this connector; focused NIT tests cover this change.

## Limits

- Portal options are inspected manually and not re-fetched by automated collector because login HTML carries a per-session CSRF token. Founder must reconfirm branch identity before approval.
- Scanned rule pages and mode-specific qualifications need human checking. Official index may publish later corrigenda.
- Other NIT Uttarakhand recruitment and wider India/worldwide source completeness remain open gaps.

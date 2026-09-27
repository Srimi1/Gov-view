# Phase 24 — Japan and US source semantics

Date: 2026-09-25. Saved in Gov-view folder. No founder approval or public listing.

## Change

- Jinji 2026 guide p. 2 says a person without Japanese nationality cannot sit the exam. The staged rule now applies that bar to examination and outcome assessment; ability to submit the online form remains unverified. Foreign graduates still need Japanese nationality. Optional English score bonus does not become a mandatory JLPT or English level.
- Live Jinji collection refreshed the exact-PDF review packet and founder sheet. It staged one checked guide; 20 other guides linked from the official index remain coverage gaps.
- USAJOBS Search API `PositionLocation` now describes published duty locations in text, never exam venues or residence rules. `PositionStartDate` supplies application opening rather than `PublicationStartDate`; an exact Permanent offering labels appointment type. Hiring-path labels, citizenship, work authorization and language remain unverified until full announcement review. USAJOBS credentials are not configured, so this change has a synthetic mapping test only.

## Verification

- Jinji and USAJOBS focused connector tests passed; TypeScript check passed. Full suite: 304 tests passed. `git diff --check` passed.
- Live Jinji stage: 1 pending, 0 approved, 0 kept. Refreshed founder sheet and review queue: 237 drafts from 63 sources. Public listings remain 0.

## Sources and limits

- [Jinji 2026 examination guide](https://www.jinji.go.jp/content/900036094.pdf), p. 2; retained exact bytes in `data/evidence/research/jinji-900036094.pdf`.
- [USAJOBS Search API reference](https://developer.usajobs.gov/api-reference/get-api-search) identifies position location, start and offering fields. [USAJOBS expiration guidance](https://help.usajobs.gov/faq/job-announcement/expiration) states the normal closing time and possible earlier agency closure. [Position offering types](https://developer.usajobs.gov/api-reference/get-codelist-positionofferingtypes) gives Permanent code 15317.
- USAJOBS live API records remain unavailable without credentials; no countrywide US coverage or foreign-applicant permission is claimed from the mapping test.

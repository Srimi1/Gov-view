# Phase 40 — ICMR-NIHR Bhubaneswar medical consultant

Date: 2026-09-25. Saved in Gov-view folder. One upcoming, founder-review contract recruitment cycle staged; zero new public listings.

## Official evidence

- [ICMR national employment index](https://www.icmr.gov.in/employment-opportunities) and [NIHR Bhubaneswar career register](https://www.rmrcbbsr.gov.in/career/) list a 22 September 2026 [Junior Consultant (Medical)](https://www.rmrcbbsr.gov.in/careers/advertisement-for-the-post-junior-consultant-medical/) walk-in on **29 September 2026**. Exact [English](https://www.icmr.gov.in/icmrobject/uploads/Recruitment/1790076083_dristienglishadvt.pdf) and [Hindi](https://www.icmr.gov.in/icmrobject/uploads/Recruitment/1790076088_dristihindiadvt.pdf) PDFs, plus the [institute-hosted Hindi PDF](https://www.rmrcbbsr.gov.in/wp-content/uploads/2026/09/DRISTI-ADVT-2.pdf), are retained and SHA-256 pinned under `data/evidence/research/icmr-nihr-*` and `data/extractions/icmr-nihr-bhubaneswar-junior-consultant-2026.json`.
- One temporary DRISTI project contract advertises **₹80,000 monthly**, MBBS/BDS/BVSc or equivalent relevant degree, and at least six years of post-qualification experience. Walk-in begins **10:30** at Annex Building, NIHR Chandrasekharpur, Bhubaneswar. That is interview start, not a stated last acceptance time. Exact street address appears in detail without invented map coordinates.
- Age table says **“Max. Age Limit 40 to 50 Years”** without linking ages to categories. It remains a manual check. Notice states no nationality or mandatory language level; international applicant, foreign medical credential and optional written-test language remain uncertain.
- May/June NIHR postings reused advertisement number `189/2026-27` and have separate results. The current record is tied to September notice date, exact PDF URLs and institute row; older postings are not repeated or counted as new September applications. Career page contains an older May corrigendum, not a September amendment in the retained snapshot. Newer institute amendments trigger re-review.

## Staging and checks

- Registered disabled, review-required `in-icmr-nihr-bhubaneswar-junior-consultant-2026` source with hourly cadence for its upcoming walk-in. Connector checks national index, institute career/detail pages and three exact PDFs. One transient institute `robots.txt` fetch failure was followed by a successful permitted fetch; failed attempt remains visible in source retry history.
- Live `npm run collect -- --source in-icmr-nihr-bhubaneswar-junior-consultant-2026 --stage`: **1 collected, 0 approved, 1 pending, 0 kept publicly**. [Founder sheet](../data/review/sheets/icmr-nihr-bhubaneswar-junior-consultant-medical-sep-2026.md) records unresolved fields.
- Focused tests **2 passed**, TypeScript check passed and `git diff --check` passed. `npm run data`: **0 public records**. Review queue: **274 drafts from 75 sources**. Worldwide registered-source coverage remains **17 of 250 jurisdictions**.
- Production build remains unverified due the iCloud read stall and existing generated export file-limit breach described in [Phase 39](phase-39-2026-09-25-icmr-national-employment-source.md).

## Next review

Founder checks the medical degree/equivalence route, six-year experience, age rule mapping, international applicant requirements, interview language, any later institute amendment and exact contract terms before approval. Other NIHR and national ICMR roles remain gaps.

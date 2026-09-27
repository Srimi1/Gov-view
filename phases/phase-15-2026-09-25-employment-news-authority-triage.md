# Phase 15 — Employment News authority triage

Date: 2026-09-25. All artifacts live in Gov-view folder. No public launch or review approval.

## DNS-RICM Lecturer

- Employment News lead said 27 September 2026. The [official institute register](https://www.dnsricmpatna.org/notice.php) lists an [advertisement image](https://www.dnsricmpatna.org/BBA/17-08-26.jpeg), [detailed terms](https://www.dnsricmpatna.org/BBA/DetailsofAdvertisment14-08-26.pdf), and [application form](https://www.dnsricmpatna.org/BBA/ApplicationForm14-08-26.pdf), each under 14 August 2026.
- The advertisement covers five contract Lecturer vacancies across four subjects, one recruitment cycle. Initial term three years, extendable to five. Apply with prescribed form and self-attested copies by registered post.
- Official deadline wording is **within 21 days from advertisement publication**. The announcement has no publication date or cutoff time; register date cannot stand in for it. Employment News's 27 September needs an institute amendment or confirmation. Cycle status and absolute deadline remain uncertain.
- Detailed terms give Master's degree with at least 55%, NET or qualifying Ph.D. exemption, teaching experience, and maximum age 38 with no age reckoning date. Form asks nationality and domicile, but notice states no foreign-citizen route or domicile rule. No language level is stated. Each eligibility stage therefore needs verification for international applicants.
- Added hash-pinned, review-only connector and disabled source. Live collection staged `dnsricm-lecturer-august-2026` in `data/review/`, with four retained evidence responses. Founder sheet: `data/review/sheets/dnsricm-lecturer-august-2026.md`. Zero records approved or published.

## NDMA Young Consultant

- Retained [official scanned NDMA notice](https://mitigation.ndma.gov.in/ndmahr-admin/public/uploads/advertisement_document/file67361786946745.pdf), dated 17 August 2026. It says one **contractual** Forest Fire Risk Management Young Consultant position, Indian nationals, online application within 20 days of NDMA website publication, and maximum age 35.
- Employment News says **deputation** and 18 October 2026. Those conflict with the original notice. Document date is not website publication date. No verified amendment or posting timestamp found.
- `mitigation.ndma.gov.in/robots.txt` returned application HTML, and `ndma.gov.in/robots.txt` returned HTTP 403. Source registered disabled with explicit gap; no automated connector or applicant cycle.

## Checks

- DNS-RICM focused connector tests: 2 passed, including document mutation and international-eligibility uncertainty.
- `npm run typecheck`: passed.
- Live stage run: 1 pending, 0 approved, 0 published. Review summary now 222 drafts from 60 sources.
- `npm run build`: passed, 259 static pages. Secure export scanned 1709 files, 26.2 MiB, no detected secrets.
- `git diff --check`: passed before phase note. Recheck after remaining edits.

## Next review decision

Founder needs DNS-RICM publication date or extension before approving deadline. NDMA needs original posting timestamp or amendment resolving its conflicting terms. Neither journal row alone can establish a verified application window.

# Phase 30 — ISRO SAC research posts

Date: 2026-09-25. Saved in Gov-view folder. No founder approval or public listing.

## Change

- Added review-only connector for [ISRO Space Applications Centre advertisement SAC:02:2026](https://www.isro.gov.in/SACRecruitment21.html). It checks the live [ISRO opportunity index](https://www.isro.gov.in/ViewAllOpportunities.html), detail page, and exact SHA-256 of the [original 18-page bilingual PDF](https://www.isro.gov.in/media_isro/pdf/recruitmentNotice/2026/Sept/SAC_02_2026_dated_09092026.pdf) before reusing dates or eligibility claims.
- Staged 16 distinct post-code choices: seven Junior Research Fellow, three Research Associate, and six Project Scientist-I. Together they cover 48 provisional positions; positions are not counted as extra opportunity cycles. Exact post-specific degree subjects and alternative routes are saved in `data/extractions/isro-sac-02-2026.json`.
- Original notice says **only Indian nationals may apply**. Foreign citizens therefore do not match its application rule. Indian nationality alone remains insufficient for a positive verdict: degree, marks, JRF qualifying test, age and any relaxation need review. Source does not state a mandatory applicant language level.
- Applications run 10 September 2026 at 10:00 to 30 September at 17:00. No governing timezone is printed; deadline-day status becomes uncertain after India local 17:00. SAC Ahmedabad is initial work posting, while interview venue will be published later. The connector makes no venue pin from Ahmedabad.
- Positions are temporary with published tenure limits and no right to regular ISRO appointment. Application fee is nil. Online application link comes from the official detail page.
- Retained index HTML, detail HTML, PDF and a text extraction under `data/evidence/research/`. Live collection retained its own exact bodies and generated 16 founder sheets in `data/review/sheets/`.

## Verification

- Focused connector tests passed: 2. TypeScript check passed.
- Live stage collected 16, approved 0, pending 16, published 0. Review queue summary: 264 drafts from 66 sources.
- Full test suite: 311 passed, zero failed. Final TypeScript check passed after the work-location revision and restaging.

## Founder review before approval

- Confirm each post code is independently selectable in the live application form, later corrections, and current portal state.
- Check exact degrees, related-discipline equivalence, marks/CGPA rules, JRF national-test score validity, age and category relaxations, and any final nationality document requirements.
- Confirm interview date and venue once published. Other SAC and ISRO notices remain source coverage gaps.

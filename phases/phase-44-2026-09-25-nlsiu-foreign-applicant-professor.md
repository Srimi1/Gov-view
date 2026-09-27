# Phase 44 — NLSIU Professor (Law) foreign-applicant route

Date: 2026-09-25. Saved in Gov-view folder. One Karnataka public-university recruitment cycle staged for founder review; zero public listings.

## Official evidence

- [NLSIU Work With Us](https://www.nls.ac.in/news-and-events/work-with-us/) lists September faculty recruitment under open positions. Its [faculty summary](https://www.nls.ac.in/news-events/call-for-applications-faculty-positions-at-nlsiu-september-2026/) links five distinct faculty roles; this connector binds only Professor (Law).
- [Professor (Law) role page](https://www.nls.ac.in/news-events/call-for-applications-professor-law-5-vacancies/) and exact [Notification 15/2026 PDF](https://www.nls.ac.in/wp-content/uploads/2026/09/Notification-No.15-Professor_Law.pdf) establish five vacancies, permanent appointment subject to probation, Level 14 pay, online application by **26 October 2026 at 17:00 IST**, and applicant nationality treatment.
- Foreign nationals, OCI, NRI and PIO may apply. Selection is not guaranteed from minimum qualifications. For selected foreign applicants, appointment confirmation depends on required Indian visa approval. The two Professor qualification routes differ; Appendix A also states Master's marks and applicable relaxations.
- Neither checked role page nor notification prints a mandatory language or formal proficiency level. Bengaluru is the campus location, not an interview venue or domicile requirement.

## Collection and review

- Added `connectors/nlsiu-professor-law-2026.ts`, source registry entry and pinned PDF extraction metadata. The connector checks the open-position chain and exact PDF hash; changed terms withhold extraction for review. Original HTML and PDF research copies remain in `data/evidence/research/`.
- `npm run collect -- --source in-ka-nlsiu-professor-law-2026 --stage`: **1 collected, 0 approved, 1 pending, 0 public**. Review packet and retained fetched evidence are in `data/review/` and `data/evidence/`.
- [Founder review sheet](../data/review/sheets/nlsiu-professor-law-15-2026.md) lists every proposed field, source hash and unresolved check. It records no decision.
- Focused connector tests: **2 passed**. TypeScript check, `npm run data` and `git diff --check` passed. Public data still has **0 records**.

## Coverage limit

This is one application cycle for one role, not five cycles for five vacancies. Four other September NLSIU faculty roles, later amendments and wider Karnataka recruitment remain outside this connector. Founder review must precede publication.

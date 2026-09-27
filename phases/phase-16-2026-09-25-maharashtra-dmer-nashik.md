# Phase 16 — Maharashtra DMER Nashik faculty source

Date: 2026-09-25. Saved in Gov-view folder. No founder approval or public listing.

## Source and scope

- [Official Maharashtra DMER news index](https://dmer.maharashtra.gov.in/english/home-news-content/) dated its Nashik entry 24 September 2026 and linked an [eight-page original advertisement](https://dmer.maharashtra.gov.in/wp-content/uploads/2026/09/%E0%A4%9C%E0%A4%BE%E0%A4%B9%E0%A4%BF%E0%A4%B0%E0%A4%BE%E0%A4%A4-04-%E0%A4%B6%E0%A4%BE%E0%A4%B5%E0%A5%88%E0%A4%AE-%E0%A4%A8%E0%A4%BE%E0%A4%B6%E0%A4%BF%E0%A4%95.pdf), Marathi with English qualifications and form. DMER robots.txt allows these paths; only `/wp-admin/` is disallowed.
- PDF SHA-256: `510c8e4a2b462f948f5e5af2168c9e007b64cdd2bff0bec1952489a8047de726`. Original bytes and rendered page images remain under `data/evidence/research/`. Collector also retained exact response bytes under `data/evidence/bodies/in-mh-dmer-nashik-faculty-2026/`.
- One advertisement offers eight vacancies across three faculty ranks and six medical subjects: one Professor, three Associate Professor, four Assistant Professor. Temporary contract lasts up to 364 days or until a regular/reassigned candidate is available. Vacancy count never inflates application-cycle count.
- Page 1 prints applications from 21–28 September 2026, 11:00–17:00, and interview on 7 October at GMC Nashik. It describes direct delivery to the college receipt office or email; it does not list postal submission. No official timezone or final-minute inclusivity is printed.
- Pages 3–5 have rank and subject-specific qualifications; page 6 has age, pay, preference and document conditions. PDF and form do not state a foreign-citizen application route or formal language level. Marathi document language is not an eligibility requirement. Maharashtra institution preference is distinct from a residence ban.

## Work completed

- Added `in-mh-dmer-nashik-faculty-2026` to official registry, disabled and review-required.
- Added hash-pinned connector and two focused tests. Connector fails closed if dated index row or original PDF changes. It returns one incomplete, review-only cycle with nationality and language left unknown; manual checks cover application, selection and appointment stages.
- Live stage run retained two evidence responses and one pending cycle. Founder worksheet: `data/review/sheets/dmer-gmc-nashik-faculty-september-2026.md`. Review summary: 223 drafts from 61 sources; no approved public records.
- Focused connector tests: 2 passed. Typecheck and production build passed; export produced 1709 files, 26.2 MiB, with no detected secrets. The corrected draft was restaged, its review sheet regenerated, and `git diff --check` passed.

## Remaining review

Founder must verify original Marathi clauses, rank/subject qualifications, pay, international applicant/medical registration route, receipt semantics, amendment history and exact interview arrangements. This connector covers one Nashik notice; the DMER index has other colleges and applicant cycles that need separate research and review.

# Phase 13: IIT Bombay rolling faculty source

- Date: 2026-09-25
- Status: saved locally; founder review pending; no publication or deployment

## Goal

Add an India-priority official recruitment source with an express route for foreign nationals. Keep job type, application eligibility, selection, appointment and language evidence separate.

## Source and interpretation

- [Current IIT Bombay faculty application index](https://www.iitb.ac.in/career/apply) links [rolling advertisement L-10/25-26](https://www.iitb.ac.in/job-vacancy-ad/rolling-advertisement-no-l-1025-26). The advertisement itself links an [academic-unit eligibility annexure](https://www.iitb.ac.in/sites/default/files/2026-04/Eligibility%20criteria%20for%20Rolling%20advertisement%20No.L-10%20for%20Assistant%20Professor_Associate%20Professor_Professor.pdf) and [areas-of-specialization annexure](https://www.iitb.ac.in/sites/default/files/2026-01/Areas%20of%20Specialization%20for%20Rolling%20Advertisement%20No.L-10.pdf).
- One rolling call covers Assistant Professor, Associate Professor and Professor ranks. Applicants submit separate forms for chosen academic units; no vacancy count is printed. The connector counts one advertised cycle, not ranks or units as separate opportunities.
- The notice expressly invites Indian nationals, PIOs, OCIs and foreign nationals. Foreign-national appointments are contractual for up to five years and require Government of India permission before joining; foreign-passport holders require political and security clearances at confirmation. Nationality matches the published application route, while actual selection and appointment still need verification.
- General route mentions Ph.D. and rank-specific experience, but the IDC School of Design permits some non-Ph.D. Assistant Professor applicants. Detailed unit annexures vary. The connector does not encode one global education pass/fail rule.
- Notice asks for good communication skills but names no required language, exam medium or proficiency scale. It does not justify an English-level claim.
- Metadata prints 31 December 2026 at 23:59. No governing timezone is named. Rolling batches do not create additional deadline cycles. Interview location is not published; Mumbai is institute location, not an exam/interview pin or domicile restriction.

## Saved work

- Added disabled, review-required source `in-iitb-faculty-l10-2026`, connector `connectors/iitb-l10-2026.ts`, extraction fields, focused tests and README entry.
- Saved original index/advertisement HTML, both official PDFs, extracted text and robots.txt under `data/evidence/research/iitb-*`. Public URLs are outside robots.txt disallowed paths; standard HTTPS GET succeeded without login. PDF hashes are pinned so changes enter review.
- Live collection: one cycle collected, zero approved, one pending, zero kept. The exact review packet and founder sheet are `data/review/in-iitb-faculty-l10-2026.json` and `data/review/sheets/iitb-faculty-l10-2026.md`.
- Registry: 87 sources in 10 countries, including 72 India sources. Aggregate queue: 221 drafts from 59 source connectors. Registered sources do not establish complete coverage.
- Two focused connector tests passed; TypeScript check and `git diff --check` passed. Build passed: 259 static pages, secure export of 1,709 files (26.1 MiB), per-page CSP hashes, no detected secrets. India coverage preview at `http://localhost:3003/coverage/IN/` returns HTTP 200 and shows IIT Bombay as one draft. Public data remains zero records pending review.

## Remaining checks

- Founder must verify all rank- and unit-specific conditions, portal requirements, source terms, amendment status, actual foreign-national appointment route and whether date metadata reflects a governing timezone before approval.
- Other IIT Bombay calls, other Indian employers, live notices across all Indian states and worldwide jurisdictions remain coverage gaps.

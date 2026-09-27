# Phase 12: California CalCareers vacancy

- Date: 2026-09-25
- Status: saved locally; founder review pending; no publication or deployment

## Goal

Expand U.S. state-level official recruitment with a vacancy that distinguishes foreign citizenship, work authorization, exam language and job type.

## Changes

- Registered disabled, review-required `us-ca-calcareers-jc-532295`. Connector checks the exact public job-control page and CalHR applicant FAQ on each fetch; changed filing date, title, type, position count, typing condition, E-Verify language or FAQ citizenship/language wording stops extraction.
- Staged one Office Technician (Typing) position at California Correctional Health Care Services in Fresno County. Job type is 12-month limited-term, full-time and in-office. The classification examination/list prerequisite is not counted as a second vacancy.
- CalHR FAQ says most California jobs do not require U.S. citizenship, but lawful U.S. work authorization is needed. Posting says CCHCS uses E-Verify. Foreign citizens may have a route; individual apply/appointment assessment remains “needs verification” rather than an assumed permission.
- CalHR FAQ says state exams are in English and applicants need job-appropriate reading, writing and speaking ability. No formal CEFR level is printed. Posting separately requires a recent five-minute 40 WPM typing certificate submitted with application; speed is not a language proficiency level.
- Saved 30 September 2026 filing date at date precision. No electronic cutoff hour or governing timezone is inferred. Fresno County is duty location, not a published exam venue or residency requirement.

## Evidence and verification

- [JC-532295 official posting](https://calcareers.ca.gov/CalHrPublic/Jobs/JobPosting.aspx?JobControlId=532295) and [CalHR applicant FAQ](https://calcareers.ca.gov/CalHRPublic/GeneralInfo/FAQS.aspx).
- Original public HTML and source findings are retained in `data/evidence/research/calcareers-*`; exact fields in `data/extractions/calcareers-jc-532295.json`.
- `calcareers.ca.gov/robots.txt` returns text/plain with no active disallow rule. Posting and FAQ loaded through normal HTTPS without account access.
- Two focused connector tests passed. Live collector staged one cycle, zero approvals and one pending review. Founder sheet saved at `data/review/sheets/calcareers-jc-532295.md`.
- Aggregated review queue now has 220 draft cycles from 58 source connectors. Registry has 86 sources across 10 countries: 71 India and three United States. These are registered sources, not proof of complete jurisdiction coverage.
- `git diff --check` passed. `npm run build` passed TypeScript, 259 static pages and secure export (1,709 files, 26.1 MiB, per-page CSP hashes, no detected secrets). Exported U.S. coverage page includes California source as one draft pending founder review and is served at `http://localhost:3003/coverage/US/`.

## Limits

- Founder must verify class minimum qualifications, exam/list eligibility, actual U.S. work authorization, foreign degree equivalency, typing certificate, and current posting before approval.
- Other California vacancies, exams, departments, U.S. states and worldwide jurisdictions remain coverage gaps.

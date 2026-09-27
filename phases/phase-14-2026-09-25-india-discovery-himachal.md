# Phase 14: India discovery feed and Himachal authority inventory

- Date: 2026-09-25
- Status: saved locally; no new applicant cycle approved or published

## Work

- Added `npm run discover:india`: a polite, read-only collector for the [official Employment News all-jobs table](https://employmentnews.gov.in/newemp/AllJobs.aspx?k=All). It saves exact source evidence and 12 observed organisation/post/method/reported-date leads to `data/discovery/in-employment-news.json`. These records are separate from opportunity cycles and public map/search counts. The table has no hiring-authority notice links or eligibility data.
- Found source-format conflict during test: issue-date header says MM/DD/YYYY, but rows contain `31/08/2026` and `24/08/2026`. Parser keeps raw strings, reads this snapshot day-first and fails on a future snapshot without unambiguous proof. No deadline is presented as verified from the journal alone.
- Four leads have reported deadlines from 25 September onward. MECL and NBEMS appear to correspond to already staged exact authority notices; DNS Lecturer and NDMA consultant need original authority notices. See `data/discovery/in-employment-news-triage.md`.
- Added Himachal Pradesh Rajya Chayan Aayog (`in-hp-hprca`) as separate state recruitment authority, linked from the [Himachal Pradesh government vacancies page](https://himachal.nic.in/Content/HtmlPage?qs=LdEF+AuYkB6xEcpFMHdArg%3D%3D). Its `robots.txt` endpoint returns HTTP 200 HTML app shell, not a text/plain policy; connector remains disabled with no applicant records. HPPSC remains a separate source and access gap.

## Verification

- Two discovery parser tests passed, including source-date and malformed-row checks. TypeScript check and `git diff --check` passed.
- Live `npm run discover:india` saved 12 leads and zero applicant cycles. Registry has 88 sources across 10 countries, 73 in India; four journal rows have future reported dates. These are not coverage-completion measures.
- Existing hourly collection workflow now invokes discovery too; script skips when its last successful fetch is under 24 hours old. A parse or fetch failure keeps previous snapshot and fails the workflow after other data can be saved for review.
- `npm run build` passed 259 static pages and secure export (1,709 files, 26.1 MiB, per-page CSP hashes, no detected secrets). India coverage page returned HTTP 200 and shows the HPRCA source gap. Public data remains zero records because founder approvals are pending.
- Full `npm test` was started but stopped after about one minute because serial tests were slow under this iCloud workspace. No full-suite pass is claimed; the two focused discovery tests, typecheck and production build passed.

## Limits

- Discovery journal is not a hiring authority. Original notices and amendments must establish job type, eligibility, language level, location and application deadline before a lead can become a reviewable opportunity.
- HPRCA browser content does not establish automated access permission. No workaround or unofficial mirror was used.

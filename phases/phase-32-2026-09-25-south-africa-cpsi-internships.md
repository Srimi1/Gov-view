# Phase 32 — South Africa CPSI internship source

Date: 2026-09-25. Saved in Gov-view folder. Two pending drafts; no founder approval or public listing.

## Source and records

- Added one review-only South Africa source for [DPSA Public Service Vacancy Circular 34 of 2026](https://www.dpsa.gov.za/newsroom/psvc/circular-34-of-2026/) and its [CPSI Annexure B](https://www.dpsa.gov.za/dpsa2g/documents/vacancies/2026/34/b.pdf). Original HTML and PDF are retained under `data/evidence/research/`; exact PDF SHA-256 gates extraction. The source obeyed project robots and normal TLS checks during live stage.
- The annexure names **Post 34/08, Intern: Internal Audit, Ref 0003/2026**, and **Post 34/09, Intern: Legal Services, Ref 0004/2026**. Separate post references and qualifications create two draft cycles. Both are 24-month contracts with annual salary R98,097 and Pretoria as work centre. Pretoria is not mapped as an examination or interview venue.
- Applications go through CPSI eRecruitment and close **5 October 2026 at 23h59**. The annexure does not name an official timezone or application opening date. Deadline-day status stays uncertain instead of inventing a timezone. It asks for Grade 12 and post-specific NQF 6/7 qualifications, unemployment, no previous government internship, and SAQA evaluation of foreign qualifications at applicant expense.
- Annexure says shortlisted candidates undergo **citizenship or permanent residency verification**. This does not decide whether each foreign citizen can apply, enter selection, or take the job. Those three stages remain manual checks. It requests good verbal and written communication but specifies no named language, CEFR level or certificate.

## Live stage and limits

- `npm run collect -- --source za-dpsa-cpsi-internships-2026 --stage`: **2 collected, 0 approved, 2 pending, 0 kept publicly**. Founder worksheets are `data/review/sheets/za-cpsi-internal-audit-intern-2026-0003.md` and `data/review/sheets/za-cpsi-legal-services-intern-2026-0004.md`.
- Source coverage remains partial: this connector covers only CPSI Annexure B of Circular 34. Other national departments, provinces, circulars, later amendments, and CPSI portal terms need review. No public-launch coverage claim follows from one annexure.
- Current inventory: 250 jurisdictions, 11 with a registered source, 239 unresearched. Review queue: 267 pending cycles in 68 packets. Approved and public records remain zero.

## Founder review before approval

- Check original Annexure B against every post field and confirm whether any later DPSA/CPSI amendment changed deadline or terms.
- Confirm portal submission behavior for each reference, exact timezone, fee, and any named language requirement.
- Ask CPSI about non-citizens, South African permanent residents, work authorization, selection admission, final public-service appointment, and required documents. Residence address alone is not proof of permanent residency.

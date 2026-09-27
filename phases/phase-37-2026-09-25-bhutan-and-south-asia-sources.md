# Phase 37 — Bhutan BCSE and South Asia authority sources

Date: 2026-09-25. Saved in Gov-view folder. One new founder-review cycle and five authority links; zero new public listings.

## Bhutan: source-backed cycle

- [Royal Civil Service Commission BCSE 2026 announcement](https://rcsc.gov.bt/2026/06/announcement-for-bhutan-civil-service-examination-bcse-2026/) and its original six-page PDF state **8 June–7 July 2026** online registration. Main Examination in October is a later stage, not a new application window. Registration is one cycle despite many service preferences and vacancies.
- [Initial vacancy announcement](https://rcsc.gov.bt/2026/06/bcse-2026-vacancy-announcement-for-administration-finance-technical-and-education-service/) listed 711 provisional positions; [August reprioritisation](https://rcsc.gov.bt/2026/08/bcse-2026-vacancy-announcement-for-administration-finance-technical-and-educationservice/) listed **742**. Both versions and original PDFs are retained and hash-pinned. The August count does not reopen registration.
- Original valid **Bhutanese Citizenship Identity Card** is required at document verification before Main Examination. Foreign registration-form acceptance is unstated; foreign citizens cannot satisfy the published selection-stage card requirement. PE assesses English and Dzongkha communication; ME papers differ by service. No formal language-proficiency level is printed. Professional PE exemptions, degree alternatives and age exceptions remain manual checks.
- Live `npm run collect -- --source bt-rcsc-bcse-2026 --stage`: **1 collected, 0 approved, 1 pending, 0 kept publicly**. Founder sheet: `data/review/sheets/bt-rcsc-bcse-2026.md`. Connector tests: **2 passed**; full TypeScript check passed after registry additions.

## Nearby official authority inventory

| Jurisdiction | Official source | Collection state |
| --- | --- | --- |
| Nepal | [Public Service Commission advertisements](https://psc.gov.np/category/notice-advertisement) | Polite fetch returned only client-rendered shell; Nepali notices and Bikram Sambat dates need connector review. |
| Bangladesh | [Bangladesh Public Service Commission](https://bpsc.gov.bd/) | Official Bangla homepage fetched; notice-level BCS and non-cadre extraction pending. |
| Pakistan | [Federal Public Service Commission](https://fpsc.gov.pk/) | Official site identified; collector could not reach robots policy. |
| Sri Lanka | [Public Service Commission](https://psc.gov.lk/) | Official announcements fetched; separate Gazette and notice-level review pending. |
| Maldives | [Civil Service Commission announcements](https://csc.gov.mv/Announcement/ViewAnnouncements?SearchType=1) | Official Dhivehi page fetched; vacancy versus screening/result classification pending. |

Source URLs, retained HTML hashes and exact limits are in `data/evidence/research/south-asia-authority-access-2026.json`. These links are **not verified-empty jurisdictions or applicant listings**. Current directory: **17 of 250 jurisdictions with registered sources**, 233 unresearched. Founder queue: **271 cycles in 72 packets**, zero approved/public records.

## Next review

- Founder checks BCSE PDF revisions, citizenship timing, professional exemptions, service choices, vacancy figures, language papers and individual exam venue before approval.
- Nepal needs supported client data access and date conversion; Bangladesh and Maldives need original-language extraction; Pakistan needs a reachable access policy; Sri Lanka needs notice versus outcome separation. Every country still needs authority inventory and coverage audit.

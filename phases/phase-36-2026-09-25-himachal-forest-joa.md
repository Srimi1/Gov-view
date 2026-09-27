# Phase 36 — Himachal Forest JOA (IT) source

Date: 2026-09-25. Saved in Gov-view folder. One pending application cycle covering two reserved contract posts; no founder approval or public listing.

## Official evidence and draft

- [Himachal Pradesh Forest Department recruitment register](https://hpforest.gov.in/recruitments) links its [four-page original scanned JOA (IT) advertisement and application form](https://hpforest.gov.in/storage/files/1/pdf/Recreuitment/JOA%20IT%20PWD.pdf). Project collector fetched and retained both under robots/TLS policy. Exact register row and PDF SHA-256 gate extraction. Page images and OCR are retained for founder visual comparison; OCR is not independent evidence.
- One PwBD application covers **two contract positions**, one reserved for visually impaired and one for hearing impaired candidates. Cover letter gives ₹12,360 monthly fixed amount. Original advertisement says Indian citizenship, bona fide Himachal residence, age 18–45, alternative academic credentials, and computer typing **30 WPM English OR 25 WPM Hindi**. Typing speed is not a formal language level.
- Deadline conflict within same signed PDF: schedule page says application receipt **30 September 2026**; note below says complete applications must reach the Talland office by **10 October 2026**. Draft leaves `closesOn` and cutoff time unknown, status uncertain, and deadline alerts unavailable. Neither Talland nor Shimla is inferred to be a screening venue or final work posting.
- Nationality clause sits under appointment conditions. Foreign citizenship does not meet published job condition; whether foreign citizens may submit an application or enter screening is not separately stated. Residence and disability proof remain independent checks.

## Collection and verification

- Live `npm run collect -- --source in-hp-forest-joa-it-pwd-2026 --stage`: **1 collected, 0 approved, 1 pending, 0 kept publicly**. Exact-revision founder sheet: `data/review/sheets/hpforest-joa-it-pwbd-2026.md`.
- Connector tests: **2 passed**, including changed register/PDF rejection, deadline conflict, one-cycle count, foreign outcome failure and residence failure. Full TypeScript check passed. Public export: **0 records**. Queue: **270 pending cycles in 71 packets**.
- Separate [Jal Shakti Vibhag recruitment index](https://jsv.hp.gov.in/Home/TableEntryPage?ms=h%2Fyhm1mKjnA9Q3v8n1lz%2FfEKxjyZ7mim03hiLdkahwFacFM%2FtTAfh%2F9qwq3eAJ60) was identified and registered as an access gap: collector could not reach its robots policy. HPPSC and HPRCA access gaps remain. Forest register contains further notices not extracted by this exact connector.

## Founder review before approval

- Ask department which receipt date controls; confirm any amendment, method and office hour. Visually verify all scanned pages and contract amount.
- Confirm PwBD category and certificate rules, Himachal residence proof, qualification alternatives, typing test, age reckoning date, screening venue and final workplace. Keep international application, selection and appointment stages distinct.

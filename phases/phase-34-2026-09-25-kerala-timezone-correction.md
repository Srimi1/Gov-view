# Phase 34 — Kerala deadline timezone correction

Date: 2026-09-25. Saved in Gov-view folder. Twenty-one corrected drafts; no founder approval or public listing.

## Finding and fix

- Kerala PSC's [31 August 2026 gazette](https://www.keralapsc.gov.in/extra-ordinary-gazette-date-31082026) links 14 original category PDFs. Their English deadline text says **7 October 2026 up to 12 midnight**; the notices do not name an official timezone. Existing connector output had set `officialTimeZone: "Asia/Kolkata"` without source support.
- Corrected all 21 category cycles to `officialTimeZone: null`. Date remains 7 October; `cutoffLocalTime` remains null and precision remains date. Collector uses India's civil date only for provisional open/closed status; it does not present that as an official deadline zone.
- Live source stage fetched the current index, gazette, General Conditions and exact original PDFs: **21 collected, 0 approved, 21 pending, 0 kept publicly**. All 21 exact-revision founder sheets were regenerated. Earlier worksheets must not be used to approve the corrected records.

## Verification and remaining review

- Kerala connector and publication tests: 9 passed. TypeScript check passed. Test now asserts unknown official timezone for every category.
- Founder still needs to resolve whether “12 midnight” means start or end of 7 October, confirm any later notice and actual portal behavior, and check nationality, category, qualification, language and age exceptions before approval. No precise cutoff is encoded until supported by official evidence.

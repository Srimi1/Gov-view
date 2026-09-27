# Phase 45 — Goa CBES dates and GSSC conflict

Date: 2026-09-25. Saved in Gov-view folder. Four Goa Staff Selection Commission Advertisement 3/2026 drafts re-staged; zero public listings.

## Official source comparison

- The [Government of Goa CBES public advertisement list](https://cbes.goa.gov.in/advertisement) links each of the four GSSC post pages. [Desktop Publishing Operator](https://cbes.goa.gov.in/advertisement?id=af4f88e3bd8fed998b239e491a70f0a0), [LDC/Recovery Clerk](https://cbes.goa.gov.in/advertisement?id=af4f88e3bd8fed998b239e491a721d79), [Data Entry Operator](https://cbes.goa.gov.in/advertisement?id=af4f88e3bd8fed998b239e491a723168), and [Junior Assistant](https://cbes.goa.gov.in/advertisement?id=af4f88e3bd8fed998b239e491a7248c6) each print **11 September 2026** application start and **2 October 2026** last date. No cutoff clock time or governing timezone is printed on these pages.
- CBES confirms essential Konkani knowledge for each post. The [GSSC original advertisement](https://gssc.goa.gov.in/wp-content/uploads/2026/09/advertisement-no.-3-of-year-2026_compressed.pdf) defines a separate Konkani test threshold of 4/10. Neither source assigns a CEFR level; Marathi is desirable.
- Material conflict: CBES still displays **111 unreserved / 204 total** LDC/Recovery Clerk places. GSSC's [21 September supplementary note](https://gssc.goa.gov.in/wp-content/uploads/2026/09/supplementary-note-to-advertisement-no.-3-of-year-2026_compressed.pdf) changes these to **110 / 203**. The later signed GSSC notice governs the draft count, but founder must reconcile portal display before publication. Existing PwD fee conflict also remains.

## Changes and verification

- `in-ga-cbes-application-portal` added to source registry as an official application source. GSSC connector now fetches five CBES public HTML pages in addition to its PDFs, verifies all four post identities, dates and essential Konkani, and links each draft to its official post page. No extra cycles are created from the second source.
- `data/extractions/gssc-2026-3.json` now records evidenced application start date. Four drafts retain uncertain status and separate application, selection and appointment checks. Source failure or a changed CBES count withholds old extraction for review; disappearance is not called cancellation.
- `npm run collect -- --source in-ga-gssc --stage`: **4 collected, 0 approved, 4 pending, 0 public**. [Post 1](../data/review/sheets/gssc-2026-3-post-1.md), [Post 2](../data/review/sheets/gssc-2026-3-post-2.md), [Post 3](../data/review/sheets/gssc-2026-3-post-3.md), and [Post 4](../data/review/sheets/gssc-2026-3-post-4.md) review sheets regenerated from retained evidence.
- Focused GSSC tests: **8 passed**. TypeScript check passed. Founder decision and public publication remain pending.

## Remaining scope

This work covers four post applications in one GSSC advertisement. Other Goa authorities and CBES advertisements remain gaps. Nationality, 15-year Goa residence-certificate evidence, fee conflict and LDC portal count need founder or authority review.

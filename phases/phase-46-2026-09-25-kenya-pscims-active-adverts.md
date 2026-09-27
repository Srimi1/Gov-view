# Phase 46 — Kenya PSCIMS active adverts

Date: 2026-09-25. Saved in Gov-view folder. Review-only collection; zero Kenya records published.

## Official source

- [Kenya Public Service Commission PSCIMS active adverts](https://pscims.publicservice.go.ke/jobs/ActiveJobsAdverts.aspx) showed **42** numbered adverts on collection: **16 Open** and **26 For Serving Officers Only**. The official [Public Service Commission](https://www.publicservice.go.ke/) links the recruitment service.
- Each row has advert ID, post, ministry, job scale, advertised vacancies, experience years, applicant category, advert date and closing date. Its individual PSCIMS detail page prints corresponding readonly fields and requirements for appointment. [Advert 172/2026](https://pscims.publicservice.go.ke/jobs/AdvertDetailsExt.aspx?kpage=ActiveAdverts.aspx&kpx=172%2F2026) is Open; [D111/2026](https://pscims.publicservice.go.ke/jobs/AdvertDetailsExt.aspx?kpage=ActiveAdverts.aspx&kpx=D111%2F2026) is serving-officer-only.
- **Open is a portal applicant category, not evidence that foreign citizens may apply.** ID/passport registration is not foreign-citizen permission. Checked index/details do not establish any standardized language level or official deadline clock/timezone.

## Collection and review

- New `ke-pscims` source and connector fetch the active index plus each exact detail URL. The parser checks identity, title, ministry, scale, vacancy count, experience and serving-officer flag. Mismatch stops the run; disappearance cannot imply cancellation. All 43 responses retain their hashes and bytes under `data/evidence/bodies/ke-pscims/`.
- **42 drafts staged; 0 approved; 0 public.** Drafts keep nationality, residence/right to work, selection and appointment as separate manual checks. Appointment type is not inferred from the portal's unexplained `P&P` abbreviation. Dates retain day precision; unknown venues remain unknown.
- Founder review packet is `data/review/ke-pscims.json`; representative [Open advert sheet](../data/review/sheets/ke-pscims-172-2026.md) and [serving-officer advert sheet](../data/review/sheets/ke-pscims-d111-2026.md) verify retained bytes. The packet holds all 42 revisions; no review decision was entered.
- Source registry reach: **116 sources across 24 of 250 jurisdictions**. Kenya PSCIMS covers one national recruitment portal, not Kenya's other authorities or the other three pathways. Notice amendments, full service rules, foreign-citizen permission, job sites, fees, language expectations and selection venues still need founder review.
- Retained-evidence cap rose from 750 to 800 MiB after the first run reached the old ceiling. Existing evidence stayed intact.

## Verification

- Parser fixture: 42 unique rows, 26 serving-only, 16 Open; representative detail pages match. Mismatch tests reject changed details.
- Focused tests and TypeScript check passed. Collector staged all 42 drafts from live official pages; no public publication occurred.

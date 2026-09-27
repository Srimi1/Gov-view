# Phase 38 — JKPSC GCET Librarian source

Date: 2026-09-25. Saved in Gov-view folder. One closed, founder-review recruitment cycle staged; zero new public listings.

## Official evidence and extraction

- [JKPSC homepage](https://jkpsc.nic.in/Default.aspx) resumed serving current notice links after an earlier maintenance response. It links [notification 07-PSC (DR-P) of 2026](https://jkpsc.nic.in/PDF/AP_LIB_BACKLOG_2026.PDF) for GCET backlog vacancies, [7 August corrigendum](https://jkpsc.nic.in/Pdf/Downloader1.ashx?nid=18028&type=n), [28 August extension](https://jkpsc.nic.in/Pdf/Downloader1.ashx?nid=18039&type=n) and [15 September extension](https://jkpsc.nic.in/Pdf/Downloader1.ashx?nid=18041&type=n).
- All four original PDFs and homepage HTML are retained in `data/evidence/research/jkpsc-*`; exact PDF SHA-256 hashes are pinned in `data/extractions/jkpsc-gcet-librarian-2026.json`. PDFs are scans. Original notification's seven pages were OCRed; key original and extension pages were visually checked. OCR text remains a research aid, not replacement evidence.
- Item 4 of notification 07 is **one Librarian vacancy reserved for SC backlog**. Online forms opened 1 August and closed on **18 September 2026** after two extensions. Qualification and reservation cutoff stayed **31 August 2026**. No closing hour or named official timezone is printed. Other notification 07 items and notifications 05/06 remain gaps; extensions do not create additional application counts.
- Notice requires a valid J&K domicile certificate and SC category proof for this item. It does not state citizenship eligibility. Foreign-university degree equivalence is an academic route, not evidence that international applicants can apply or obtain appointment. No formal language level is stated; exam language and degree equivalence need review. Srinagar/Jammu are centre options, not a published candidate-specific venue.
- 7 August corrigendum corrects notification 07's service-rule reference. It corrects age and pay text for notifications 05/06, not this Librarian item's stated pre-revised pay band. Founder must verify current pay mapping and service rules.

## Staging and checks

- Source `in-jk-recruitment` uses disabled, review-required `jkpsc-gcet-librarian-2026` connector. Current homepage links and all four pinned PDF bytes gate extraction. Rotating homepage is not a complete notice archive.
- Live `npm run collect -- --source in-jk-recruitment --stage`: **1 collected, 0 approved, 1 pending, 0 kept publicly**. [Founder sheet](../data/review/sheets/jkpsc-gcet-librarian-sc-backlog-2026.md) records exact evidence and unresolved fields.
- Focused connector tests: **2 passed**. TypeScript check and `git diff --check` passed. `npm run data`: **0 public records**. Review queue: **272 drafts from 73 sources**. Registered-source coverage remains **17 of 250 jurisdictions**.

## Next review

Founder checks original scans and every amendment, SC/domicile eligibility, qualification alternatives, exact application identity, exam language, current pay scale and any newer notice before approval. JKPSC rotating homepage and departmental recruitment need broader source inventory.

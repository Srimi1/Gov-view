# Phase 17 — appointment type in search and review

Date: 2026-09-25. Saved in Gov-view folder. No founder approval or public listing.

## Change

- Added a source-backed appointment type to opportunity records: permanent, contract, temporary, deputation, or apprenticeship. Missing type stays unknown; a selected type excludes unknown records.
- Added appointment type to shared search filters, result cards, opportunity details, and public share URLs. Share URLs still exclude profile data. The map and list use the same cycle filter, so venue count does not change result totals.
- Added appointment type to public summaries and to the approval revision hash. A changed type needs fresh founder approval. Review sheets show the field.
- Classified the exact DNS-RICM Lecturer and DMER Nashik faculty drafts as contract from their retained official notices. Both source packets and founder review sheets were regenerated; both remain pending. Nashik is temporary contractual employment, with the duration explained in its outcome.
- When a notice links to application instructions without one verified delivery route, the action now says “View official application instructions” rather than implying online submission.
- Added two clearly labelled demo fixture types so the filter can be tried without approved records.

## Verification

- 25 focused tests passed, including appointment filter/count, share-link allowlist, connector evidence, and reapproval gate. Typecheck passed.
- Production build passed: zero public records, 1,709 exported files, 26.2 MiB, no detected secrets. `git diff --check` passed.
- Full suite was attempted once. Many connector fixture reads from this iCloud folder failed with `ETIMEDOUT`; the focused changed-code tests passed. It needs another run when local files are fully available.
- Browser check at `http://localhost:3003/?appointment=contract` showed the Contract selection in More filters and restored it in the public URL.
- Metrics: 91 registered sources, 61 pending packets with 223 draft cycles, 0 approved/public records. Worldwide coverage audit remains open.

## Limits

- Other notices still need their own official appointment-type evidence and founder review; no type is inferred from job title or page language.
- International applicant permission and formal language level remain unknown for both new contract drafts. Work authorisation and medical registration for Nashik need founder checks.
- Production map still shows its accessible fallback while Cesium's strict-CSP conflict is unresolved. Public launch remains blocked by worldwide coverage and review gates.

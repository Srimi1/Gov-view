# Phase 49 — Complete NCS discovery snapshot

Date: 2026-09-27. Saved in Gov-view folder. Research only; no cycles imported or published.

## Captured evidence

- [Official National Career Service classified index](https://ncs.gov.in/latest-update): all **145 rows** captured through ten pages of the visible public paginator, page size 15. Sequence numbers 1–145 are unique and contiguous; final Next page control was disabled.
- [Structured DOM capture](../data/evidence/research/ncs-classified-jobs-2026-09-27-browser.json) retains raw organisation, position, posting date, advertised vacancies, Type and published link target. Dictionary indexes are zero-based; `rowColumns` defines decoding. Contains 76 raw organisation labels, 35 raw Type labels and 57 distinct link targets. Raw labels are not reconciled authority identities.
- [Integrity record](../data/evidence/research/ncs-classified-jobs-2026-09-27-browser-integrity.json) records SHA-256 of local artifact bytes. Decoded rows matched browser capture by length and FNV-1a fingerprint. This is a browser DOM snapshot, not a complete raw HTTP response; prior ten-row HTML evidence remains in Phase 48.
- Current manual index pagination is complete. This does not establish completeness of NCS, Indian government recruitment, or worldwide coverage. Scheduled automated pagination is not implemented. Registry source remains disabled with no connector.

## Issues preserved for review

| Finding | Handling |
| --- | --- |
| Nalanda rows 125 and 126 share organisation, roles, date, four vacancies and link; only Type wording differs | Possible duplicate call. Retain both source rows; never count as two verified cycles. |
| Type includes UR/OBC/SC/ST/EWS reservation categories as well as appointment labels | Preserve raw text. Employer evidence must establish appointment arrangement and eligibility. |
| Rajasthan row 24 is a corrigendum; row 25 is a recruitment notice | Link revisions to correct cycle after reviewing notices; amendment is not another opportunity. |
| Many role rows share one PDF or UPSC landing page | Neither row count nor distinct URL count is a cycle denominator. |
| India Post row 4 has a blob URL | No durable notice established. Do not guess a replacement. |
| CISF rows 87–89 share a time-limited signed storage link | Query signature omitted from saved research artifact. Base path is discovery only; usable durable official evidence still needed. |
| Several targets are general homepages, institutional domains, or HTTP | Identify issuing authority and exact notice before collection acceptance. |
| Posting dates span January–September 2026 | Dates are index posting labels, not opening/deadline evidence. Current availability remains unknown. |

## Applicant eligibility and next work

Index does not establish citizenship, residence, age, qualifications, language requirements, fees, deadlines, selection eligibility or resulting appointment eligibility. No applicant assessment is inferred from employer name, reservation label or overseas-job navigation.

Next collection work: reconcile these leads with existing source registry and staged cycles; verify original notices and amendments; establish durable evidence for broken/temporary links; document permitted recurring access; propose connectors only where source contracts can be validated. Founder review remains required before publication.

## Verification and current scope

- Snapshot validation: 145 rows, contiguous unique sequences, valid dictionary references and matching browser transcription fingerprint.
- Fresh `npm run typecheck` passed, including NLSIU unreviewed-PDF guard. Four focused NLSIU tests passed; `git diff --check` passed; `npm run data` exported zero public records.
- Registry unchanged at **118 sources**, including **89 India sources**, across **24 of 250 jurisdictions**. Snapshot adds no connected authority or jurisdiction.
- Public records remain zero. Worldwide coverage audit and first-output review remain incomplete.

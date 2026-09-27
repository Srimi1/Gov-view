# Phase 59 — India primary-source rechecks and accurate fetch times

Date: 27 September 2026 (Asia/Kolkata). Rechecked three existing pilots; no new source, applicant cycle, founder decision or public listing was added.

## Live rechecks

The previous India inventory found 22 designated primary adapters with pending review packets but no source-health row. Ran the normal collector with `--stage` for:

| Source | Actual retained responses | Pending cycles | Result |
| --- | ---: | ---: | --- |
| Uttarakhand PSC (`in-ut-recruitment`) | 4 | 1 | Exact index and three original PDF links passed; two advertisement links have identical bytes. |
| Tamil Nadu PSC (`in-tn-recruitment`) | 6 | 4 | Index, dashboards and bound notice checked. Three older dashboard/date conflicts remain explicit. |
| Andaman/Nicobar (`in-an-recruitment`) | 2 | 1 | Existing Agriculture card and scanned notice passed; ambiguous midnight cutoff remains withheld. |

All twelve retained responses passed SHA-256 and byte-count checks. Source health now has actual receipts for these three entries. India connected-source count rises **39 → 42**; this counts sources with successful fetch history, not accepted connectors, enabled schedules or complete authority coverage. Remaining designated primary adapters without health rows: **19**. The separate nine primary entries without adapters remain unresolved.

[Baseline](../data/discovery/india-primary-health-baseline-2026-09-27.json) and [refresh manifest](../data/discovery/india-primary-health-refresh-2026-09-27.json) retain before/after health, receipt paths, candidate IDs, packet digests and revision limits. Application windows and candidate IDs did not change. Uttarakhand's packet remained byte-identical. Tamil Nadu's previous packet lacked stored approval revisions; the normal collector now records them. Andaman's evidence and record revisions changed and remain pending review. No claim that all proposed criteria were unchanged is made.

Regenerated the [Andaman worksheet](../data/review/sheets/andaman-agriculture-group-b-c-2026.md), created the [TNPSC 8/2026 worksheet](../data/review/sheets/tnpsc-2026-8.md), and refreshed the queue summary. International eligibility, language requirements, form grouping, qualification exceptions and source timezone interpretation still need their recorded review. No approval or reviewer minutes were inferred.

## Freshness defect and correction

The collector previously set `lastSuccessfulFetchAt` from its run-start clock. Uttarakhand's live run exposed the error: source health said **20:59:24.810 UTC**, while the final successful response was retained at **21:01:16.468 UTC**. Attempt and successful-fetch time were being conflated.

`scripts/collect.ts` now derives successful-fetch time from the latest valid response receipt. Missing or invalid receipt timestamps fail the check and preserve previous freshness. This does not create human validation. Corrected the two runs completed before the fix using their verified retained receipts; [correction journal](../data/discovery/india-primary-fetch-time-corrections-2026-09-27.json) records both old/new values. Andaman's subsequent live run used the corrected collector directly. All three validation timestamps remain **null**.

## Regression verification

Used TDD at the existing collector CLI and persisted source-health/evidence interface. An isolated temporary workspace runs the real collector, parser, evidence retention and publication gate against retained official HTTP responses. Only external HTTP is substituted; the production workspace and network are not written by these tests.

The receipt-time regression failed before the fix and passed afterward. A second integration check verifies that a changed PDF preserves the previous successful-fetch timestamp and pending packet; restoring the notice and retrying yields one pending cycle with no approved record or duplicate. It also checks separate validation and coverage timestamps.

**18 existing connector/publication checks** passed, plus **2 new collector integration checks** after the fix. Typecheck, public-data build and `git diff --check` passed. Public-data build still produces **0 records**. The full repository test suite was not rerun.

Automatic coverage regeneration also replaced descriptive text for some research-only countries. Promoted the already recorded authority/pathway coverage-limit statement into registry `accessGap` for Indonesia, Malaysia, Thailand, Mexico, Chile, Colombia, Denmark and Belgium so later collectors retain it. No gap was declared resolved. Their connected counts and fetch/validation timestamps remain unchanged; country descriptions were regenerated from registry state.

## Measured state and remaining work

[Metrics](phase-59-2026-09-27-metrics.json): **142 sources**, **93 India sources**, across **40 of 250 jurisdictions**. Queue remains **328 drafts in 82 packets**. Human decisions, approved records and public records remain **0**. Stored collected records total **18,760**, a different denominator. Existing export still exceeds the file-count gate; no deployment was attempted.

Founder request for the Bengaluru BEL worksheet remains pending. Continue permitted source rechecks, remaining India primary-channel work and worldwide authority discovery while awaiting that decision. Connector acceptance, original-language review, the labelled notice audit and worldwide coverage audit remain incomplete.

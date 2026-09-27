# Phase 64 — Searchable applicant and source research

Saved 27 September 2026, Asia/Kolkata. This phase exposes existing research on country coverage pages. It does not add sources, candidate cycles, eligibility rules or approvals.

## Applicant experience

Each country with registered sources now has a searchable source directory. The source count links straight to search, so India's 93-authority list does not need to be scrolled first. Search covers authority and source names, Indian state/UT and US state names/codes, applicant notes and collection gaps. The initial view includes every registered source. Clearing search restores that view; no matches explicitly do not mean no opportunities or applicant ineligibility.

Source cards show the official link, authority, collection status, any subdivision scope, recorded research notes, collection gap and available source-identification evidence. Appointment type, international-applicant permission and language findings that were previously hidden on country pages are now readable. Missing notes receive an explicit unknown-state explanation.

Research is labelled **awaiting review**. Text matching never calculates eligibility or treats a restriction as a positive match. Users still need cycle-specific evidence for applying, entering selection and obtaining the resulting job or credential. Research dates remain separate from successful collector-fetch and validation dates. Registered-source counts are explicitly distinct from application-cycle counts.

The country page remains server-rendered with all source cards present before JavaScript. Only text filtering uses a client component. An explicit display-field projection keeps collector configuration out of client props. Keyboard-labelled controls, announced result counts and readable wrapped notes support the existing list fallback without loading the globe.

Browser checks exposed 52 existing React duplicate-key warnings on India: three repeated authority names and 49 repeated gap strings when stored gaps and source gaps were combined. Country pages now deduplicate identical **display strings** in first-seen order. India's authority list displays 90 distinct names, while its source count remains 93; no source or cycle is removed. Japan and US each had three duplicate combined gap strings. A fresh browser reload of the fixed page showed no issues badge. [Duplicate-display receipt](phase-64-2026-09-27-display-duplicates.json) records the original collisions.

## Preserved data

The registry, coverage records, source health and all 82 review packets were compared against pre-edit SHA-256 hashes: **85 files unchanged**. No collection job ran and no source note became a published opportunity or structured eligibility rule. [Protected-state receipt](phase-64-2026-09-27-protected-state.json) retains these hashes.

[Measured state](phase-64-2026-09-27-metrics.json) remains **162 sources**, including **93 India**, **seven Japan** and **five US**, across **56/250 jurisdictions**. **194 jurisdictions lack registered sources**. The review queue remains **328 drafts in 82 pending packets**; measured human decisions and approved/public records remain zero. Stored collected records are a separate denominator: 18,760.

## Verification

The [final verification receipt](phase-64-2026-09-27-verification.json) records **354 tests passed, zero failures or skips**, two successful typecheck runs, and a successful public-data build with zero approved records. [Full test output](phase-64-2026-09-27-test-results.txt) and [typecheck output](phase-64-2026-09-27-typecheck.txt) are saved. No production framework build or deployment ran in this phase.

React server renders checked all 93 India, seven Japan, five US and one Ghana research cards, with source-note HTML escaping. Browser checks on the actual Next.js pages verified India language/state-code searches, whitespace/case handling, explicit no-match uncertainty, keyboard clearing, international-applicant notes, Japan's conditional N1 research and California name search. The direct source-search link and duplicate-warning fix were also checked. [Verified source-search screenshot](phase-64-2026-09-27-source-search.png) is saved.

Two read-only reviews, including follow-up review of the duplicate-row fix and shortcut, found no actionable Standards or Spec findings. Local Next.js dev compilation serves India, Japan and US with HTTP 200. Initial Turbopack/browser attempts timed out while files loaded; local dev was restarted with the documented Webpack flag. Small installed dependency and source files were read in bounded parallel batches to warm filesystem reads; no package was added or updated. Next.js refreshed generated TypeScript route references and include entries. No deployment, commit or founder decision was made.

Worldwide source coverage, verified collection, per-cycle applicant criteria, founder acceptance and independent public-launch audit remain incomplete. The existing export still exceeds its project file-count budget: 18,383 files against 18,000. This phase does not resolve or waive that gate. Goal remains active.

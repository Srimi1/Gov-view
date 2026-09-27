# Phase 10: Muse Spark collaboration check

- Date: 2026-09-25
- Status: version and preview checked; Muse Spark review and two small code tasks complete

## Verified local state

- Codex side-tray terminal is running Muse Code **1.4.0-R4161.1**, upgraded in that terminal from **1.3.0-R3401.1**. TUI status shows **muse-spark-1.3**, **max** reasoning, GOV View workspace.
- Muse CLI exposes `session-message`, `serve` (MSP host), `--agents`, `--worktree`, and subagent isolation options. These are observed capabilities, not a verified 1.4.0-specific changelog.
- Meta's [Muse Code features post](https://dev.meta.ai/resources/blog/muse-code-new-plans-and-features) describes inter-session messaging between Muse sessions, workflows with live `/workflows`, rewind, and SDK developer preview. Meta's [Muse Spark 1.3 announcement](https://research.meta.ai/blog/introducing-muse-spark-1-3) confirms model availability in Muse Code and max reasoning.
- `muse session-message list --json` and direct `send` to the open GOV View Muse session both returned `external_agent_ingress_closed`. Codex computer control cannot interact with the Codex app UI. No prompt reached Muse through these paths.
- Read-only review brief saved as `phases/muse-spark-review-request-2026-09-25.md`. Since the open TUI could not receive external messages, a separate Muse Spark 1.3 `muse exec` run completed that brief with writes disabled. Exact changes specific to Muse Code 1.4.0 remain unverified; the observed CLI features are capabilities present in 1.4.0, not proven new features.
- Muse Spark then took bounded ownership of `connectors/iiserkol-nt04-2026.ts` and its test through `phases/muse-spark-implementation-2026-09-25.md`. It added a test covering all seven pending cycles' citizenship, unresolved reckoning date, separate deadlines and unknown timezone. Existing connector needed no production edit. Focused test: 3 passed.
- Codex updated `scripts/review-packet.ts` to show priority review candidates ahead of the alphabetical source sections. Potential conflicts are clearly labeled as triage hints. Seven IISER cycles display 19 October 17:30 with unknown timezone. The summary remains local and cannot approve or publish records.

## GOV View state

- Local India coverage preview at `http://localhost:3003/coverage/IN/` showed 69 registered India sources, 15 fetched, seven pending IISER Kolkata drafts, zero public records, and explicit gaps at check time. Worldwide registry then totaled 83 sources across 10 countries/territories, far from audited worldwide coverage.
- Production export exists and secure scan passed: 1,709 files, 26.0 MiB, no detected secrets. Full suite ran 278 tests: 277 passed, one Jharkhand PDF fixture timed out on iCloud; its focused rerun passed 2/2. Muse's new focused IISER test passed 3/3. Standalone typecheck stalled on iCloud file reads and was stopped; prior Next build passed its TypeScript stage before these small changes. A temporary local-copy attempt also stalled while copying the iCloud-hosted dependencies, so no fresh full typecheck result is claimed.
- After a separate NITUK review packet appeared in the shared folder, `npm run review:packet` generated a queue of 208 pending cycles from 56 staged sources. This is a later snapshot than the 193/55 count in the first Muse review. No founder approvals or public opportunities are implied.

## Candidate next updates

1. Founder review flow: prioritize 193 pending drafts by deadline, contradiction, cancellation and source failure. Start with IISER's conflicting age/qualification date; preserve zero public claims until evidence is resolved.
2. Coverage audit: measure source and authority denominator by jurisdiction, unresolved gaps, review time and recall. Expand India state/department feeds and pilot countries using exact official notices.
3. Applicant utility: show distinct application, selection and job/licence eligibility with notice citations; add saved searches and deadline alerts after review pipeline can sustain them.

Muse reviewed this order and recommended resolving IISER's reckoning date with source evidence, keeping deadline timezone unknown, and triaging the pending founder queue before expanding sources. Parallel edits used separate owned files.

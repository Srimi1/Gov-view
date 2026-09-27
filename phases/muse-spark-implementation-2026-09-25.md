# Muse Spark implementation — IISER guard

Work in shared GOV View folder. You are not alone in codebase. Codex edits review packet files in parallel. Do not revert or overwrite others' work; adjust to concurrent changes.

Own only `connectors/iiserkol-nt04-2026.ts` and `connectors/iiserkol-nt04-2026.test.ts`. Read other files as needed. Do not edit data, registry, review sheets, coverage UI, package files, or Git state. Do not commit, push, install, publish, deploy, or contact people.

Implement smallest useful safety guard for IISER NT-04-2026's seven pending application cycles:

1. Assert foreign citizenship does not meet the notice's Indian-citizen requirement; do not overstate whether other routes exist.
2. Preserve uncertainty for age/qualification reckoning because notice page 1 cites 19 September 2026 while instruction 35 cites the 19 October 2026 online closing date. No automated age match or invented resolution.
3. Assert online 19 October 2026 17:30 and hard-copy 29 October 2026 17:30 remain separate deadlines, with official timezone unknown.

First inspect current connector and tests. Add or adjust only meaningful assertions and minimal production code if needed. Run focused tests for this connector. Report exact changed files, passing or failing tests, and any gap. Stop if prompt conflicts with source evidence. Do not make unrelated changes.

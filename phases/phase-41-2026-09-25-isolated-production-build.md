# Phase 41 — Production build verification

Date: 2026-09-25. Saved in Gov-view folder.

## Result

- Production build **passed** in a clean local snapshot of the project, outside iCloud Drive. The snapshot excluded generated directories (`node_modules`, `.next`, `out`, `public/cesium`), retained research evidence, review sheets, local worktrees, and the reference ZIP. These are not build inputs. Source code, package lock, and published data were copied from the project folder.
- `npm ci --ignore-scripts --prefer-offline` installed the lockfile's 58 packages; npm reported zero vulnerabilities. `node scripts/copy-cesium-assets.mjs` restored local Cesium browser assets.
- `npm run build` completed Next.js 16.3.6 compilation, TypeScript, and **259** static pages. `scripts/secure-export.mjs` passed: **1,711 files**, **26.6 MiB**, per-page CSP hashes, no detected secrets.
- `npm run data` generated **zero public records**, as expected: no founder-approved cycle exists. This verifies build mechanics, not source coverage or publication readiness.
- Clean export is saved in `preview/` and as `artifacts/production-build-2026-09-25.tar.gz` (SHA-256 `4e238988f61fb0662663c54dbfccc02617067543631786385ce3fadec16454ac`). Local preview at `http://localhost:3003/?demo=1` now serves `preview/`; HTTP 200 and `preview/index.html` hash matches clean build output. Generated preview and archive are ignored by Git but remain in this folder.
- Browser check confirmed the demo workspace renders 16 clearly labelled synthetic cycles, globe controls, country counts, published venue pins, and an India civil-service detail panel with international-applicant and language uncertainty. The demo application button is disabled.

## Folder state

- `npm run metrics` in the original iCloud folder reports **18,383** files / **331,709,866** bytes in its existing `out/` directory and `withinLimits: false` against the 18,000-file gate. Numbered iCloud conflict copies pollute that generated output. This does not change the clean build result. Keep the existing output until generated-file cleanup is explicitly reviewed; a future clean export in the project folder should replace it before deployment.
- Current coverage: **17/250** jurisdictions with registered sources, **5** with enabled sources, **3** with collected records, **0** with approved/public records. Queue: **274 cycles from 75 source packets**. Public launch remains gated by worldwide coverage audit and founder review.
- Latest source work: [ICMR-NIHR Bhubaneswar Junior Consultant (Medical)](phase-40-2026-09-25-icmr-nihr-bhubaneswar-junior-consultant.md), one 29 September walk-in cycle staged with official English/Hindi notices and unresolved international-applicant rules.

## Verification limits

- Build used temporary path `/tmp/govview-build-9NI5cO`; its generated export has been copied into this folder. No review decision, public record, or deployment changed during verification.
- TypeScript check previously passed in the project folder after excluding iCloud's generated `.next`/`out` duplicates from `tsconfig.json`. Focused Phase 40 connector tests passed (2/2). Full suite was not rerun for this verification-only phase.

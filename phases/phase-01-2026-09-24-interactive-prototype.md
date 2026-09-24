# Phase 01: Interactive internal prototype

- **Date:** 24 September 2026
- **Project:** GOV View — Global Career Opportunity Observatory
- **Status:** Milestone 1 implemented and locally verified
- **Target specification:** [Product specification](../docs/PRODUCT_SPEC.md)

## Goal

Build an internal, clearly labeled prototype for visual discovery of worldwide career opportunities. Preserve future worldwide scope while demonstrating recruitment, licensing, admission, and vocational pathways in six pilot jurisdictions.

## Saved work

- Fresh Next.js, React, and TypeScript application with responsive desktop workspace and mobile list-first layout.
- Cesium ellipsoid globe, bundled Natural Earth boundaries, jurisdiction totals, selected-jurisdiction navigation shading, close-zoom pilot subdivision lines, and pins only for published fixture venues. Globe loads in browser on demand; list and details remain available if globe fails.
- Shared search, pathway, jurisdiction, deadline, shortcut, and optional visible-area filters. List and globe aggregates count distinct application cycles; multiple venues and repeat notices do not inflate totals.
- Detail panel with outcome, source-precision dates, timezone, cutoff uncertainty, qualifications, fees, selection stages, nationality and residence uncertainty, three separate eligibility assessments, evidence status, source freshness, and change history. Official application action stays disabled for fixtures.
- Coverage explorer with distinct states for no verified listings and sources checked with no current opportunities.
- Public display-state share URLs with strict field validation and no profile or account fields.
- Six pilot jurisdictions, 16 synthetic cycles, four pathways, and open, closed, extended, cancelled, stale, and uncertain cases. Fixture scenario date is 24 September 2026.
- Local Cesium browser bundle, workers, widgets, assets, and license copied by `npm ci`; no remote imagery or terrain token required.

## Key files

| Area | Files |
| --- | --- |
| Product target | `docs/PRODUCT_SPEC.md` |
| Run instructions and scope | `README.md` |
| Application UI | `app/`, `components/Workspace.tsx`, `components/GlobeView.tsx` |
| Fixtures and selectors | `lib/opportunities.ts`, `lib/geography.ts` |
| Share-state codec | `lib/public-view.ts` |
| Local map assets | `public/geo/`, `scripts/copy-cesium-assets.mjs` |
| Checks | `lib/*.test.ts`, `package.json`, `package-lock.json` |
| Reference archive | `gods-eye-view-main.zip` |

## Decisions and provenance

- All opportunity, source, eligibility, coverage, and venue records in this phase are synthetic. No official notice has been verified.
- No source code was copied from God’s Eye View. Its viewer ownership and resource-cleanup patterns informed this implementation. Inspected reference revision: `ce671ce500a393be27e3cbb2a08799fbca9b6e28`.
- Natural Earth boundary provenance appears in `public/geo/README.md`.
- Bundling Cesium directly caused an invalid embedded WASM escape in production chunks. The globe now loads Cesium’s locally copied prebuilt browser file, `/cesium/Cesium.js`; build artifacts passed syntax checks and production browser verification.
- Selected jurisdiction shading is a navigation cue. Per-cycle hiring or regulatory scope geometry belongs to later verified-data work.

## Verification performed

- `npm ci --no-audit --no-fund` succeeded and copied local Cesium bundle, assets, and license.
- `npm test` passed all 17 tests covering fixture states, counts, filters, geography intersections, and public share-state validation.
- `npm run typecheck` passed.
- `npm run build` passed with Next.js 16.3.6.
- Browser check of production preview showed rendered globe, list, detail panel, and accessible marker menu. India navigation showed shading and close-zoom subdivisions; published venue selection opened its cycle. Production preview had no new browser errors after Cesium loader fix.

## Limits

- This phase uses fixtures only. Dates, eligibility criteria, venues, authority names, and coverage states cannot guide real applications.
- Mobile list-first behavior is implemented in responsive layout; visual mobile viewport testing was unavailable in the in-app browser during this session.
- Local preview ports are temporary. Start a fresh preview with `npm run dev` or `npm run build && npm run start` when needed.
- Folder has no `.git` repository, so no diff stat, commit history, staged changes, or commit was created. Save Phase script requires Git and could not run; this document records the phase manually.

## Next work

1. Milestone 2: source registry, restricted ingestion worker, retained evidence, normalization, review queue, revisions, and measured 24-source pilot.
2. Milestone 3: verified records in exploration, optional accounts, deterministic eligibility, bookmarks, alerts, and grounded text assistant.
3. Milestone 4: worldwide jurisdiction inventory, gap reconciliation, independent coverage audit, and public-launch decision. Public launch stays blocked while material gaps or critical conflicts remain.

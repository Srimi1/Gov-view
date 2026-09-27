# Phase 20 — visible, separated prototype demo

Date: 2026-09-25. Saved in Gov-view folder. No founder approval or public listing.

## Work completed

- Added explicit browser demo mode at `/?demo=1`. The normal workspace links to it only when no reviewed notices are published. Sixteen existing fixtures cover four pathways and open, closed, extended, cancelled, stale and uncertain states.
- Demo URL state keeps `demo=1` while filters and selected cycles change. Result links and the copy-link action point back to the demo workspace, so reloading a shared selection restores the same synthetic example.
- Demo always carries a visible results label even if the top notice is hidden. Opportunity detail suppresses its “Official language wording” link for fixture-only rules. Every fixture has no application URL.
- Added a synthetic JLPT N2 selection requirement to the Japan admission fixture to exercise language-level display and profile matching. Text identifies it as invented; no real school or rule is asserted.
- Reviewed-record export remains zero. Demo records are loaded in browser only when explicitly requested and are excluded from public JSON and sitemap.

## Verification

- Typecheck, 19 focused data/client/eligibility/share-link tests, production build, secure export and `git diff --check` passed.
- Browser normal mode showed zero reviewed opportunities and the demo link. Browser demo mode showed 16 labeled examples. Japan admission detail showed synthetic JLPT N2, no official application action, and survived share-view reload.
- Production build exported 1,709 files with no detected secrets. Production globe still uses the accessible country-list fallback because Cesium conflicts with strict CSP; that remains a delivery gap.

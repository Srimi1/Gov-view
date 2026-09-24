# Phase 02: Real data, working eligibility, precise map, redesign

- **Date:** 24 September 2026
- **Status:** Implemented and verified locally (43 tests, typecheck, static build, browser check)

## Decisions

- **Zero-cost stack replaces Postgres/PostGIS/pg-boss/S3.** Collection runs on GitHub Actions. Published data is JSON in the repo. The site is a static export on GitHub Pages or Cloudflare Pages. Review happens through pull requests, and merging a PR publishes it.
- **Six pilot countries kept.** Live sources: UPSC and SSC (India), DfE Teaching Vacancies (UK), 人事院 (Japan). USAJOBS is waiting for a free key. France is live: the maintainer approved a documented robots.txt exception for the static.data.gouv.fr open-data file (registry `robotsException`, 24 Sep 2026). Brazil (DOU/INLABS) is planned.
- **3D globe kept.** It now has Natural Earth 1:10m boundaries from India's point of view and clickable admin-1 regions.
- **Light civic design.** Public Sans and Source Serif 4, plain language, no mono all-caps labels.

## Bugs fixed

1. Countdowns were computed from a hard-coded date. They now use today in the authority's timezone.
2. The default filter date used UTC. It now uses the authority's civil date.
3. Pathway and "closing this week" counts ignored the active filters.
4. Globe labels showed through the globe while it rotated.
5. A deadline range with "from" after "to" returned an empty list silently.
6. The controlled `<details>` couldn't be closed, and date inputs set their value twice.
7. Result cards had an `<h3>` inside a `<button>`. They are now proper links.
8. Clicking the brand didn't reset the view.
9. Area search used coarse boxes. Boxes are now regenerated from 1:10m polygons.
10. There were no security headers. `public/_headers` now adds CSP, nosniff, referrer policy and frame denial.
11. The 82 MB reference zip would have been published with the repo. It is now git-ignored.
12. Found during this phase:
    - A Natural Earth Antarctica ring and a degenerate Russian ring stopped every country fill from rendering.
    - Clipperton Island overwrote France's scope boxes.
    - ICU country names differed between server and browser (a hydration error).
    - Eligibility said "yes" when only the nationality rule was known.
    - Jobs past today's cut-off time still showed as open.

## Not done yet

- USAJOBS needs its secret added.
- Brazil's DOU connector hasn't been built.
- SSC, UPSC and Japan age and qualification rules live in PDFs. Reviewers add them through `data/overrides/`.
- Email alerts are not built. ICS and RSS feeds were planned as the free alternative and are next.

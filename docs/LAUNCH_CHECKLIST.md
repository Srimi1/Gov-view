# GOV View launch checklist (agent 2) — 2026-09-27

Re-verify with: `npm run typecheck && npm test && npm run build` (all exit 0).

## Security headers

- [x] CSP — per-page `<meta http-equiv="Content-Security-Policy">` with exact script
  hashes (scripts/secure-export.mjs, verified in served `/`); `frame-ancestors 'none'`
  in public/_headers.
- [x] HSTS — `Strict-Transport-Security: max-age=63072000; includeSubDomains` in
  public/_headers. Note: GitHub Pages ignores `_headers` (github.io HSTS applies);
  effective on Cloudflare/Netlify. No `preload` (reversible by header removal).
- [x] X-Content-Type-Options — `nosniff` in public/_headers.
- [x] Referrer-Policy — `strict-origin-when-cross-origin` in public/_headers.

## Build hygiene

- [x] No debug flags — `NEXT_PUBLIC_DEMO`/`DEBUG` unset at build time. `?demo=1` is a
  labeled product feature (demo banner, "Demo examples only"), not a debug flag.
- [x] No secrets in out/ — postbuild gate passed on the real export (1711 files,
  7 secret patterns + `.env` tripwire); gitleaks secret-scan runs in ci.yml.
- [x] Publication gates — build fails on unapproved/draft record, fixture, job page
  without approval, or tools/review trace (secure-export tests 10/10).

## Privacy

- [x] Privacy page matches behaviour — code-verified: profile in `window.localStorage`
  only (`govview.profile.v1`, lib/eligibility/profile.ts load/save/clear), tracker in
  localStorage, zero network calls in ProfileDialog/LocalTracker/eligibility, no profile
  keys in share URLs; page text matches. CONFIRMED by agent 5 (STATUS 2026-09-27).

## Performance

- [x] Lighthouse mobile — performance 99 (≥ 80), accessibility 95 (≥ 90), local
  static serve of out/ (`/tmp/govview-lh.json`). Re-run against the production URL
  after deploy.

## Release process

- [x] CI — ci.yml runs test + typecheck + build (+ secret scan) on every PR and main
  pushes; collect.yml stays scheduled (hourly) + manual dispatch.
- [x] Stale label, data half — agent 4 CONTRACT: `lastValidatedAt` null or strictly
  older than 7 days (fallback `lastSuccessfulFetchAt`), build-time, status "stale".
- [x] Stale label, display half — agent 5 CONFIRMED: exact label "Not rechecked
  recently" (statusLabels.stale), warn/amber, list-row status text + detail status pill,
  sourced from OpportunityStatus "stale". Full contract: data flag (agent 4) + display.
- [x] Preview dry-run — build with deploy.yml Pages env vars: exit 0, gates passed.
- [x] Rollback tested — re-publish previous build, timed 2 s (see steps below).

## Rollback steps (tested once, 2026-09-27, 2 s)

1. Identify the last good artifact (previous green Pages deployment / saved out/).
2. Re-publish it: GitHub → Actions → Deploy site → re-run the last good deployment
   (local equivalent tested: restore saved `out/`, `node scripts/secure-export.mjs`
   to re-verify gates).
3. Confirm: homepage + one job page return 200 and the bad marker is gone.
4. Test record: injected `BAD-BUILD-MARKER` into out/, restored prior tree, gate
   re-passed, marker absent — 2 s restore+verify.

## Production deploy

- [ ] Deploy ONLY after agent 1 confirms merge complete AND the human says go.

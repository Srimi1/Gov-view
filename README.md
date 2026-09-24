# GOV View

Find government jobs, recruitment exams, licences and public admissions. Check whether you can apply, then go straight to the official notice.

GOV View is free, open source, and costs nothing to run. There are no servers or databases and no paid APIs. Data comes only from official sources and reaches the site through reviewed pull requests.

## What works today

- **Real listings** collected from official sources:

  | Country | Source | Status |
  | --- | --- | --- |
  | 🇮🇳 India | UPSC active examinations | ✅ live |
  | 🇮🇳 India | SSC exam calendar | ✅ live (tentative dates until the notice is out) |
  | 🇬🇧 UK | DfE Teaching Vacancies API | ✅ live, ~6,200 vacancies, exact postcode locations |
  | 🇯🇵 Japan | 人事院 exam guides | ✅ live (dates entered by reviewers from the PDF) |
  | 🇺🇸 US | USAJOBS API | ⏸ needs a free API key (see below) |
  | 🇫🇷 France | Choisir le service public (data.gouv.fr) | ✅ live, ~12,600 offers, commune-level locations (weekly open-data file; documented robots.txt exception) |
  | 🇧🇷 Brazil | Diário Oficial da União (INLABS) | ☐ planned |
  | 🇬🇧 UK | Civil Service Jobs | ✖ bot check, no open feed |

- **Eligibility checker.** It compares your details with each notice's rules: age on the notice's cut-off date, with category, disability and ex-serviceman relaxations; qualification and final-year status; nationality, including certificate-only cases; state domicile; attempts; and experience.
  - It answers three questions separately: *can I apply*, *can I sit the exam*, and *can I be appointed*.
  - It never says "yes" unless every rule in the notice has been captured.
  - Your details stay in your browser. They are never sent anywhere and never put in links.
- **Map.** 3D globe with Natural Earth boundaries (India's official point of view) and clickable states and provinces for six countries. Venue pins come only from notices, and each is marked exact or city-level.
- **Live status.** A saved "open" record turns "closed" the moment its deadline passes, cut-off time included, in the authority's own timezone.

## How the data gets in (free)

```
sources/registry.json → GitHub Actions (hourly, free on public repos) → connectors/* → pull request → you review & merge → site redeploys
```

- `npm run collect` runs every due source. It honours robots.txt (exceptions must be approved and documented per source in `robotsException`), sends at most one request per second per host, and identifies itself honestly. It never bypasses a CAPTCHA or bot check.
- A job that disappears from its source is **never** marked cancelled. It becomes "being checked" with a note, and is dropped after 30 days.
- If a source fails twice in a row, its open records are marked "not rechecked recently".
- Reviewer corrections, such as dates from a PDF, go in `data/overrides/<id>.json` and survive every run.
- Each run's evidence (URL, time, SHA-256) is kept in `data/evidence/`.

## Run it

Use Node 26.

```bash
npm ci
npm run dev        # http://localhost:3000
npm test           # 43 tests: eligibility, dates, connectors, merge rules, share links
npm run build      # static site in out/
npm run collect -- --source in-upsc,in-ssc   # fetch live data (writes data/published/)
```

Optional environment variables are listed in `.env.example`.

## Publishing (free)

1. Push to a **public** GitHub repository.
2. Under Settings → Pages, set the source to **GitHub Actions**. The `deploy` workflow publishes on every push to `main`.
3. Under Settings → Actions → General, allow Actions to **create pull requests**, so the collector can open review PRs.
4. Optional: add the `USAJOBS_API_KEY` and `USAJOBS_EMAIL` secrets. A free key is available at https://developer.usajobs.gov/apirequest/.

Cloudflare Pages also works; it reads the security headers in `public/_headers`.

## Adding a source

Add an entry to `sources/registry.json` and write a connector in `connectors/` that returns `OpportunityCycle` records. See `connectors/upsc.ts` for a small HTML example and `connectors/teaching-vacancies.ts` for an API. Add a parser test to `connectors/connectors.test.ts`. Official sources only.

## Map data

See [public/geo/README.md](public/geo/README.md). Boundaries come from Natural Earth (public domain) and use India's point of view. City locations come from GeoNames (CC BY 4.0), UK postcodes from postcodes.io/ONS (OGL), and French communes from geo.api.gouv.fr.

## Project records

[Product specification](docs/PRODUCT_SPEC.md) · [Phase 01](phases/phase-01-2026-09-24-interactive-prototype.md) · [Phase 02](phases/phase-02-2026-09-24-real-data-eligibility.md)

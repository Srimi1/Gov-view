# GOV View — Global Career Opportunity Observatory

> **Target product specification.** This document preserves the user-provided product brief and its locked decisions. Current application implements only **Milestone 1**, an interactive internal prototype with labeled fixtures. Later milestones and public launch gates remain targets, not claims about current functionality.

> **Amendment (24 Sep 2026, Phase 02):** the project must run at zero cost. The PostgreSQL/PostGIS, pg-boss and S3 stack in section 4 is replaced by scheduled GitHub Actions connectors, JSON data reviewed through pull requests, and a static site. The review, evidence, freshness and "disappearance is not cancellation" rules are unchanged. See `phases/phase-02-2026-09-24-real-data-eligibility.md`.

## 1. Product direction

**Explore worldwide opportunities visually, understand eligibility, track changes, apply through official sources.**

Keep agreed scope: public recruitment, professional licensing, education admission, and vocational qualifications across every country, territory, and separately administered jurisdiction. Include private examinations only where officially required or accepted for these pathways.

Decisions locked:

- Fresh application with selective code reuse.
- Stylized desktop globe plus practical search and readable details.
- Mobile defaults to list; globe optional.
- Text assistant at launch; voice deferred.
- Free public browsing; optional profiles, bookmarks, and alerts.
- Founder handles initial review; workload measurements guide later staffing.
- Public launch requires audited worldwide public-source coverage. Internal development proceeds incrementally.

God’s Eye View supplies useful interaction patterns: geographic drill-down, modular layers, selected-object panels, shareable views, and explicit source freshness. Adapt these to career discovery. [Reference project](https://github.com/bilawalsidhu/gods-eye-view)

## 2. Applicant experience

### Explore workspace

Desktop layout: search and filters left, globe center, selected opportunity right. Bottom strip shows deadline filters and recent verified changes.

| Reference pattern | GOV View adaptation |
| --- | --- |
| Globe navigation | World → jurisdiction → opportunity |
| Switchable data layers | Recruitment, licensing, admission, vocational pathways |
| Selected-object panel | Eligibility, dates, fees, outcome, official evidence |
| Time controls | Application windows and upcoming deadlines |
| Feed status | Last successful check, verification status, source failures |
| Shareable scene | Public filters, camera position, selected opportunity |

Use dark navy, muted geographic boundaries, readable typography, restrained cyan highlights. Pair status colors with labels and icons. Respect reduced-motion preferences; disable automatic globe rotation.

**Geographic behavior**

- Global view shows jurisdiction totals; zoom reveals subdivisions and published venues.
- Counts represent distinct application cycles. Multiple venues never inflate opportunity totals.
- Jurisdiction shading describes hiring or regulatory scope. Venue pins indicate actual published locations.
- Online examinations get explicit labels.
- Unknown venues remain unknown; jurisdiction centers never masquerade as exam locations.
- Map and list share filters. Moving camera changes results only when “Search this area” is enabled.

**Discovery shortcuts**

“Applications open,” “Closing within 7 days,” “Recently changed,” and “Matches my profile.” Citizenship and residence filters retain visible eligibility uncertainty.

**Opportunity detail**

Show outcome, application window, official timezone, qualifications, nationality/residence rules, selection stages, fees, venue availability, source links, and last verification. Include change history and a prominent official application button.

Eligibility has three separate assessments: **can apply**, **can enter examination/selection**, **can obtain resulting job or licence**. Each returns “matches published criteria,” “does not match,” or “needs verification,” with evidence.

**My opportunities**

Saved cycles, saved searches, email/in-app alerts, and manual application progress. Default alerts cover deadline reminders, extensions, cancellations, and material eligibility changes. Email requires explicit opt-in.

**Coverage explorer**

Every jurisdiction has a page showing researched authorities, connected sources, unresolved gaps, and freshness. Display “No verified listings” separately from “Sources checked; no current opportunities found.”

## 3. Trusted data and assistant

### Collection pipeline

Official source registry → scheduled fetch → retained evidence → extraction → normalization → validation/review → published revision → alerts.

- Prefer official feeds, APIs, HTML notices, and documents. Secondary sources supply discovery leads.
- Preserve original-language evidence alongside English summaries.
- Separate authorities, source documents, recurring programmes, application cycles, venues, eligibility rules, and revisions.
- Use deterministic parsers where reliable; document extraction and translation can propose drafts.
- First output from each new connector requires review. Automated publication starts only after connector acceptance checks pass.
- Conflicting notices, uncertain translations, ambiguous eligibility, and unsupported document formats enter review queue.
- Preserve previous verified revision while clearly flagging pending material conflicts.

**Freshness policy:** feeds follow available update cadence; active application sources target hourly checks; remaining sources target daily checks, subject to permitted access. Mark overdue sources stale after two scheduled intervals. Show actual successful fetch and validation timestamps separately.

Dates retain source precision. Never invent cutoff times or infer official cancellation from disappearance of a page.

### Review workspace

Founder dashboard prioritizes imminent deadlines, cancellations, contradictory notices, and connector failures. Each review presents original evidence, extracted fields, previous version, and proposed changes. Approve, amend, or reject with recorded reason.

Source failures retain retry history and explicit coverage gaps. Measure review minutes per source and unresolved queue age before increasing collection volume.

### Text assistant

Assistant searches published records, explains selected opportunities, compares up to three cycles, and proposes visible filter changes.

- Answers cite official evidence and identify relevant application cycle.
- Deterministic eligibility rules calculate matches; assistant explains results.
- Missing evidence produces explicit uncertainty.
- Source documents remain untrusted content; embedded instructions cannot trigger actions.
- Assistant cannot publish records, submit applications, or silently change profiles.
- Pass profile information only when user requests personalized assistance.
- Search and filtering remain usable during assistant outages.

## 4. Engineering architecture and interfaces

**Default stack:** Next.js with TypeScript, React, CesiumJS, PostgreSQL/PostGIS, and separate Node.js ingestion worker using pg-boss. Store evidence in S3-compatible object storage.

Render searchable pages and opportunity details independently of globe. Load Cesium only in browser when map view opens. Use ellipsoid terrain and bundled geographic boundaries; first release requires no photorealistic imagery service. [Cesium configuration](https://cesium.com/learn/cesiumjs/ref-doc/Viewer.html), [Next.js lazy loading](https://nextjs.org/docs/app/guides/lazy-loading)

PostGIS handles geographic filtering; PostgreSQL handles text search and durable jobs. [PostGIS documentation](https://postgis.net/docs/), [pg-boss](https://github.com/timgit/pg-boss)

**Reuse boundary:** adapt viewer setup and resource-cleanup patterns from inspected God’s Eye View modules. Write GOV-specific navigation, layers, and opportunity state. Record upstream revision and retain notices for copied code. Existing standalone application has page-scoped assumptions, so avoid embedding its complete shell. [Application architecture](https://github.com/bilawalsidhu/gods-eye-view/blob/main/docs/APPLICATION.md)

**Core interfaces**

- Public read API: opportunity search, details, geographic aggregates, revisions, and jurisdiction coverage.
- Personal API: profile, saved opportunities/searches, alert preferences, application progress.
- Admin API: source registry, ingestion runs, review decisions, publication history.
- Assistant API: bounded queries over published records and eligibility results.
- Connector contract: fetch evidence, extract candidate cycles, report health and checkpoints.

Map aggregates and paginated search use identical filter semantics and published-data revision. Public share URLs contain display state only; exclude personal eligibility inputs and saved-account state.

Use managed authentication for optional accounts; enforce ownership and reviewer permissions server-side. Run collectors separately with restricted outbound access to registered sources. Keep credentials server-side.

Package web and worker as separate containers. Development uses local database, object storage, and email capture; production supplies equivalent services through configuration. Infrastructure procurement, model choice, and worldwide operating costs remain research outputs, not launch promises.

## 5. Delivery sequence and acceptance gates

**Milestone 1 — Interactive internal prototype**

Build globe/list workspace, detail panel, deadline filters, coverage states, and share links using clearly labeled fixtures. Include open, closed, extended, cancelled, stale, and uncertain examples.

**Milestone 2 — Verified collection pilot**

Validate 24 official sources across India, United States, United Kingdom, Brazil, France, and Japan. Cover all four pathways across pilot, multiple languages, national/subnational authorities, HTML, PDFs, and scanned documents. These jurisdictions test collection diversity; worldwide scope remains unchanged.

Deliver ingestion, evidence storage, review queue, revisions, and measured collection/review costs.

**Milestone 3 — Complete applicant workflows**

Connect verified records to exploration; add profiles, eligibility explanations, saved searches, alerts, and grounded assistant.

**Milestone 4 — Worldwide expansion and audit**

Complete jurisdiction inventory, reconcile discovered authorities and sources, resolve known gaps, and commission independent coverage review. Public launch stays blocked while material coverage gaps or critical conflicts remain. Publish audit method, date, denominator, and limitations.

**Required tests**

- Identical map/list results; no duplicate counts from venues or repeat notices.
- Citizenship match cannot override unmet residence, age, or qualifications.
- Deadline extensions, timezone boundaries, unknown cutoff times, cancellations, and annual editions behave correctly.
- Retries create no duplicate records or alerts; failed sources cannot imply closure.
- Shared views restore public state without leaking profile data.
- Globe failure leaves complete keyboard-accessible list and details.
- Assistant citations support claims; missing evidence and malicious source instructions cause safe abstention.
- Users cannot access another account’s profile or bookmarks; only reviewers publish revisions.
- Connector pilot evaluates at least 200 labeled notices, with zero incorrect published critical fields in acceptance set. Report missed notices separately from extraction accuracy.

Monitor source freshness, ingestion failures, review backlog, correction rate, alert delivery, assistant citation failures, and map errors. Support connector pause, publication rollback, and database restore.

**Deferred:** voice, native apps, photorealistic cities, automated applications, identity-document uploads, and historical globe replay. English interface and summaries remain launch default; original sources retain their languages.

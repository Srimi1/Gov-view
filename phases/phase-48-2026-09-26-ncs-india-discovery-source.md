# Phase 48 — NCS India-wide discovery source

Date: 2026-09-26. Saved in Gov-view folder. Source research and registry only; no applicant cycles imported.

## Official source and retained evidence

- [National Career Service classified jobs](https://ncs.gov.in/latest-update) is managed by the Directorate General of Employment, Ministry of Labour & Employment, Government of India. The page showed **145 indexed entries**, with ten rows in the initial visible page. These entries are not verified current openings or distinct application cycles.
- Retained [HTML](../data/evidence/research/ncs-classified-jobs-2026-09-26.html), [fetch evidence](../data/evidence/research/ncs-classified-jobs-2026-09-26-evidence.json), and [ten structured discovery leads](../data/evidence/research/ncs-classified-jobs-2026-09-26-leads.json). Successful fetch: 26 September 2026, 18:02:36 UTC. SHA-256: `3bbf7e38e644f32de4e37a300d9ce1f3b91c3e0dbfe5ee75ba0e79132e53350f`.
- Each visible row gives organisation, position, posting date, advertised vacancies, raw type label and notice link. Labels include JRF, Internship, Apprentice, Contract, Deputation/Absorption and ICMR Project. They are preserved as discovery labels; employer notices must establish actual appointment arrangements and whether a pathway is recruitment or vocational training.
- Eight notice links use government domains. AIIMS Jhajjar uses an institutional `.edu` domain whose identity needs separate verification. India Post link is a browser `blob:` URL, unsuitable as a durable public notice. Neither link is silently replaced with a guessed URL.

## Boundaries and next collection work

- Added registry source `in-ncs-classified-jobs`, disabled and without a connector. Initial page fetch followed the existing polite-fetch policy. `robots.txt` returned HTTP 404; retained response does not provide an explicit disallow policy.
- **135 rows remain unseen.** Permitted pagination and employer notices remain unchecked. Index posting dates are not application opening dates; vacancy counts are not cycle counts. No application deadlines, nationality rules, language levels, fees or application forms were inferred.
- NCS “International Jobs through e-migrate” is an overseas-employment navigation route. It does not prove that international applicants may apply to these India public-sector roles.
- Registry now contains **118 sources**, including **89 India sources**, across **24 of 250 jurisdictions**. Worldwide coverage audit and founder publication review remain incomplete. Public export has zero listings.

## Follow-up — 27 September

[Phase 49](phase-49-2026-09-27-ncs-complete-discovery-snapshot.md) captured all 145 rows through the visible public paginator. The unseen-row gap above describes the initial snapshot and is now resolved. Employer verification and recurring collection remain unfinished.

# Phase 19 — source-backed appointment types

Date: 2026-09-25. Saved in Gov-view folder. No founder approval or public listing.

## Work completed

- IPRC advertisement RMT 2026/01 says all 11 advertised posts are temporary. Its exact-document connector now supplies `appointmentType: temporary` for each post code. Section 13 limits applicants to Indian nationals. Exam paper languages are described, but no formal proficiency level is given. Its 11 pending drafts and founder sheets were refreshed.
- Two exact New Zealand Government Jobs notices describe permanent, full-time roles. Both drafts now carry `permanent`. One requires existing work rights; the other requires citizenship or a Permanent Resident visa. Neither gives a formal language level or official cutoff timezone.
- KVS advertisement 03/2026 offers two transfers on deputation. Both drafts now carry `deputation`; foreign-citizen permission remains unverified. The Official Language role has specified Hindi/English education alternatives, not a published CEFR level.
- California CalCareers JC-532295 says 12-month limited term. Its draft now carries `temporary`. The statewide FAQ does not establish individual work authorization. English examination guidance has no formal proficiency level.
- NIT Uttarakhand advertisement 08/2026 has four contract-only portal post choices; those drafts now carry `contract`. Eleven post choices offer mixed deputation/contract routes and retain unknown structured type. Contract route requires Indian citizenship; deputation nationality is not printed. No formal language level is published.
- Live stage runs validated the four latter sources and regenerated 20 founder sheets. All five changed sources remain disabled and review-required. Stage mode preserved public data.
- Collector now replaces exact-hash evidence bodies and metadata atomically when fetched again. This restored locally readable files after iCloud left existing files as dataless placeholders, without changing source hashes or bypassing connector checks.

## Checks and limits

- Focused IPRC and California connector tests: 4 passed. New Zealand, KVS and NIT unit tests could not load older research fixtures because iCloud returned `ETIMEDOUT`; live connector stage runs succeeded for all three, and founder sheets verified the newly retained evidence bodies.
- Typecheck and production build passed. Secure export: 1,709 files, 26.3 MiB, no detected secrets. `git diff --check` passed.
- Review queue: 62 packets, 225 draft cycles, zero approved and zero public. Worldwide coverage audit and founder review remain required before launch.
- Running production-mode prototype currently shows searchable country/list workspace and coverage pages, with zero public opportunities. Its globe is deliberately replaced by an accessible country-list fallback while the Cesium strict-CSP conflict remains unresolved.

## Next review work

Founder checks each exact notice, international application and appointment route, formal language evidence where available, and later amendments. Do not infer a type for NIT mixed routes or a language level from examination medium.

# Phase 26 — Assam PSC source access

Date: 2026-09-25. Saved in Gov-view folder. No applicant cycle staged, approved or published.

## Change

- Rechecked the [official Assam PSC advertisement register](https://apsc.nic.in/advt_2026.php) and [corrigenda register](https://apsc.nic.in/corig_2026.php). Official HTTPS pages load with system curl and normal certificate validation. Collector's existing OS trust fallback fetched the advertisement register and counted 12 rows; its `robots.txt` returned HTTP 404. No TLS verification was disabled.
- Replaced obsolete HTTP homepage and “certificate blocked” source card with direct HTTPS advertisement link and accurate remaining gaps.
- Retained exact HTML pages and hashes in `data/evidence/research/`; recorded findings in `apsc-source-access-2026-09-25.json`.

## Current evidence and limit

- Latest indexed advertisement is 12/2026, with register closing date 10 September 2026. This is not proof that no other Assam application is open. Separate portal, later amendments and other hiring authorities still need checks.
- No connector is accepted for this source. No nationality, residence, language, degree or appointment claim was extracted from an original advertisement PDF. Founder review capacity remains unmeasured, so this source check adds no review draft.

## Verification

- Collector fetched 27,523 bytes of official advertisement HTML; SHA-256 `3baea740649665d5c9e69be62966ba10b431d1e7b83c518cb82ea61d7c66ce82`. Retained home, advertisement and corrigenda pages match saved hashes.

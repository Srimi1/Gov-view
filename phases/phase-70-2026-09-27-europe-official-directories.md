# Phase 70 — Five European official recruitment directories

## Saved development

Research date: **27 September 2026**. Added disabled, review-required discovery sources for **Iceland, Estonia, Latvia, Lithuania and Poland**. Registry now contains **188 sources**, including **99 for India**, with source presence in **75 of 250 jurisdictions**. The remaining **175** have no registered source. Source presence is not audited authority coverage or a count of application cycles.

All previous 183 source entries and 70 coverage rows remain unchanged. New rows have zero connected sources, no verified listings, and null successful-fetch/validation dates. Existing display logic labels their collection as blocked or not connected. The directory warns that searchable research is not an eligibility result.

No individual cycle was extracted or published. All three eligibility stages remain **needs verification**: applying, entering selection, and obtaining the resulting job or credential. Appointment duration stays unknown until a specific notice establishes it. The five portals expand recruitment discovery; licensing, education and vocational coverage remain separate gaps.

## Official evidence and limits

| Jurisdiction | Official identity and observed guidance | Access and interpretation limits |
| --- | --- | --- |
| Iceland | [Financial Management Authority's Starfatorg page](https://island.is/en/o/the-financial-management-authority/starfatorg) identifies the government vacancy platform in its official search-indexed content. | Direct reader failed; the [Immigration Directorate referral](https://island.is/en/o/directorate-of-immigration/vacancies) returned 403. No current notice, foreign-citizen route or required language level verified. |
| Estonia | [Ministry recruitment guidance](https://www.fin.ee/riigihaldus-ja-avalik-teenistus-kinnisvara/avalik-teenistus/varbamine-ja-valik) distinguishes officials from contractual support employees and includes qualifying EU-member citizens in official recruitment. | Linked central portal timed out. Legally prescribed Estonian level needs role evidence. Contractual vacancies need not appear centrally; no complete employer coverage claimed. |
| Latvia | [NVA registration guidance](https://www.nva.gov.lv/lv/registret-vakanci) requires public institutions and majority publicly owned companies to advertise open competitions in its portal. [Public search guidance](https://www.nva.gov.lv/lv/meklet-vakances) permits browsing without registration. | Portal returned a JavaScript template. Mixed public/private employers require classification. Foreign eligibility and language thresholds remain unknown; no CV or applicant profile data collected. |
| Lithuania | [Agency statutory-service guidance](https://vva.lrv.lt/lt/aktualu-planuojantiems-grizti-gyventi-i-lietuva/) states Lithuanian citizenship and government-set Lithuanian categories. [Language verification guidance](https://vva.lrv.lt/lt/uzsienio-kalbu-tikrinimas/) places required foreign-language proof before selection assessment. | Citizenship guidance updated 13 December 2024; current consolidated law could not be read. Language guidance updated 31 August 2026. Conditional C1 credits are exemption routes, not a universal minimum. Contractual public employment needs separate research. Portal returned 403. |
| Poland | [Civil-service guidance](https://www.gov.pl/web/sluzbacywilna/praca) links the [KPRM database](https://nabory.kprm.gov.pl/) and requires all essential criteria before proceeding to the next stage. | No individual notice reviewed. Recruitment results and archived advertisements are not new application cycles. Remote selection does not imply remote employment or a published exam venue. Foreign eligibility, language and tenure remain unverified. |

The saved [research matrix](../data/discovery/europe-public-source-matrix-2026-09-27.json) records original-language URLs, reader observations, source dates where available and unresolved criteria. **No raw originals were retained or hashed.** Reader observations are not collector fetches, validation timestamps or connector acceptance. Translation and legal applicability await review. No cutoff times, official timezones, fees or venues were inferred.

## Storage audit completed as a reconciled inventory

Phase 69's second streaming process finished, exit 0. Its original snapshot read 2,353 of 2,355 files and remains marked incomplete. Both failed reads later succeeded. Separate [reconciliation](phase-69-2026-09-27-audit-reconciliation.json) confirms all current paths, sizes and modification times match their successful reads.

- Logical retained size: **871,622,022 bytes**; unchanged cap **838,860,800 bytes (800 MiB)**; excess **32,761,222 bytes (31.24 MiB)**.
- Byte-identical redundancy: **223,389,648 bytes**. Duplicate contents do not make URL receipts, histories or review provenance interchangeable.
- Text: **80,884,229 bytes**; estimated gzip size **18,846,497 bytes**. Estimates are not physical disk savings.
- **617 collector body hashes checked, zero mismatches**.
- No evidence deleted, moved, linked outside the quota or compressed in place. This phase adds zero bytes to `data/evidence`.

Storage preference remains unanswered: capped 1 GiB local pilot or researched S3-compatible migration. Neither has been applied. New collection remains paused. Worldwide expansion can continue through discovery without staging more review drafts.

## Verification

Six focused tests pass: four public source-filter tests and two metrics tests. `npm run data` exits 0 and exports **zero public records in zero countries**. Previous full suite remains Phase 69's **362 passed**, with typecheck exit 0; no application runtime code changed in this phase, so the full suite was not rerun.

Browser checks pass for all five country pages: one registered source each, no adapter, no successful fetch, and visible review warning. The screenshot shows Estonia's official source and research limits. Preservation verifier checks prior source/coverage entries plus all 83 health/review files. Queue remains **328 drafts in 82 packets**, zero approvals and zero public listings.

No production build was run. Last measured export remains **18,383 files**, above the 18,000 gate. Human review, connector acceptance, storage decision, export gate and independent worldwide audit remain unresolved. No commit, push or deployment performed.

![Estonia source research](phase-70-2026-09-27-europe-source-discovery.png)

# Phase 11: ISRO Propulsion Complex recruitment

- Date: 2026-09-25
- Status: saved locally; founder review pending; no publication or deployment

## Goal

Add an official India central-government recruitment source with distinct job applications, evidence-backed international eligibility and accurate language wording.

## Changes

- Registered disabled, review-required `in-isro-iprc-rmt-2026-01` source. Collector binds current IPRC careers block to exact 10-page advertisement and Fireman medical Annexure A by SHA-256.
- Staged 11 separate post-code applications covering 22 vacancies: three Technical Assistant disciplines, six Technician 'B' trades, Cook 'A' and Fireman 'A'. Two published written-test city options never inflate application counts.
- Recorded job type as pay-matrix posts that advertisement calls temporary but likely to continue indefinitely. Initial Mahendragiri duty station and potential ISRO transfers elsewhere in India do not become residence rules or exam venues.
- Section 13(1) limits applications to Indian nationals. Foreign citizens fail published apply criterion; matching nationality alone remains insufficient for selection or appointment.
- Post codes 60–62 offer English/Hindi written and skill-test papers; 63–68 and 70–71 offer Tamil/Hindi/English. Cook and Fireman syllabi mention General/Basic English. No formal proficiency level or certificate is printed.
- Preserved 15 September 2026 10:00 online opening, 5 October 2026 16:00 closing and unknown governing timezone. Each post requires separate fee payment. Refund depends on written-test attendance.
- Added scoped system-curl fallback after Node DNS `ENOTFOUND` on `www.iprc.gov.in`; certificate validation, robots policy, rate limits and bot-check refusal remain in force. Official host returned HTTP 404 for robots.txt, so no disallow rule was present.

## Evidence and verification

- [IPRC careers index](https://www.iprc.gov.in/careers.html); [original detailed advertisement](https://www.iprc.gov.in/files/careers/Advertisement_12092026.pdf); [Fireman Annexure A](https://www.iprc.gov.in/files/careers/AnnexureA_12092026.pdf).
- Original bytes, extracted text, hashes and source findings are in `data/evidence/research/iprc-rmt-2026-01*` and `data/extractions/iprc-rmt-2026-01.json`.
- Five focused connector/HTTP tests passed. Live collector staged 11 cycles, 0 approvals and 11 pending. Eleven founder review sheets saved.
- Aggregated queue now holds 219 draft cycles across 57 source connectors. Registry holds 85 sources in 10 countries, including 71 in India. These are research/collector counts, not verified coverage or published opportunities.
- `git diff --check` passed. `npm run build` passed TypeScript, 259 static pages and secure export (1,709 files, 26.1 MiB, per-page CSP hashes, no detected secrets). Exported India coverage includes the IPRC source and 11 pending drafts.

## Limits

- Founder must verify reservation category, exact qualifications, age relaxations, fee refund and Fireman medical conditions before approval.
- Later addenda, other IPRC/ISRO intakes and India/worldwide source completeness remain gaps.

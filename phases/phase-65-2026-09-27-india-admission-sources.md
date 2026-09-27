# Phase 65 — India admission sources and international-applicant research

Saved 27 September 2026, Asia/Kolkata. Original response receipts retain their actual UTC timestamps, which fall on 26 September. This phase adds official-source research to the existing searchable coverage directory; it does not publish application cycles or calculate applicant eligibility.

## Added sources

| Official source | Pathway and applicant findings | Remaining uncertainty |
| --- | --- | --- |
| [GATE 2027, IIT Madras](https://gate2027.iitm.ac.in/faqs) | Admission entrance; scores also accepted by some PSU recruiters. Foreign nationals can appear subject to academic criteria, with examination cities in India. [Pattern](https://gate2027.iitm.ac.in/question_paper_pattern) specifies English. | Admission and employment have separate institution/employer rules. [Foreign-registration instructions](https://gate2027.iitm.ac.in/guideline/) specifically require a foreign passport at entry, while FAQ examples accept broader photo ID; reconcile before publishing an entry assessment. No formal proficiency level verified. |
| [JAM 2027, IIT Kharagpur](https://jam.iitkgp.ac.in/faq.html) | Postgraduate admission entrance, open to foreign nationals. [Brochure v2](https://jam.iitkgp.ac.in/docs/Info_Brochure_v2.pdf), printed page 36, expressly includes foreign nationals with **Indian degrees** for admission applications, subject to institute policy. | Permission to sit the examination does not establish admission with a foreign degree. [Overview](https://jam.iitkgp.ac.in/about.html) describes English programme instruction, which does not verify exam medium or a proficiency certificate. |
| [JEE (Main), NTA](https://jeemain.nta.nic.in/information-bulletin/) | Engineering, architecture and planning admission entrance. Retained 2026 bulletin addresses foreign qualifications, foreign candidates, OCI quota provisions and 13 question-paper languages. | No universal foreign-citizen admission route inferred. Foreign nationality, OCI status and overseas education remain distinct. JEE Advanced, JoSAA, DASA and institutions need their own source research. |
| [CUET (UG), NTA](https://cuet.nta.nic.in/information-bulletin/) | Undergraduate admission entrance. Retained 2026 bulletin separates university conditions, subject choices and 13 question-paper mediums. | Foreign qualification equivalence and foreign-city references do not prove every foreign citizen can obtain admission. Exact-byte index fetch failed at robots access; PDF succeeded independently. |
| [NEET (UG), NTA](https://neet.nta.nic.in/) | Medical admission entrance. Linked 2026 bulletin explicitly permits foreign nationals to appear subject to qualifying criteria, and requires nationality documentation. Admission remains subject to government/state/institution/counselling rules. | English in qualifying education and 13 exam mediums are not a formal language level. Admission does not grant professional registration or a government appointment. Later notices must be linked to the same annual cycle. |

These five source entries all use `connector: none`, `enabled: false`, and `reviewRequired: true`. None has a fabricated venue, subdivision scope, accepted connector, structured eligibility rule, or approval. All five are classified as **admission** in the research matrix; GATE's downstream recruitment use does not create a separate job cycle.

## Dates and revisions

Retained GATE 2027 date-table HTML marks old opening and closing dates with strike-through. Current values are 2 September 2026 opening, 27 September regular close and 5 October late-fee close. Cutoff time and governing timezone were not verified and are not inferred.

JAM home and brochure v2 agree on 11 September–19 October 2026 registration. Older search references are not substituted. The FAQ contains differing application-correction statements; review must resolve them before extraction acceptance. No cutoff time is invented.

The [signed NEET notice of 15 May 2026](https://cdnbbsr.s3waas.gov.in/s37bc1ec1d9c3426357e69acd5bf320061/uploads/2026/05/20260515960654684.pdf) was visually read from retained original page 1. It sets re-examination on 21 June 2026 and separates address/city changes from application intake. The original bulletin's 3 May examination date cannot stand alone. JEE, CUET and NEET 2026 documents do not establish fresh 2027 application windows. No application alert is generated from this research.

## Evidence saved in this folder

- [Request plan](../data/discovery/india-admission-2026-09-27-requests.json): 20 requests across five sources.
- [Fetch outcomes](../data/discovery/india-admission-2026-09-27-fetch-outcomes.json): **19 retained originals**, one recorded CUET robots-fetch failure. Originals comprise 14 HTML pages and five PDFs, with exact byte sizes, hashes and actual fetch timestamps.
- [Research record](../data/discovery/india-admission-2026-09-27-research.json) and [source matrix](../data/discovery/india-admission-source-matrix-2026-09-27.json): findings, gaps and document references, explicitly awaiting review.
- Original files in `data/evidence/research/india65-*`, five separate PDF-to-text derivatives, and two page images. Four PDFs have usable text; scanned NEET re-examination notice produces only form-feed text and was checked visually. No OCR accuracy is claimed.
- [Bounded research-fetch script](phase-65-2026-09-27-fetch-research.mjs): existing collector HTTP/robots/throttle/TLS rules, exact-byte storage, serialized progress writes and explicit failure records. It resumes existing outcomes without retrying completed requests.

Official-reader discovery and exact-byte retention remain separate. The CUET index was readable through research browsing but could not be retained by the project HTTP helper. This failure remains a visible source gap; PDF success does not update scheduled collector health or validation.

## Measured state and verification

[Metrics](phase-65-2026-09-27-metrics.json): **167 registered sources**, **98 India**, seven Japan and five US. Worldwide source presence remains **56/250 jurisdictions**, with **194 lacking sources**. The queue remains **328 drafts in 82 pending packets**, with zero measured human decisions, zero approved records and zero public listings. Stored collected records remain 18,760, a separate denominator.

[Verification](phase-65-2026-09-27-verification.json) compares the saved [baseline](phase-65-2026-09-27-baseline.json): all 162 pre-existing registry entries, all 55 non-India coverage records, source health and all 82 review packets are unchanged. India keeps its 42 successful-fetch-history sources, original health/count fields, and actual collector timestamps; only five researched authorities and five gaps are appended. All 19 retained response hashes and sizes match their files. No collection job ran or founder decision was entered.

The public-data build passed with **zero records across zero countries**. Both existing metrics tests passed, with [test output saved](phase-65-2026-09-27-test-results.txt). Browser reload rendered 98 India source cards including all five additions. Search for “Joint Admission Test” showed one result with the exam/admission distinction and awaiting-review label; [browser receipt](phase-65-2026-09-27-browser-checks.json) and [screenshot](phase-65-2026-09-27-admission-directory.png) are saved. No app code changed; this phase does not claim a new full-suite, typecheck or production-build run. Phase 64's full 354-test and typecheck receipts remain available.

Worldwide authority coverage, all India state/UT pathways, cycle-specific criteria, founder connector acceptance and independent coverage audit remain incomplete. Existing export still has 18,383 files against the 18,000-file project limit. No deployment or waiver occurred. Goal remains active.

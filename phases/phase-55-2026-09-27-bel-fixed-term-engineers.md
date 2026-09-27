# Phase 55 — BEL fixed-term engineer recruitment and international-applicant evidence

Date: 27 September 2026 (Asia/Kolkata). Internal collection and draft review only. One official employer source added; two distinct application cycles staged. No approval or public listing created.

## Official source and evidence

[Bharat Electronics Limited job notifications](https://bel-india.in/job-notifications/) is the employer's primary register. Original notices identify BEL as a Government of India enterprise under the Ministry of Defence. New registry ID is `in-bel-september-engineers-2026`, with hourly target cadence, first-output review required and automatic collection disabled pending acceptance.

All **11 public index pages** were fetched through the existing polite collector, following the observed `page_num` navigation parameter. Source JavaScript was read as data and never executed. The pages contain **84 cards**, including old calls, withdrawals, cancellations and other notices. They are not counted as 84 open application cycles. Two exact September advertisements and their original PDF bytes are bound to the connector; other cards and attachments remain collection gaps.

[Research manifest](../data/discovery/bel-september-engineers-2026-09-27-research.json) records original URLs, fetch timestamps, byte sizes and SHA-256 hashes for 11 HTML responses and two PDFs. Original PDFs, extracted text and visual page checks are saved under `data/evidence/research/`. Text extraction aids review; original bytes are the retained authority evidence. September calls are not merged with NCS's April/May/July discovery leads: the April Senior Assistant Engineer lead says 41 regular posts, while this September notice offers 36 fixed-tenure posts.

## Two cycles, 48 posts

| Draft cycle | Arrangement and count | International-applicant evidence | Application date |
| --- | --- | --- | --- |
| Ghaziabad Senior Assistant Engineer E-I; 12949/HR/GAD/NCS/2026/02 | Fixed tenure; 33 Electronics plus 3 Electrical posts. One candidate application. | Indian Air Force JWO or above, 15 years of service, 100% ex-servicemen. Explicit citizenship permission is unstated; service history is not converted into a nationality whitelist. | Postal/courier receipt by 16 October 2026. Opening date, cutoff hour and official timezone unknown. |
| Bengaluru Senior Engineer E-III; BGEM/2627/09/01 | Five-year fixed term, extendable by two. 12 posts across three mutually exclusive job codes; one selected code per applicant. | Original notice explicitly permits only Indian nationals. Foreign citizenship, including OCI without Indian citizenship, does not satisfy this rule. | Online registration 9–29 September 2026. Cutoff hour and official timezone unknown. |

Ghaziabad's [original notice and Annexure 1](https://bel-india.in/wp-content/uploads/2026/09/Detailed-Advertisement-1.pdf) requires a completed three-year Electronics/Electrical diploma or equivalent. The prescribed form and supporting documents must reach BEL by registered post, speed post or courier; hand delivery is rejected. PAN-India project posting remains a work-location fact, not an examination venue or applicant domicile condition.

Bengaluru's [original notice](https://bel-india.in/wp-content/uploads/2026/09/Senior-Engineer-Fixed-Term-Engineer-Detailed-Job-Description-Export-Manufacturing-SBU.pdf) requires the specified completed full-time engineering degree, marks, and at least four years of qualifying post-degree industrial experience by 1 August 2026. Academic, teaching, research, apprenticeship, pre-degree and other excluded experience cannot be accepted through a generic experience-years profile field. Domain skills and the Database Administrator route's Microsoft SQL certification remain manual checks. Applications use the officially linked [jobapply portal](https://jobapply.in/BEL2026JALAHALLIEXPORT); no account, payment or application was submitted. General/EWS/OBC fee is ₹472; SC/ST/PwD/ex-servicemen are exempt.

## Conflicts and missing conditions

Ghaziabad's original table says IAF retirement **on or before 1 August 2026**. Section 5 says **31 July** in Hindi and **1 July** in English. Another clause accepts currently serving candidates with probable discharge within three months of the advertisement. All readings are retained; none is silently selected. Current draft status is **uncertain** until authority clarification. Body describes up to 15 years, renewable every five years or superannuation at 60; form title describes five-year fixed tenure. Initial appointment terms need confirmation.

Ghaziabad notice is bilingual English/Hindi. Bengaluru's nine-page retained notice body is English, although condition 27 claims bilingual availability; no Hindi counterpart was identified or retained. Both calls leave standardized human-language proficiency unspecified. English interpretation clauses, languages-known form fields and software languages such as Python, SQL or Java do not establish CEFR/JLPT requirements.

Age limits and printed relaxations are described but not automatically applied: government-rule ex-serviceman/PwBD exceptions are not fully quantified. Generic education thresholds can reject clearly insufficient education but cannot establish branch equivalence, marks, completion evidence or military/industrial experience. Indian citizenship cannot override unmet education or other criteria. Passing captured rules still returns **needs verification**.

Bengaluru publishes written-test city as Bengaluru only; exact centre and interview venue are unknown. Both cycles retain textual work locations and unknown venue entries, with no fabricated map pins. Ghaziabad does not state a fee amount. Neither notice prints an official deadline timezone or cutoff time; date precision is preserved, and boundary-day status remains uncertain.

## Connector safeguards and verification

[Connector](../connectors/bel-september-engineers-2026.ts) reads every bound index page, including undated cancellation/withdrawal cards. Normalized card contents, links, pagination contract and page-specific pager sequences must match retained extraction metadata. Selected cards must appear exactly once with their original deadline and PDF link. Original PDF signature, byte count, URL and SHA-256 must match before critical fields are emitted. Changed pages, added amendments, redirects or replacement documents stop extraction for review. Disappearance is never interpreted as cancellation.

Five focused tests passed: four BEL cases and the existing lazy connector-loading check. Tests cover 84-card parsing, two-cycle counts despite 48 posts, nationality/OCI exclusions, unknown Ghaziabad nationality, inadequate education, unresolved retirement dates, unknown zones, postal receipt semantics, annual editions, venue handling and evidence-change rejection. Typecheck passed. Live staging succeeded and retained 13 responses; founder sheets bind exact candidate/evidence revisions and create no decision.

- [Ghaziabad founder worksheet](../data/review/sheets/bel-ghaziabad-sr-assistant-engineer-2026-02.md)
- [Bengaluru founder worksheet](../data/review/sheets/bel-bengaluru-senior-engineer-2026-09-01.md)
- [Pending packet](../data/review/in-bel-september-engineers-2026.json)
- [Measured state](phase-55-2026-09-27-metrics.json)

Staging updates source health and coverage fetch timestamps/pending counts; applicant records remain unpublished and validation timestamps remain null. Measured totals: **131 registered sources**, **92 India hiring sources**, **32 of 250 jurisdictions**, **328 draft cycles across 82 pending packets**, **0 approved/public records**. The separately stored 18,760 collected records are a different denominator. Review minutes remain unmeasured. Worldwide inventory, collection expansion, founder acceptance and independent coverage audit remain unfinished; public launch remains gated. Existing iCloud duplicate export files and the export file-count gate are unchanged limitations.

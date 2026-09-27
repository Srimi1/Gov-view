# Phase 58 — India source inventory and State Bank of India

Date: 27 September 2026 (Asia/Kolkata). Internal development. Added one official bank source and saved a subdivision coverage inventory; no cycles or review decisions were added.

## India inventory

[Readable inventory](../data/discovery/india-subdivision-source-audit-2026-09-27.md) and [JSON snapshot](../data/discovery/india-subdivision-source-audit-2026-09-27.json) bind all **36 local state/UT boundary codes**, registry entries, source health and review-packet fingerprints. All codes have designated PSC/administration entries; **27 have adapters, 9 do not**. None of the 72 distinct subdivision-tagged sources is enabled. Approved India cycles remain **0**.

The nine primary entries without adapters are Haryana, Himachal Pradesh, Ladakh, Lakshadweep, Madhya Pradesh, Maharashtra, Puducherry, Punjab and Telangana. Some have separate departmental adapters, which do not establish completeness for the PSC/administration. Existing restrictions include disallowed document/API paths, legacy TLS, inaccessible robots policies, session-dependent notice registers and unresolved dates. A permitted feed, stable official endpoint or founder-reviewed evidence is needed for each particular gap.

Twenty-two primary entries have pending packets with document-level fetch timestamps but no source-health row. Their health is **unknown**, not evidence-free. Reconcile these through the normal collector/review process after evidence verification; do not invent successful scheduled checks from old packet timestamps.

Subdivision tags also occur on central institutes and suggested work locations. They cannot replace state appointing-authority coverage. Overlapping region counts must not be summed into India totals. Recruitment inventory does not establish coverage of licensing, admission or vocational pathways. No independent coverage audit was performed. The current [National Portal state/UT route](https://www.india.gov.in/explore-india/facts-of-india/states-ut-districts) exposes no state list to the reader, so the denominator is explicitly the checked local boundary inventory.

## Official SBI source

Registered `in-sbi-careers`, following the observed link from [SBI careers homepage](https://sbi.bank.in/en/web/careers) to [Current Openings](https://sbi.bank.in/web/careers/current-openings). This is public-sector bank recruitment, with regular and contract appointments distinguished. The register also contains closed applications, call letters and results; its title does not make every row an open application cycle.

Retained two HTML responses and three original English PDFs through the existing polite collector. Every response has an actual fetch timestamp, SHA-256 and byte count. PDF text derivatives are saved; the IT Risk reservation table was rendered and visually inspected. [Research manifest](../data/discovery/sbi-2026-09-27-research.json) records exact URLs and limits.

- **IT Risk, SCO 22:** Indian-citizen applications, 16 September–6 October 2026. Two exclusive role choices, four provisional vacancies; horizontal PwBD reservation adds no extra posts. Contract term is three years, extendable up to two subject to review. No formal human-language level found. Suggested Mumbai/Navi Mumbai posting is not an examination venue. [Original notice](https://sbi.bank.in/documents/77530/57941334/16092026_ADV_CRPD_SCO_2026_27_22.pdf/6285a84d-5171-c301-5817-fe41b4a83cad?t=1789538056721).
- **Trade Finance, SCO 15:** Indian-citizen recruitment on regular basis. Both grade choices may be applied for. Original PDF ends filing on 19 September; the retained official register explicitly **extends it to 28 September 2026**. Preserve the original and extension evidence as successive notices, not duplicate cycles. Mandatory IIBF certification and preferred credentials require separate review. [Original notice](https://sbi.bank.in/documents/77530/57941334/29082026_FINAL%2BADVT%2BTFO%2BIBG_SCO%2B15.pdf/222db64b-91da-cbe8-c439-9af6b1dd06b2?t=1787986916149).
- **Junior Associate 17:** Indian citizens; filing closed 31 August. One state/UT choice and local-language reading, writing, speaking and understanding requirements. Test follows the main examination and precedes joining; qualifying Class 10/12 study evidence may exempt testing. Exam medium is separate from local-language proficiency. No CEFR conversion or reopening from call-letter availability. [Original notice](https://sbi.bank.in/webfiles/uploads/files_2627/08/JA_2026_Detailed_Advt_Eng.pdf).

Foreign citizens who do not possess the required Indian citizenship fail that published condition for these notices. This is not a bank-wide rule for every programme. Cutoff hours/timezones, linked Hindi originals, category exceptions, precise qualifications, application form conditions and later amendments still require review. No account, profile, application or submission was created.

The source is disabled, review-required and `connector: "none"`. Research does not update scheduled source-health or validation. India coverage gains the researched authority and explicit gap; prior connected count, fetch/validation timestamps and other country records retain their values.

## Checks and measured state

Three existing tests passed: lazy connector selection and two metrics checks. Five retained responses passed SHA-256/byte validation; The new SBI ID and homepage have no duplicate registry entry. Inventory assertions checked all 36 codes, designated primary entries, disabled state, packet fingerprints and approval filtering. `npm run data` produced **0 public records**. `git diff --check` passed.

[Saved metrics](phase-58-2026-09-27-metrics.json): **142 sources**, **93 India sources**, across **40 of 250 jurisdictions**. Review queue stays **328 drafts / 82 packets**, with **0 measured decisions** and **0 approved/public records**. The 18,760 stored collected records are a separate denominator. Existing export still exceeds its file-count limit; no deployment was attempted.

Founder review request for the saved Bengaluru BEL worksheet remains unanswered. No approval, reviewer identity or minutes are inferred. Next work: reconcile India primary-source gaps, measure and complete founder reviews, validate connectors and multilingual notices, then expand the worldwide authority inventory. Worldwide coverage and the labelled critical-field audit remain launch gates.

# Phase 33 — Railway Recruitment Boards Section Controller source

Date: 2026-09-25. Saved in Gov-view folder. One pending draft; no founder approval or public listing.

## Source and extraction

- Reused existing `in-rrb-railways` registry entry. [RRB Secunderabad's official archive](https://rrbsecunderabad.gov.in/notices/) still links [CEN 03/2026 Section Controller](https://rrbsecunderabad.gov.in/wp-content/uploads/2026/07/FINAL-CEN-03_2026_SECTION-CONTROLLER.pdf) and [Corrigendum 1](https://rrbsecunderabad.gov.in/wp-content/uploads/2026/07/Corrigendun-1-CEN-03_2026.pdf). Original HTML and both PDFs are retained under `data/evidence/research/`; exact PDF hashes and visible archive links gate extraction. The parser ignores duplicate links inside archived HTML comments.
- One **national application cycle** offered 119 provisional Section Controller vacancies across RRBs. Applicants selected one RRB and zone preferences. Applications ran 15 July–14 August 2026, closing at printed 23:59 without a named timezone. Fee payment, corrections and scribe-information dates are later separate steps, not application extensions. Corrigendum 1 changes RRB Bhubaneswar's zone label ECR to ECoR; it does not change application dates.
- CEN paragraph 7.1 accepts Indian citizens; Nepal or Bhutan subjects with a Government of India eligibility certificate; and Indian-origin migrants from named countries who intend permanent settlement, also with a certificate. Paragraph 7.2 permits provisional examination admission when certificate is needed, but requires certificate at document verification. A passport country alone cannot establish the migrant route. Eligibility rules therefore mark Nepal/Bhutan conditional and all other foreign passports as needing individual review; citizenship never overrides unmet qualifications or later requirements.
- CEN requires a completed university degree or equivalent; candidates awaiting final results may not apply. Normal-course age 20–33 on 1 July 2026 has several category/service relaxations, left for manual checking to avoid false exclusion. CBT is available in English, Hindi and 13 regional languages, but its reading-comprehension passages are English. CBAT is English or Hindi. No CEFR or standardized language level is printed. Three official CBT syllabus subject groups are recorded as pending founder review, with page citations.
- Neither exam venue nor work posting is inferred from RRB/zone names. Application is closed. Appointment term is not asserted.

## Verification and limits

- Live `npm run collect -- --source in-rrb-railways --stage`: **1 collected, 0 approved, 1 pending, 0 kept publicly**. Founder worksheet: `data/review/sheets/rrb-cen-03-2026-section-controller.md`.
- Connector and eligibility tests passed after adding wildcard uncertainty for nationality routes that cannot be decided from a passport alone. TypeScript check passed.
- New unified RRB portal rejects current exact notices for this collector. Archived CEN 03/2026 does not establish current CEN 05/2026 details or later updates. No wider railway coverage claim is made. Pending queue now has 268 drafts from 69 sources, with zero approved/public records.

## Founder review before approval

- Confirm exact notice, corrigendum, all later amendments, CEN language choices, syllabus and deadline timezone against official sources.
- Review all conditional nationality certificate routes, applicant age relaxations, recognized degree, A-2 medical/vision rules, fee and refunds, and portal behavior. Record any later assigned test venue separately from RRB or railway-zone scope.

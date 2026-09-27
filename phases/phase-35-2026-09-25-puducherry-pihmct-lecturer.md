# Phase 35 — Puducherry PIHMCT Assistant Lecturer source

Date: 2026-09-25. Saved in Gov-view folder. One pending application cycle, three contract positions; no founder approval or public listing.

## Source and extraction

- [PIHMCT's official notice board](https://pihmct.py.gov.in/notice-board) links its [Assistant Lecturer detail](https://pihmct.py.gov.in/applications-invited-03-posts-assistant-lecturer-contractual-basis) and [six-page original PDF and application form](https://pihmct.py.gov.in/sites/default/files/recruitment-notice-assistant-lecturer-contract.pdf). All three were fetched under the project's robots and TLS policy and retained as original evidence. Exact board item, detail link and PDF SHA-256 gate extraction.
- One application covers three Assistant Lecturer contract positions. Consolidated pay is ₹35,000/month. Applications and supporting documents must reach the Principal in Murungapakkam by **25 October 2026**. No receipt clock time, named official timezone, application opening date, contract duration, selection venue or final work posting is printed. Murungapakkam is an application-delivery address, not an exam venue. The notice does not restrict delivery to post, so the draft does not assert a postal-only method.
- Category A and B contain different qualification and experience routes, normally with NHTET; a qualifying Hospitality PhD can remove that requirement. General-category maximum age is 35 on 1 July 2026, with unspecified category relaxations. These alternatives remain manual checks rather than a false deterministic eligibility pass.
- The form asks nationality and the notice accepts certain recognized foreign qualifications, but neither fact establishes permission for **foreign citizens** to apply, take selection, or obtain the contract. All three eligibility stages need verification. No formal language level is stated.

## Verification and limits

- Live `npm run collect -- --source in-py-pihmct-lecturer-2026 --stage`: **1 collected, 0 approved, 1 pending, 0 kept publicly**. Founder sheet: `data/review/sheets/pihmct-assistant-lecturer-2026.md`. Source remains disabled for scheduled collection pending connector acceptance.
- Connector tests cover source-link and PDF drift, one-cycle count, international eligibility uncertainty, unknown language and venue, and date-only closing behavior: **2 passed**. Full TypeScript check passed. Public export remains **0 records**.
- This exact notice does not resolve Puducherry's other government recruitment access gap or the CGL portal/notice deadline contradiction. Worldwide coverage audit and founder decision remain open. Current queue: **269 pending cycles in 70 packets**, zero approved/public records.

## Founder review before approval

- Confirm later amendments, exact receipt hours and allowed delivery routes with PIHMCT; review category A/B equivalence, NHTET/PhD route, age relaxations, skill test and contract conditions.
- Ask PIHMCT whether foreign citizens can apply, enter selection and accept appointment; do not infer that from foreign-degree recognition. Confirm any required language ability and work permission separately.

# Phase 42 — UPPSC current applications and eligibility uncertainty

Date: 2026-09-25. Saved in Gov-view folder. Two Uttar Pradesh applications re-staged for founder review; zero public listings.

## Official source

- The [UPPSC notification table](https://uppsc.up.nic.in/CandidatePages/Notifications.aspx) lists `D-6/E-1/2025` reopened 21 September to 21 October 2026, and `D-2/E-1/2026` 14 September to 14 October 2026. Fee, reconciliation and modification dates are separate fields.
- The [UPPSC homepage](https://uppsc.up.nic.in/) identifies the current roles as Inspector of Drugs (`S-06/04`, reopened) and Deputy Secretary (I.T.). Advertisement years do not create extra cycles.
- Both official “View Advertisement” links redirected to the UPPSC homepage during research. Exact notice qualifications, appointment terms, nationality, residence, language and amendments remain unresolved. The source registry now exposes this access gap.

## Data changes

- `connectors/uppsc.ts` uses date precision, no invented official timezone or cutoff clock time, and an uncertain status on the closing date. It labels direct recruitment and online application method without asserting permanent employment.
- Both drafts explicitly say international eligibility and language level need the exact notice. Manual checks cover applying, selection and appointment. A US nationality profile returns `needs-verification` for applying and obtaining the job.
- `npm run collect -- --source in-up-recruitment --stage` returned **2 collected, 0 approved, 2 pending, 0 public**. Retained HTML evidence and exact revisions are in `data/evidence/in-up-recruitment.json` and `data/review/in-up-recruitment.json`. [Inspector of Drugs sheet](../data/review/sheets/uppsc-d-6-e-1-2025-s-06-04.md) and [Deputy Secretary sheet](../data/review/sheets/uppsc-d-2-e-1-2026.md) await founder decision.

## Verification and remaining gaps

- Focused state-notice tests: **6 passed**. TypeScript check and `git diff --check` passed. `npm run data` produced **0 public records**.
- Lakshadweep's [official recruitment index](https://lakshadweep.gov.in/notice_category/recruitment/) currently lists a Veterinary Assistant Surgeon application, but the linked notice host's robots policy disallows automated PDF requests. Existing [manual access record](../data/evidence/research/lakshadweep-2026-access-gap.json) remains the source of truth; no connector or public listing was claimed for that notice.
- Founder needs exact UPPSC advertisements or an allowed official document endpoint before either draft can pass eligibility review. Other UPPSC posts and Uttar Pradesh authorities remain gaps.

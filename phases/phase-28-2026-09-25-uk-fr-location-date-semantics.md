# Phase 28 — UK and France source semantics

Date: 2026-09-25. Saved in Gov-view folder. No founder approval or public listing.

## Change

- Added separate `workLocations` field to cycles and details. Changes to it invalidate approval. Selection venues remain independent and unknown unless an official notice publishes them.
- DfE Teaching Vacancies now stores school addresses as work locations and uses resolved postcodes only for hiring-scope regions. Its listing `datePosted` stays in a note, not an application opening date. Generic QTS, residence, selection-stage and fee claims were removed from API-only drafts. International eligibility remains uncertain pending each advert.
- French Choisir le service public now stores `Lieu d'affectation` as work location and no longer geocodes it into an exam pin. CSV `Date de début/fin de publication par défaut` are publication dates, not application dates; drafts therefore have unknown application window and uncertain status. Raw `Langues` and `Niveaux` labels are shown without treating them as mandatory or converting them into CEFR. Generic nationality, residence, selection and fee claims were removed.
- Registry marks both adapters review-required. Demo US duty station now follows same work-versus-selection distinction.

## Evidence and limits

- [DfE terms](https://teaching-vacancies.service.gov.uk/pages/terms-and-conditions) describe school job listings and note an advert can close early. [DfE job-advert guidance](https://teaching-vacancies.service.gov.uk/get-help-hiring/how-to-create-job-listings-and-accept-applications/creating-the-perfect-teacher-job-advert) distinguishes school address from interview details.
- [French official offer](https://choisirleservicepublic.gouv.fr/offre-emploi/2026-2370496/) labels assignment/work location separately. [Candidate guide](https://choisirleservicepublic.gouv.fr/wp-content/uploads/2024/10/Guide-candidats.pdf) describes offer-specific application details. [Concours nationality guidance](https://www.fonction-publique.gouv.fr/devenir-agent-public/les-conditions-generales-dacces-aux-concours) shows nationality conditions vary by route.
- Official French CSV header and a one-megabyte range sample were inspected. Sample had `Langues` and `Niveaux` fields such as `Français` / `Autonome`; these are source labels, not established CEFR levels or mandatory rules.
- Older retained UK/French collected records (6,175 and 12,581 respectively) still contain prior extraction. They have zero approvals, so `selectPublicRecords` excludes all from public exports. Recollection and full-advert checks are needed before any approval; no mass rewrite of retained source-derived drafts was performed.

## Verification

- Full suite: 309 passed, 0 failed. TypeScript check passed. Static build completed: 1,711 exported files, 26.3 MiB, per-page CSP hashes, no detected secrets. Approval hash remains stable for existing records without `workLocations`; adding or changing a work location requires fresh review.
- Rebuilt demo inspected in local browser: sample US duty station appears under Work location; selection venue says Not announced yet; globe has no duty-station pin. Normal workspace still shows zero approved listings.
- Latest metrics: 18,760 collected records, zero approved/public; 240 pending cycles in 65 packets; 250 jurisdictions, 240 unresearched.

## Next review

- Sample both feeds against full individual adverts, especially application deadlines, sponsorship, nationality, selection method, language status and any examination venue. Reject or amend before founder approval.

# Phase 52 — Eight European official recruitment entry points

Date: 27 September 2026 (Asia/Kolkata). Research response timestamps retain their actual UTC values, including 26 September UTC. Internal source discovery; no applicant cycle or publication approval added.

## What changed

Added eight official-source entries to [source registry](../sources/registry.json), each disabled, review-required and `connector: "none"`. Added matching country coverage records with researched authority and unresolved gaps; connector fetch and validation timestamps remain null and connected-source counts remain zero. Research snapshots do not establish recurring connector health or current application coverage.

| Jurisdiction | Official entry point | Retained findings and scope |
| --- | --- | --- |
| Ireland | [publicjobs](https://www.publicjobs.ie/en/) | Homepage and its linked public Tal.net board retained. [Government identity page](https://www.gov.ie/en/publicjobs/) confirms public-service role, but collector robots request failed. Board mixes publicjobs, external recruiters, State Boards and jobs outside Ireland. Verify employer, jurisdiction, application identity and original booklet before extracting cycles. |
| Netherlands | [Werken voor Nederland](https://www.werkenvoornederland.nl/vacatures?type=vacature) | Search HTML and [Rijksoverheid referral](https://www.rijksoverheid.nl/service/vacatures) retained. National government scope; no job rows extracted. Municipal, provincial and separately administered Caribbean authorities remain separate gaps. |
| Finland | [Valtiolle](https://valtiolle.fi/en/latest-jobs/) | State recruitment search HTML retained, including client configuration. No job rows extracted. Validate Finnish, Swedish and English notice coverage; English view cannot represent all notices. Other public employers and Åland remain separate research gaps. |
| Norway | [Jobs in ministries](https://www.regjeringen.no/no/aktuelt/jobb-i-departementene/id3087969/) | Official government career entry links ministry recruitment through Jobbnorge. Collector stopped because government robots.txt returned HTTP 403. No vacancy HTML retained and no current-job claims based on older cached lists. Ministry scope does not cover all state, county or municipal employers or separately administered areas. |
| Portugal | [Bolsa de Emprego Público](https://www.bep.gov.pt/default.aspx) | Government exchange identified through official domain and [candidate guide](https://www.bep.gov.pt/docs/Guia_do_candidato_PRR_DGAEP.pdf). Browser redirected to SGU authentication; collector robots fetch failed. Neither authentication nor robots checks bypassed. No vacancy data retained. |
| Switzerland | [Federal jobs portal](https://jobs.admin.ch/?lang=en) | Official HTML retained as JavaScript shell, with no job records. Canton and commune coverage remains separate. Original notice languages and permitted search/detail collection need validation. |
| Austria | [Federal Jobbörse search](https://bund.jobboerse.gv.at/sap/bc/jobs/) | [Government employment guidance](https://www.jobboerse.gv.at/arbeiten-im-bund/) and its linked SAP search shell retained. No vacancy data extracted. Public and internal-only openings must be distinguished; Länder and municipal employers remain separate. |
| Sweden | [Arbetsgivarverket jobs](https://www.arbetsgivarverket.se/om-oss/jobba-hos-oss/lediga-jobb) | Own-agency government page retained. Scope is one agency, not Sweden-wide recruitment. External recruiter links need notice-level employing-authority and employment-arrangement checks before classification. Other state, regional and municipal authorities remain gaps. |

For all eight sources, job/appointment kind, international-applicant eligibility, nationality/residence restrictions, qualifications, dates, fees and language levels remain unverified until original notices are extracted and reviewed. An interface language does not establish a mandatory proficiency level. A recruitment provider does not by itself establish a government employer. Result totals are not verified application-cycle counts.

## Evidence and access

[Research manifest](../data/discovery/europe-official-portals-2026-09-27.json) records each registry ID, verified official entry point, identity reference, retained artifact path, original response metadata and unresolved scope. Nine retained HTML responses passed SHA-256 and byte-count checks against saved fetch metadata. Three failed attempts remain explicit failure artifacts: Norway government robots HTTP 403, Portugal robots fetch failure and Ireland government-reference robots HTTP 403. Ireland's publicjobs homepage and job board were retained successfully despite the separate reference-page access failure.

HTML, fetch metadata and failures remain in `data/evidence/research/`. Government redirects or unavailable pages do not imply no vacancies, cancellation or permission for international applicants. No source was activated; no notice entered applicant search or map counts.

## Verification and measured state

- Registry validation: unique IDs; all jurisdiction codes belong to existing 250-jurisdiction inventory; eight new entries disabled and review-required with no connector.
- All nine saved response hashes and byte counts verified. Three failures retained separately from successful research responses.
- Existing connector startup-isolation test passed, including registered connector dispatch validation.
- Metrics tests and coverage assertions passed. Each new coverage record reports zero connected sources, null successful-fetch/validation timestamps and explicit unresolved gaps. No empty-current-opportunities conclusion is recorded.
- `npm run data` passed: public export remains **0 records across 0 countries**. `git diff --check` passed.

[Saved metrics](phase-52-2026-09-27-metrics.json): **128 registered sources**, **91 India sources**, **32 of 250 jurisdictions with registered sources**, **218 jurisdictions without registered sources**, **325 draft cycles in 80 pending packets**, **0 measured review decisions**, **0 approved/public records**. The 18,760 stored records use a separate denominator. Registration is not an audited completeness measure. Existing generated `out/` still exceeds the file-count gate; no launch readiness is claimed.

## Next collection work

Implement permitted notice-level adapters, validate official employers and jurisdictions, retain original evidence and amendments, extract source-backed job types and international/language rules, then submit first outputs for founder review. Expand India, Japan and US notices alongside remaining worldwide authority discovery. Source acceptance sets, missed-notice reporting, review-time measurement and independent worldwide coverage audit remain unfinished.

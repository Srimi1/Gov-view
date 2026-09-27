# India state and union-territory source inventory

Snapshot: 27 September 2026. Internal inventory; independent coverage audit not performed.

Local boundary denominator: **36** subdivisions. **27** designated PSC/administration entries have adapters; **9** do not. All subdivision-tagged sources are disabled. Approved India cycles: **0**.

Primary means the existing `in-xx-recruitment` PSC/administration entry, not every authority in that state. Other adapters can cover limited departmental notices while primary entry remains unresolved.

| State/UT | Primary adapter | Primary pending drafts | Other tagged sources | Approved cycles |
| --- | --- | ---: | ---: | ---: |
| Andaman and Nicobar Islands (IN-AN) | Present; disabled | 1 | 0 | 0 |
| Andhra Pradesh (IN-AP) | Present; disabled | 1 | 0 | 0 |
| Arunachal Pradesh (IN-AR) | Present; disabled | 1 | 0 | 0 |
| Assam (IN-AS) | Present; disabled | 1 | 3 | 0 |
| Bihar (IN-BR) | Present; disabled | 1 | 2 | 0 |
| Chandigarh (IN-CH) | Present; disabled | 1 | 0 | 0 |
| Chhattisgarh (IN-CT) | Present; disabled | 2 | 0 | 0 |
| Dadra and Nagar Haveli and Daman and Diu (IN-DH) | Present; disabled | 3 | 0 | 0 |
| Delhi (IN-DL) | Present; disabled | 25 | 1 | 0 |
| Goa (IN-GA) | Present; disabled | 7 | 2 | 0 |
| Gujarat (IN-GJ) | Present; disabled | 2 | 0 | 0 |
| Haryana (IN-HR) | Absent | 0 | 1 | 0 |
| Himachal Pradesh (IN-HP) | Absent | 0 | 3 | 0 |
| Jammu and Kashmir (IN-JK) | Present; disabled | 1 | 1 | 0 |
| Jharkhand (IN-JH) | Present; disabled | 1 | 1 | 0 |
| Karnataka (IN-KA) | Present; disabled | 1 | 3 | 0 |
| Kerala (IN-KL) | Present; disabled | 21 | 0 | 0 |
| Ladakh (IN-LA) | Absent | 0 | 2 | 0 |
| Lakshadweep (IN-LD) | Absent | 0 | 0 | 0 |
| Madhya Pradesh (IN-MP) | Absent | 0 | 1 | 0 |
| Maharashtra (IN-MH) | Absent | 0 | 3 | 0 |
| Manipur (IN-MN) | Present; disabled | 1 | 0 | 0 |
| Meghalaya (IN-ML) | Present; disabled | 2 | 0 | 0 |
| Mizoram (IN-MZ) | Present; disabled | 2 | 1 | 0 |
| Nagaland (IN-NL) | Present; disabled | 1 | 0 | 0 |
| Odisha (IN-OR) | Present; disabled | 1 | 2 | 0 |
| Puducherry (IN-PY) | Absent | 0 | 2 | 0 |
| Punjab (IN-PB) | Absent | 0 | 2 | 0 |
| Rajasthan (IN-RJ) | Present; disabled | 13 | 0 | 0 |
| Sikkim (IN-SK) | Present; disabled | 1 | 0 | 0 |
| Tamil Nadu (IN-TN) | Present; disabled | 4 | 0 | 0 |
| Telangana (IN-TG) | Absent | 0 | 4 | 0 |
| Tripura (IN-TR) | Present; disabled | 3 | 0 | 0 |
| Uttar Pradesh (IN-UP) | Present; disabled | 2 | 0 | 0 |
| Uttarakhand (IN-UT) | Present; disabled | 1 | 2 | 0 |
| West Bengal (IN-WB) | Present; disabled | 1 | 1 | 0 |

## Primary-entry gaps

- **Haryana** — HPSC robots.txt ends with User-agent: * / Disallow: /, blocking automated collection of the archive and PDFs. Manual research evidence is retained; no live connector or verified listing is claimed.
- **Himachal Pradesh** — Official endpoint requires unsafe legacy TLS renegotiation, rejected by the Node collector. Secure feed or server TLS update needed; no listings imported.
- **Ladakh** — Official Administration notification archive inspected; it carries a byte-identical copy of Police Constable 02/2026 plus a September Central Pool MBBS/BDS admission notice. Administration admissions and other departmental/local cycles have not been imported and remain gaps.
- **Lakshadweep** — Detailed Lakshadweep notice PDFs are hosted on cdn.s3waas.gov.in, whose robots.txt disallows all automated requests. Manual research evidence is retained; no PDF collector or verified listing is claimed.
- **Madhya Pradesh** — MPPSC robots.txt disallows all automated paths. A permitted feed or manual review is needed before any connector can collect advertisements; no verified listing is claimed.
- **Maharashtra** — Public notice API routes disallow automated collection in robots.txt. Official homepage remains available; a permitted feed or manual notice review is needed.
- **Puducherry** — Puducherry CGL2026001 portal row gives application close 13 April 2026 15:00; its linked 32-page official notice gives 14 April 2026 15:00. No resolving amendment was found on that recruitment's news page. Hold the date for review; do not infer an extension.
- **Punjab** — PPSC homepage and robots.txt are accessible, but the Open Advertisement link redirects to a session-expired error without a usable notice register. A stable official notice endpoint is needed before collection.
- **Telangana** — Main TGPSC homepage links September 2026 Manager (Engineering) application and new-site notice PDFs. The new site's robots.txt redirects to a login page, so automated notice-PDF access cannot be cleared by the collector; a permitted public source endpoint is needed.

## Measurement limits

- A connector function is not connector acceptance, enabled scheduling, complete notice capture or publication.
- Missing source-health row is unknown collector health, not no evidence: existing packets may retain document-level fetch timestamps.
- Subdivision tags do not prove a state appointing authority; central institute and workplace tags cannot substitute for PSC/administration coverage.
- Per-region source/draft counts overlap when a source has multiple subdivision tags. Do not sum them for India totals.
- Evidence in pending packets is unverified. Published counts require exact approval revisions, not stored-record totals.
- Recruitment-only primary entries do not establish licensing, education admission or vocational coverage.

Current National Portal state/UT route exposes no state list to the web reader; this report binds the local inventory and does not claim an independently audited denominator. Source URLs, health, packet fingerprints, pathway labels and known gaps are retained in [machine-readable snapshot](india-subdivision-source-audit-2026-09-27.json).

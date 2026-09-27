/** Exact-document pilot for Kerala's 31 August 2026 gazette. Founder review required. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Connector } from "./types.ts";
import type { EligibilityRules } from "../lib/eligibility/types.ts";
import { civilDateIn } from "../lib/time.ts";
import { dayFirstDate, evidenceSource, makeCycle, stripTags } from "./util.ts";

const BASE = "https://www.keralapsc.gov.in";
interface SharedCategory { number: number; documentKey: string; post: string; community: string; vacancies: number; districts: string[] }
interface Extraction { gazetteUrl: string; closesOn: string; generalConditions: { pageUrl: string; pdfUrl: string; sha256: string; nationalityPage: number }; documents: { key: string; sha256: string }[]; sharedCategories: SharedCategory[] }
const extraction = JSON.parse(readFileSync(new URL("../data/extractions/kerala-august-2026-categories.json", import.meta.url), "utf8")) as Extraction;
/** Human extraction from the English sections of the hash-pinned original PDFs; founder review still required. */
const individualDetails: Record<string, { scope: string; outcome: string; qualifications: string; residence: string; salary: string; minAge?: number; education?: EligibilityRules["education"]; experience?: EligibilityRules["experience"]; checks: string[]; selection?: string[] }> = {
  "130": { scope: "Kerala Information and Public Relations; general statewide direct recruitment", outcome: "Artist appointment; vacancy count anticipated, not published", qualifications: "Diploma in Drawing and Painting (MGTE or KGTE), or accepted equivalent.", residence: "No Kerala domicile rule established in this category notice; applicable general conditions need review.", salary: "₹35,600–₹75,400 pay scale.", minAge: 19, checks: ["Confirm MGTE/KGTE drawing and painting qualification or officially accepted equivalent, category-specific age relaxation and applicable general conditions."] },
  "131": { scope: "Malabar Cements Ltd; direct recruitment to a public-sector company", outcome: "One Compounder Grade IV position", qualifications: "Diploma in Pharmacy and government-recognized First-Aid certificate.", residence: "No Kerala domicile rule established in this category notice; applicable general conditions need review.", salary: "₹30,200–₹62,650 pay scale.", minAge: 18, checks: ["Confirm Pharmacy diploma, recognized First-Aid certificate, age relaxation and company appointment conditions."] },
  "132": { scope: "Kerala Water Authority; by-transfer category for serving lower-category personnel, not an open-market application", outcome: "Eight Plumber (By Transfer) positions", qualifications: "At least three years in a qualifying lower-category Kerala Water Authority post; SSLC or equivalent and National Trade Certificate in Plumber trade after a one-year course, or accepted equivalent. Service certificate required.", residence: "Current qualifying Kerala Water Authority employment is required for this category; no separate domicile rule established.", salary: "₹25,800–₹59,300 pay scale.", minAge: 18, education: { minLevel: "secondary", evidence: "Category 132 English PDF, qualification 8: SSLC or equivalent; Plumber trade certificate also required." }, experience: { minYears: 3, evidence: "Category 132 English PDF, method of appointment note 1: at least three years in specified lower-category Kerala Water Authority service." }, checks: ["Confirm current qualifying Kerala Water Authority service, prescribed lower category, service certificate and Plumber trade certificate. Separate open-market ranked list is not this application cycle."], selection: ["One Time Registration and category-specific application", "Service certificate and qualification verification", "Selection test if announced", "By-transfer appointment checks"] },
  "133": { scope: "Kerala Ground Water Department; general direct recruitment", outcome: "One Laboratory Attender position", qualifications: "SSLC pass with at least 60% marks, or accepted equivalent.", residence: "No Kerala domicile rule established in this category notice; applicable general conditions need review.", salary: "₹23,700–₹52,600 pay scale.", minAge: 18, education: { minLevel: "secondary", evidence: "Category 133 English PDF, qualification 7: SSLC with at least 60% marks or equivalent." }, checks: ["Confirm SSLC score of at least 60% or accepted equivalent, age relaxation and applicable general conditions."] },
  "134": { scope: "Kerala Co-operative Milk Marketing Federation; Part II society category for regular member-society employees, not general open-market Part I", outcome: "One Junior Assistant society-category position", qualifications: "Three years regular service in an affiliated member society or primary member society; degree in Arts, Science or Commerce; JDC/HDC; service certificate uploaded with application.", residence: "Regular qualifying affiliated-society employment is required; no separate domicile rule established.", salary: "₹20,180–₹46,990 pay scale.", minAge: 18, education: { minLevel: "bachelor", evidence: "Category 134 English PDF, qualification 7: degree in Arts, Science or Commerce; JDC/HDC also required." }, experience: { minYears: 3, evidence: "Category 134 English PDF, qualification 7: three years regular member-society service at application and appointment." }, checks: ["Confirm regular affiliated-society service at application and appointment, three-year duration, Arts/Science/Commerce degree, JDC/HDC and uploaded service certificate. Part I open-market recruitment is a separate list."], selection: ["One Time Registration and Part II application", "Uploaded service certificate and qualification verification", "Selection test if announced", "Society-category appointment checks"] },
  "135": { scope: "Kerala Land Development Corporation; direct recruitment restricted to serving corporation personnel", outcome: "One Assistant Project Engineer position", qualifications: "B.Tech in Civil or Agricultural Engineering, accepted equivalent, or Section A and B AMIE Civil; three years as corporation Draftsman/Overseer, or four years in another qualifying lower category. Temporary workers are excluded. Service certificate required.", residence: "Current qualifying corporation service is required; no separate domicile rule established.", salary: "₹19,240–₹34,500 pay scale.", checks: ["Confirm current non-temporary corporation service, eligible engineering qualification, applicable three- or four-year service route and service certificate. Notice states no upper age limit."], selection: ["One Time Registration and in-service application", "Service certificate and engineering qualification verification", "Selection test if announced", "Corporation appointment checks"] },
  "136": { scope: "Kerala State Archives; special direct recruitment restricted to Scheduled Caste or Scheduled Tribe candidates of Kerala State", outcome: "One Conservation Officer position", qualifications: "First- or second-class Master's degree in Chemistry; at least three years archival-record conservation experience and two years chemistry research experience. National Archives conservation certificate is preferential.", residence: "Notice limits this special recruitment to Scheduled Caste or Scheduled Tribe candidates of Kerala State; community proof and any residence condition need review.", salary: "₹50,200–₹105,300 pay scale.", minAge: 18, education: { minLevel: "master", evidence: "Category 136 English PDF, qualification 7(i): first- or second-class Master's degree in Chemistry." }, experience: { minYears: 3, evidence: "Category 136 English PDF, qualifications 7(ii)–(iii): three years archival conservation and two years chemistry research; overlap must be checked." }, checks: ["Confirm Kerala SC/ST community eligibility, Chemistry Master's class and recognition, both experience requirements and conditional age relaxation up to 50."] },
  "137": { scope: "Kerala General Education DIET; NCA direct recruitment for Ezhava/Billava/Thiyya community of Kerala State", outcome: "One Lecturer in Arabic position", qualifications: "At least 50% in Master's degree in Arabic Language and Literature, at least 50% in M.Ed with Language Education or Arabic teaching specialization, and one listed TET/NET/SET/M.Phil/Ph.D route.", residence: "NCA category is limited to Ezhava/Billava/Thiyya candidates of Kerala State; community proof needs review.", salary: "₹55,200–₹115,300 pay scale.", minAge: 22, education: { minLevel: "master", evidence: "Category 137 English PDF, qualification 7: Master's in Arabic Language and Literature and M.Ed, both at least 50%." }, checks: ["Confirm Ezhava/Billava/Thiyya Kerala community, both specified degrees and marks, accepted test or research-degree route, and age conditions. Arabic is degree subject; notice gives no CEFR or other language proficiency level."] },
  "138": { scope: "Kerala Police Band Unit; NCA direct recruitment for Other Backward Class community; female and differently abled candidates excluded by notice", outcome: "One Police Constable (Band/Bugler/Drummer) position", qualifications: "Higher Secondary or equivalent; at least one year playing Police Band instruments with a registered firm, institution or band troop; practical proficiency and physical standards.", residence: "Notice restricts this NCA category to the notified OBC community; community proof and any residence condition need review.", salary: "₹31,100–₹66,800 pay scale.", minAge: 18, education: { minLevel: "higher-secondary", evidence: "Category 138 English PDF, qualification 7(1)(a): Higher Secondary or equivalent." }, experience: { minYears: 1, evidence: "Category 138 English PDF, qualification 7(1)(b): one year playing Police Band instruments in a registered institution." }, checks: ["Confirm notified OBC community, male/non-disabled restriction, band experience certificate, physical and visual standards, practical instrument test and age exceptions. Instrument proficiency is not a language level."], selection: ["One Time Registration and NCA category application", "Community, education and band experience verification", "Physical and practical instrument tests", "Medical and appointment checks"] },
  "143": { scope: "Kerala Prisons and Correctional Services; NCA statewide direct recruitment for SCCC community of Kerala State; female and differently abled candidates excluded by notice", outcome: "One Assistant Prison Officer position", qualifications: "SSLC or equivalent; specified physical, vision and physical-efficiency standards. Kerala Jail Subordinate Officer's test follows appointment during probation.", residence: "NCA category is limited to Scheduled Caste Converted to Christianity candidates of Kerala State; community proof needs review.", salary: "₹27,900–₹63,700 pay scale.", minAge: 18, education: { minLevel: "secondary", evidence: "Category 143 English PDF, qualification 7(a): SSLC or equivalent." }, checks: ["Confirm Kerala SCCC community, male/non-disabled restriction, physical and vision standards, physical-efficiency test and applicable age concession. Jail Subordinate Officer's test occurs during probation after appointment."], selection: ["One Time Registration and NCA category application", "Community and education verification", "Physical, vision and physical-efficiency tests", "Medical and appointment checks", "Jail Subordinate Officer's test during probation"] },
  "144": { scope: "Kerala Ground Water Department; NCA direct recruitment for Muslim community of Kerala State", outcome: "One Electrician position", qualifications: "ITI trade certificate in Electrician trade, or accepted equivalent.", residence: "NCA category is limited to Muslim candidates of Kerala State; community proof needs review.", salary: "₹26,500–₹60,700 pay scale.", minAge: 18, checks: ["Confirm Kerala Muslim community, Electrician ITI trade certificate or accepted equivalent, and age conditions."] },
  "145": { scope: "Kerala State Film Development Corporation; NCA direct recruitment for LC/AI community of Kerala State", outcome: "One Electrician position", qualifications: "Diploma in Electrical Engineering; or, only in absence of diploma-qualified candidates, 18-month ITI Electrician course plus apprenticeship. Two years in a film studio of repute required for either route.", residence: "NCA category is limited to Latin Catholic/Anglo Indian candidates of Kerala State; community proof needs review.", salary: "₹19,000–₹43,600 pay scale.", minAge: 18, experience: { minYears: 2, evidence: "Category 145 English PDF, qualification 7(b): two years in a film studio of repute." }, checks: ["Confirm Kerala LC/AI community, Electrical Engineering diploma or conditional ITI-plus-apprenticeship route, film-studio experience certificate and age conditions."] },
};
const documentUrl = (key: string) => `${BASE}/sites/default/files/2026-08/noti-${key}-26.pdf`;
export const KERALA_GAZETTE = extraction.gazetteUrl;
export const KERALA_PDFS = extraction.documents.map((document) => documentUrl(document.key));
export const KERALA_GENERAL_CONDITIONS = extraction.generalConditions;
export function parseKeralaIndex(html: string) {
  const pages = new Map<string, { url: string; publishedOn: string; closesOn: string }>();
  for (const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const link = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(row[1]);
    const date = /<time\b[^>]*>([\s\S]*?)<\/time>/i.exec(row[1]);
    if (!link || !/EXTRA ORDINARY GAZETTE DATE/i.test(stripTags(link[2]))) continue;
    const url = new URL(link[1], BASE);
    if (url.origin !== BASE || !url.pathname.startsWith("/extra-ordinary-gazette-date-")) continue;
    const publishedOn = dayFirstDate(stripTags(link[2]));
    // Drupal's datetime attribute is a CMS timestamp, not an official cutoff.
    const closesOn = dayFirstDate(date ? stripTags(date[1]) : null);
    if (!publishedOn || !closesOn || closesOn < publishedOn) throw new Error("Kerala gazette dates need review");
    pages.set(url.href, { url: url.href, publishedOn, closesOn });
  }
  if (!pages.size) throw new Error("Kerala notification index changed: no gazette rows parsed");
  return [...pages.values()];
}

export function parseKeralaGazette(html: string) {
  const notices = new Map<string, { id: string; title: string; url: string; category: string }>();
  const warnings: string[] = [];
  for (const link of html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const title = stripTags(link[2]);
    if (!/Cat\.?\s*No\./i.test(title)) continue;
    const url = new URL(link[1], BASE);
    if (url.hostname !== "www.keralapsc.gov.in" || url.port || !/^https?:$/.test(url.protocol) || !/^\/sites\/default\/files\/.+\.pdf$/i.test(url.pathname)) continue;
    url.protocol = "https:";
    const category = /Cat\.?\s*No\.\s*(\d+)\/(\d{4})\)/i.exec(title);
    if (!category) { warnings.push(`Multiple or ambiguous categories require PDF review: ${url.href}`); continue; }
    const id = `kerala-psc-${category[2]}-${category[1]}`;
    const notice = { id, title, url: url.href, category: `${category[1]}/${category[2]}` };
    if (notices.has(id) && JSON.stringify(notices.get(id)) !== JSON.stringify(notice)) throw new Error(`Conflicting Kerala category: ${id}`);
    notices.set(id, notice);
  }
  if (!notices.size) throw new Error("Kerala gazette changed: no unambiguous categories parsed");
  return { notices: [...notices.values()], warnings };
}

function categoryPdfLinks(html: string): string[] {
  return [...html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
    .filter((match) => /Cat\.?\s*No\./i.test(stripTags(match[2])))
    .map((match) => {
      const url = new URL(match[1], BASE);
      if (url.hostname !== "www.keralapsc.gov.in" || !/^https?:$/.test(url.protocol) || !/^\/sites\/default\/files\/2026-08\/noti-[\d-]+-26\.pdf$/.test(url.pathname)) {
        throw new Error("Kerala category PDF link changed; review required");
      }
      url.protocol = "https:";
      return url.href;
    });
}

export function checkKeralaGazetteDocuments(html: string): void {
  const actual = categoryPdfLinks(html).sort();
  const expected = [...KERALA_PDFS].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error("Kerala 31 August category PDF set changed; review required");
}

export function checkKeralaGeneralConditionsLink(html: string): void {
  const links = [...html.matchAll(/<a\b[^>]+href="([^"]+)"[^>]*>/gi)]
    .map((match) => new URL(match[1], BASE).href)
    .filter((url) => url === KERALA_GENERAL_CONDITIONS.pdfUrl);
  if (links.length !== 1) throw new Error("Kerala General Conditions PDF link changed; review required");
}

const nationalityConditions = "Kerala PSC General Conditions Part II §1 accepts Indian citizens; subjects of Nepal or Bhutan; pre-1962 Tibetan migrants intending permanent settlement; and persons of Indian origin who migrated from Pakistan, Myanmar, Sri Lanka, Kenya, Uganda or Tanzania intending permanent settlement. Listed non-Indian groups need a Government of India eligibility certificate. They may sit the examination or interview before producing it; appointment remains provisional until they do. A category-specific Part I exemption or additional service rule may change this, so foreign applicants must verify their route and documents with Kerala PSC.";
const nationalityChecks = {
  apply: "Check Kerala PSC General Conditions Part II §1 route, any category-specific Part I exemption, and personal proof. Nepal/Bhutan subject status or listed migrant origin is more specific than nationality alone.",
  selection: "For listed non-Indian routes, General Conditions permit examination/interview while the Government of India eligibility certificate is pending; verify route and category-specific selection conditions.",
  outcome: "For listed non-Indian routes, appointment is provisional until the Government of India eligibility certificate is produced; verify service-specific appointment conditions.",
};

export const keralaPsc: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("Kerala original PDF byte fetch required");
  const index = await fetchText(`${BASE}/notifications`, { accept: "text/html" });
  const today = civilDateIn("Asia/Kolkata", now);
  const page = parseKeralaIndex(index.text).find((candidate) => candidate.url === KERALA_GAZETTE);
  if (!page || page.closesOn !== extraction.closesOn) throw new Error("Kerala 31 August gazette or deadline changed; review required");
  const gazette = await fetchText(KERALA_GAZETTE, { accept: "text/html" });
  if (index.evidence.url !== `${BASE}/notifications` || gazette.evidence.url !== KERALA_GAZETTE) throw new Error("Kerala official page redirected; review required");
  checkKeralaGazetteDocuments(gazette.text);
  const generalPage = await fetchText(KERALA_GENERAL_CONDITIONS.pageUrl, { accept: "text/html" });
  if (generalPage.evidence.url !== KERALA_GENERAL_CONDITIONS.pageUrl) throw new Error("Kerala General Conditions page redirected; review required");
  checkKeralaGeneralConditionsLink(generalPage.text);
  const generalPdf = await fetchBytes(KERALA_GENERAL_CONDITIONS.pdfUrl, { accept: "application/pdf" });
  const generalHash = createHash("sha256").update(generalPdf.bytes).digest("hex");
  if (generalPdf.bytes.subarray(0, 5).toString() !== "%PDF-" || generalPdf.evidence.url !== KERALA_GENERAL_CONDITIONS.pdfUrl ||
      generalPdf.evidence.sha256 !== generalHash || generalHash !== KERALA_GENERAL_CONDITIONS.sha256) {
    throw new Error("Kerala General Conditions PDF changed; nationality extraction withheld");
  }
  const parsed = parseKeralaGazette(gazette.text);
  if (parsed.notices.length !== 12 || parsed.warnings.length !== 2) throw new Error("Kerala category set changed; review required");
  const fetchedPdfs = await Promise.all(extraction.documents.map((document) => fetchBytes(documentUrl(document.key), { accept: "application/pdf" })));
  const pdfByKey = new Map<string, typeof fetchedPdfs[number]>();
  extraction.documents.forEach((document, position) => {
    const fetched = fetchedPdfs[position];
    const url = documentUrl(document.key);
    const hash = createHash("sha256").update(fetched.bytes).digest("hex");
    if (fetched.bytes.subarray(0, 5).toString() !== "%PDF-" || fetched.evidence.url !== url ||
        fetched.evidence.sha256 !== hash || hash !== document.sha256) {
      throw new Error(`Kerala category ${document.key} PDF changed; extracted fields withheld`);
    }
    pdfByKey.set(document.key, fetched);
  });
  const gazetteSource = evidenceSource(source, gazette.evidence, "Kerala 31 August 2026 extraordinary gazette", "HTML", "English and Malayalam");
  const generalSource = evidenceSource(source, generalPdf.evidence, "Kerala PSC General Conditions, Part II §1 (English PDF page 45)", "PDF", "Malayalam and English");
  const window = { opensOn: null, closesOn: page.closesOn, officialTimeZone: null, cutoffLocalTime: null, precision: "date" as const,
    note: "Gazette published 31 August 2026. Category notices say 7 October up to 12 midnight without naming a timezone; exact cutoff instant is ambiguous, so no clock time or official timezone is encoded. Opening date is not confirmed." };
  const status = today > page.closesOn ? "closed" as const : "uncertain" as const;
  const individual = parsed.notices.map((notice) => {
    const key = notice.category.split("/")[0];
    const pdf = pdfByKey.get(key);
    const detail = individualDetails[key];
    if (!pdf || !detail || notice.url !== documentUrl(key)) throw new Error(`Kerala category ${key} PDF identity changed; review required`);
    return makeCycle({
      id: notice.id, sourceId: source.id, title: notice.title, cycleLabel: notice.category,
      authority: source.authority, pathway: "recruitment", jurisdictionCode: "IN", jurisdictionName: "India",
      subdivisionCodes: ["IN-KL"], scopeLabel: detail.scope,
      outcome: detail.outcome,
      status, statusNote: "Category-specific fields extracted from hash-pinned original PDF; founder review and applicable general conditions remain pending.",
      applicationWindow: window,
      qualifications: detail.qualifications,
      citizenshipRule: nationalityConditions,
      residenceRule: detail.residence,
      selectionStages: detail.selection ?? ["One Time Registration and category-specific application", "Qualification and category proof", "Written/OMR/online test if announced, with required confirmation", "Appointment checks"],
      fee: "Original category notice says no application fee.",
      salary: detail.salary,
      rules: { complete: false, asOn: detail.minAge ? "2026-01-01" : null,
        ...(detail.minAge ? { age: { min: detail.minAge, evidence: `Category ${key} English PDF age clause: minimum age ${detail.minAge}; upper limit and relaxations need case-specific review.` } } : {}),
        ...(detail.education ? { education: detail.education } : {}),
        ...(detail.experience ? { experience: detail.experience } : {}),
        manualChecks: [
          { stage: "apply", text: `${detail.checks[0]} ${nationalityChecks.apply}` },
          { stage: "selection", text: `${nationalityChecks.selection} Confirm category-specific practical tests, documents and any later test confirmation.` },
          { stage: "outcome", text: nationalityChecks.outcome },
        ],
      },
      venues: [{ kind: "unknown", name: "Examination or test venue not published in the reviewed category notice" }],
      sources: [gazetteSource, evidenceSource(source, pdf.evidence, `Kerala category ${notice.category} original notice`, "PDF", "English and Malayalam"), generalSource],
      applicationUrl: BASE,
    });
  });
  const shared = extraction.sharedCategories.map((category) => {
    const pdf = pdfByKey.get(category.documentKey);
    if (!pdf) throw new Error(`Missing Kerala shared category ${category.number} document`);
    const fire = category.documentKey === "139-142";
    const pdfUrl = documentUrl(category.documentKey);
    const district = category.districts.length ? `; district choice: ${category.districts.join(" or ")}` : "";
    return makeCycle({
      id: `kerala-psc-2026-${category.number}`, sourceId: source.id,
      title: `${category.post} — ${category.community} (Cat.No.${category.number}/2026)`,
      cycleLabel: `${category.number}/2026`, programme: `${category.post} NCA recruitment`,
      authority: source.authority, pathway: "recruitment", jurisdictionCode: "IN", jurisdictionName: "India",
      subdivisionCodes: ["IN-KL"],
      scopeLabel: `Kerala ${fire ? "Fire and Rescue Services" : "Forest and Wildlife"} recruitment for specified Kerala community${district}. District names are hiring scope, not exam venues.`,
      outcome: `${category.vacancies} ${category.post} ${category.vacancies === 1 ? "position" : "positions"} reserved for ${category.community}${district}`,
      status, statusNote: "Shared original PDF has separate category numbers and vacancy rows. Category application identity and general conditions await founder review.",
      applicationWindow: window,
      qualifications: fire ? "Plus Two or recognized equivalent; specified physical and visual standards, swimming qualification and physical efficiency test. Female and differently abled candidates are excluded by this notice." : "Plus Two or recognized equivalent; sex- and community-specific physical, endurance and medical standards. Differently abled candidates are excluded by this notice.",
      citizenshipRule: nationalityConditions,
      residenceRule: `This NCA category is limited to ${category.community} candidates of Kerala State. Community and district proof require verification; an overseas applicant should confirm whether they meet this condition with Kerala PSC.`,
      selectionStages: fire ? ["One Time Registration and category-specific online application", "Document and community proof", "Physical measurement", "Swimming practical test", "Physical efficiency test", "Written/OMR/online test if announced, with required confirmation", "Medical and appointment checks"] : ["One Time Registration and category-specific online application", "Document and community proof, with district selection", "Physical measurement and endurance test", "Physical efficiency test", "Written/OMR/online test if announced, with required confirmation", "Medical and appointment checks"],
      fee: "Original shared category notice says no application fee.",
      salary: "₹27,900–₹63,700 pay scale as printed in the category notice.",
      rules: { complete: false, asOn: "2026-01-01",
        age: { min: fire ? 18 : 19, evidence: fire ? "Fire & Rescue shared PDF English page 2: birth windows start at age 18; upper ages vary by category and require manual check." : "Beat Forest shared PDF English page 2: birth windows start at age 19; upper age varies for SC and other NCA communities." },
        education: { minLevel: "higher-secondary", evidence: fire ? "Fire & Rescue shared PDF English page 2: Plus Two or equivalent; preferential computer diploma is not mandatory." : "Beat Forest shared PDF English page 2: Plus Two or equivalent recognized by Kerala or India." },
        manualChecks: [
          { stage: "apply", text: `Confirm ${category.community} Kerala community certificate, ${category.districts.length ? `district selection (${category.districts.join(" or ")}), ` : ""}category-specific birth window. This NCA application is not open to other communities. ${nationalityChecks.apply}` },
          { stage: "selection", text: `${nationalityChecks.selection} ${fire ? "Confirm notice-specific gender, disability, physical, vision and swimming rules; complete mandatory tests and any written-test confirmation." : "Confirm community/district, disability, sex-specific physical and medical rules; complete endurance and physical tests plus any written-test confirmation."}` },
          { stage: "outcome", text: `${nationalityChecks.outcome} Confirm original documents and service conditions.` },
        ],
      },
      venues: [{ kind: "unknown", name: "Examination or test venue not published in the reviewed category notice" }],
      sources: [gazetteSource, evidenceSource(source, pdf.evidence, `Kerala categories ${category.documentKey}/2026 shared original PDF`, "PDF", "English and Malayalam"), generalSource],
      applicationUrl: BASE,
    });
  });
  const cycles = [...individual, ...shared].sort((a, b) => a.id.localeCompare(b.id));
  if (cycles.length !== 21 || new Set(cycles.map((cycle) => cycle.id)).size !== 21) throw new Error("Kerala category applications cannot be counted safely");
  return { cycles, evidence: [index.evidence, gazette.evidence, generalPage.evidence, generalPdf.evidence, ...fetchedPdfs.map((pdf) => pdf.evidence)], complete: false, warnings: [
    "Only the 31 August 2026 gazette is bound here; other gazettes and Kerala authorities remain coverage gaps.",
    "Twelve individual category PDFs have provisional job-type, qualification and reservation extraction. The linked current General Conditions PDF gives conditional non-Indian routes; founder must verify individual route, category-specific exemptions, service rules and documents. No language level is inferred from bilingual document text.",
    "Nine NCA category numbers share two PDFs and are staged separately by category, provisionally pending application-portal identity review. Vacancy rows and district choices never multiply cycle counts.",
    "Shared notices say 7 October up to 12 midnight. Precise cutoff instant is unresolved; no 00:00 or 23:59 time is invented.",
    "No blanket language proficiency level is printed in the reviewed General Conditions or these English/Malayalam category PDFs; founder must check post-specific rules and original-language text. Lecturer in Arabic specifies a degree subject, not a proficiency-scale level.",
  ] };
};

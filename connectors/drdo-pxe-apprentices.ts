/** Exact-document DRDO PXE apprenticeship intake. Output always needs founder review. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { civilDateIn } from "../lib/time.ts";
import type { Connector } from "./types.ts";
import { evidenceSource, makeCycle, stripTags } from "./util.ts";

interface Extraction {
  indexUrl: string; detailUrl: string; noticeUrl: string; noticeSha256: string;
  advertisement: string; opensOn: string; closesOn: string; places: number; disciplines: number;
}
const notice = JSON.parse(readFileSync(new URL("../data/extractions/drdo-pxe-apprentices-2026.json", import.meta.url), "utf8")) as Extraction;

/** The live register must still point this exact advertisement to its detail page. */
export function verifyDrdoPxeIndex(html: string): void {
  const cards = [...html.matchAll(/<li class="col-lg-4 col-md-6">([\s\S]*?)<\/li>/g)]
    .map((match) => match[1]).filter((card) => card.includes(notice.advertisement));
  const links = cards.flatMap((card) => [...card.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>View More<\/a>/gi)]
    .map((match) => new URL(match[1].replace(/^http:/, "https:"), notice.indexUrl).href));
  if (cards.length !== 1 || links.length !== 1 || links[0] !== notice.detailUrl ||
      !/12\/10\/2026/.test(stripTags(cards[0]).replace(/\s+/g, " "))) {
    throw new Error("DRDO PXE index identity, deadline or detail link changed; review required");
  }
}

/** The detail page binds the posted date, deadline and exact PDF link. */
export function verifyDrdoPxeDetail(html: string): void {
  const text = stripTags(html).replace(/\s+/g, " ");
  const pdfs = [...html.matchAll(/<a\b[^>]*href="([^"]+\.pdf)"/gi)]
    .map((match) => new URL(match[1], notice.detailUrl).href);
  if (!text.includes(notice.advertisement) || !/Start Date\s+23-09-2026/.test(text) ||
      !/End Date\s+12-10-2026/.test(text) || pdfs.length !== 1 || pdfs[0] !== notice.noticeUrl) {
    throw new Error("DRDO PXE detail dates or original notice link changed; review required");
  }
}

export const drdoPxeApprentices: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("DRDO PXE original notice bytes required");
  const index = await fetchText(notice.indexUrl, { accept: "text/html" });
  if (index.evidence.url !== notice.indexUrl) throw new Error("DRDO vacancy index redirected; review required");
  verifyDrdoPxeIndex(index.text);
  const detail = await fetchText(notice.detailUrl, { accept: "text/html" });
  if (detail.evidence.url !== notice.detailUrl) throw new Error("DRDO PXE detail redirected; review required");
  verifyDrdoPxeDetail(detail.text);
  const pdf = await fetchBytes(notice.noticeUrl, { accept: "application/pdf" });
  const hash = createHash("sha256").update(pdf.bytes).digest("hex");
  if (pdf.bytes.subarray(0, 5).toString() !== "%PDF-" || pdf.evidence.url !== notice.noticeUrl ||
      pdf.evidence.sha256 !== hash || hash !== notice.noticeSha256) {
    throw new Error("DRDO PXE notice changed; critical fields withheld");
  }

  const today = civilDateIn("Asia/Kolkata", now);
  const status = today > notice.closesOn ? "closed" : today < notice.opensOn ? "upcoming" : today === notice.closesOn ? "uncertain" : "open";
  const cycle = makeCycle({
    id: "drdo-pxe-apprentices-2026-27", sourceId: source.id,
    title: "DRDO PXE Graduate and Technician Apprenticeships — 2026–27",
    programme: "PXE one-year degree and diploma apprenticeship training",
    cycleLabel: notice.advertisement,
    authority: source.authority,
    pathway: "vocational", jurisdictionCode: "IN", jurisdictionName: "India", subdivisionCodes: ["IN-OR"],
    scopeLabel: "One training intake at PXE, Chandipur, Balasore, Odisha; postal application. Training location is not an applicant residence rule.",
    outcome: `One-year apprenticeship training with monthly stipend. ${notice.places} places across ${notice.disciplines} degree or diploma disciplines share one application form and intake. The official notice expressly says training gives no right to DRDO employment.`,
    status,
    statusNote: "Official DRDO detail page and notice give a 12 October 2026 postal receipt deadline. No cutoff clock time is printed. Founder review pending.",
    applicationWindow: { opensOn: notice.opensOn, closesOn: notice.closesOn, officialTimeZone: "Asia/Kolkata", cutoffLocalTime: null,
      precision: "date", note: "DRDO detail page labels 23 September as Start Date. PDF page 1 says applications must reach PXE by 12 October; no receipt hour is stated." },
    qualifications: "Regular B.Tech in one of four listed branches or diploma in one of eight listed branches. Eligible pass years: 2022–2026. NATS enrolment is required; candidates with postgraduate degrees or at least one year of training/job experience after the essential qualification are excluded. Post-specific branch and document checks need review.",
    citizenshipRule: "Application form asks for nationality, but checked notice does not state which nationalities may apply or whether foreign citizens can obtain NATS enrolment and the resulting apprenticeship. Ask PXE/NATS; do not infer permission from the blank nationality field.",
    residenceRule: "No applicant domicile requirement is printed. Chandipur, Balasore is the training and selection location, not a residence restriction.",
    languageNote: "Notice requires a typed application form and lists a written test/interview. It does not prescribe a language proficiency level or certificate; English form text does not establish an English eligibility rule.",
    selectionStages: ["NATS registration and typed postal application", "Shortlisting by qualification marks", "Written test/interview at PXE, Chandipur", "Document verification and training contract", "One-year apprenticeship training"],
    fee: "No application fee stated in checked PXE notice.",
    rules: { complete: false, asOn: notice.closesOn, manualChecks: [
      { stage: "apply", text: "Verify exact B.Tech/diploma branch, regular-mode 2022–2026 completion, NATS enrolment, no postgraduate degree and less than one year of post-qualification training/job experience. Foreign-national eligibility is unstated." },
      { stage: "selection", text: "PXE shortlists by essential-qualification marks and calls candidates to a written test/interview at Chandipur. Test language and pass conditions are not published." },
      { stage: "outcome", text: "Confirm nationality, NATS eligibility, original documents and one-year training contract with PXE. Training gives no right to DRDO employment." },
    ] },
    venues: [{ kind: "unknown", name: "Written test/interview at PXE, Chandipur, Balasore; map coordinates not verified" }],
    sources: [
      evidenceSource(source, index.evidence, "DRDO vacancies register, PXE 2026–27 card", "HTML", "English"),
      evidenceSource(source, detail.evidence, "DRDO PXE 2026–27 advertisement detail", "HTML", "English"),
      evidenceSource(source, pdf.evidence, "PXE/HRD/AT/01/2026-27 original advertisement and application form", "PDF", "English and Hindi"),
    ],
    applicationMethod: "post", applicationUrl: notice.noticeUrl,
  });
  return { cycles: [cycle], evidence: [index.evidence, detail.evidence, pdf.evidence], complete: false, warnings: [
    "This is one vocational training intake, not 50 separate opportunities or a guaranteed DRDO job.",
    "Foreign-citizen and formal language requirements are not stated; NATS eligibility must be checked with the authority.",
    "Other DRDO vacancies and apprenticeship notices remain coverage gaps.",
  ] };
};

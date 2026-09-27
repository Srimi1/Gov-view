/** One exact Assam PSC advertisement. All output remains founder-review draft. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Connector } from "./types.ts";
import { civilDateIn } from "../lib/time.ts";
import { dayFirstDate, evidenceSource, makeCycle, stripTags } from "./util.ts";

interface Extraction {
  indexUrl: string; corrigendaUrl: string; pdfUrl: string; pdfSha256: string;
  applicationUrl: string; advertisement: string; title: string;
  publishedOn: string; opensOn: string; closesOn: string; feePaymentOn: string;
}
const extraction = JSON.parse(readFileSync(new URL("../data/extractions/apsc-12-2026.json", import.meta.url), "utf8")) as Extraction;

export function parseAssamAdvertisementRow(html: string) {
  const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((match) => [...match[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => cell[1]))
    .filter((cells) => cells.length === 4 && stripTags(cells[0]) === extraction.advertisement);
  if (rows.length !== 1) throw new Error("APSC 12/2026 register row missing or duplicated; review required");
  const cells = rows[0];
  const links = [...cells[1].matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({ url: new URL(match[1], extraction.indexUrl).href, title: stripTags(match[2]) }));
  const pdf = links.filter((link) => link.url === extraction.pdfUrl && link.title === extraction.title);
  const application = links.filter((link) => link.url.replace(/\/$/, "") === extraction.applicationUrl.replace(/\/$/, "") && /apply here/i.test(link.title));
  const start = dayFirstDate(/APPLICATION START DATE:\s*([\d-]+)/i.exec(stripTags(cells[1]))?.[1]);
  const published = dayFirstDate(stripTags(cells[2]));
  const closes = dayFirstDate(stripTags(cells[3]));
  if (links.length !== 2 || pdf.length !== 1 || application.length !== 1 ||
      start !== extraction.opensOn || published !== extraction.publishedOn || closes !== extraction.closesOn) {
    throw new Error("APSC 12/2026 register title, link or dates changed; review required");
  }
  return { totalRows: [...html.matchAll(/<tr\b[^>]*class="advt_rw"[^>]*>/gi)].length };
}

export function assertNoAssamCorrigendum(html: string) {
  const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) => stripTags(match[1]));
  if (rows.some((row) => /\b(?:advt|advertisement)?\.?\s*(?:no\.?\s*)?12\s*[-/]\s*2026\b/i.test(row))) {
    throw new Error("APSC 12/2026 corrigendum may change applicant fields; review required");
  }
}

export const assamPsc12: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("APSC exact PDF byte fetch required");
  const index = await fetchText(extraction.indexUrl, { accept: "text/html" });
  if (index.evidence.url !== extraction.indexUrl) throw new Error("APSC register redirected; review required");
  const { totalRows } = parseAssamAdvertisementRow(index.text);
  const corrigenda = await fetchText(extraction.corrigendaUrl, { accept: "text/html" });
  if (corrigenda.evidence.url !== extraction.corrigendaUrl) throw new Error("APSC corrigenda register redirected; review required");
  assertNoAssamCorrigendum(corrigenda.text);
  const pdf = await fetchBytes(extraction.pdfUrl, { accept: "application/pdf" });
  const hash = createHash("sha256").update(pdf.bytes).digest("hex");
  if (pdf.bytes.subarray(0, 5).toString() !== "%PDF-" || pdf.evidence.url !== extraction.pdfUrl ||
      pdf.evidence.sha256 !== hash || hash !== extraction.pdfSha256) {
    throw new Error("APSC 12/2026 PDF changed; extracted fields withheld");
  }
  const today = civilDateIn("Asia/Kolkata", now);
  const status = today < extraction.opensOn ? "upcoming" as const : today > extraction.closesOn ? "closed" as const : "uncertain" as const;
  const cycle = makeCycle({
    id: "assam-psc-research-assistant-12-2026", sourceId: source.id,
    title: "Research Assistant — Labour Welfare Department, Assam",
    cycleLabel: extraction.advertisement,
    authority: source.authority, pathway: "recruitment",
    jurisdictionCode: "IN", jurisdictionName: "India", subdivisionCodes: ["IN-AS"],
    scopeLabel: "Assam Government Labour Welfare Department; one post. Hiring scope is Assam. Possible exam zones on notice p. 6 are not assigned exam venues.",
    outcome: "One Research Assistant post, pay band ₹22,000–97,000 per month plus ₹9,400 grade pay and admissible allowances. Appointment term is not stated in the checked notice.",
    status,
    statusNote: "Advertisement 12/2026 applications closed 10 September 2026. Exact official PDF, advertisement row and corrigenda register await founder review. Fee payment had a separate 12 September deadline.",
    applicationWindow: { opensOn: extraction.opensOn, closesOn: extraction.closesOn, officialTimeZone: null, cutoffLocalTime: null, precision: "date", note: "Notice p. 3 gives 11 August–10 September for online applications and 12 September for fee payment. No application cutoff hour or governing timezone is printed." },
    qualifications: "At least a second-class bachelor's degree in arts, science or commerce from a recognized university (p. 2). Computer diploma, Labour Laws experience, or Labour Laws/Social Works degree or diploma are preferred, not mandatory.",
    citizenshipRule: "Indian citizenship is required in notice pp. 1–2. Foreign citizens do not meet this published application criterion.",
    residenceRule: "Permanent Assam residence is required. Notice p. 2 accepts a valid Assam Permanent Resident Certificate issued for education or Employment Exchange Registration Certificate as residence proof; living in Assam alone does not prove this.",
    languageNote: "Checked six-page advertisement states no mandatory language or formal proficiency level. Later selection process has not been announced.",
    selectionStages: ["Online form, uploads and fee processing", "Selection method to be announced by APSC; screening, written examination and/or interview may be used (pp. 4–6)", "Document and eligibility verification before appointment"],
    fee: "Application fee plus ₹47.20 CSC processing: General ₹297.20 total; OBC/MOBC ₹197.20; SC/ST/BPL/PwBD ₹47.20. Payment deadline 12 September 2026 is separate from application closing date (p. 3).",
    rules: {
      complete: false, asOn: null,
      nationality: { allowed: ["IN"], evidence: "APSC advertisement 12/2026 pp. 1–2: Indian citizenship required." },
      education: { minLevel: "bachelor", evidence: "APSC advertisement 12/2026 p. 2: at least second-class BA/BSc/BCom or recognized equivalent; second-class and recognized-degree proof need review." },
      manualChecks: [
        { stage: "apply", text: "Verify Assam permanent-resident certificate or Employment Exchange Registration Certificate, second-class recognized bachelor's degree, age 21–38 on 1 January 2026 or applicable SC/ST/OBC/MOBC/PwBD relaxation, and Form-A small-family declaration." },
        { stage: "selection", text: "Confirm later APSC selection notice, assigned test venue, required ID and original documents." },
        { stage: "outcome", text: "Confirm Government appointment terms, health checks and original-document verification." },
      ],
    },
    venues: [{ kind: "unknown", name: "Selection venue not assigned; notice lists possible zones only" }],
    sources: [
      evidenceSource(source, index.evidence, "APSC 2026 advertisement register, row 12/2026", "HTML", "English"),
      evidenceSource(source, corrigenda.evidence, "APSC 2026 corrigenda register", "HTML", "English"),
      evidenceSource(source, pdf.evidence, "APSC advertisement 12/2026 original notice", "PDF", "English"),
    ],
    applicationMethod: "online", applicationUrl: extraction.applicationUrl,
  });
  return { cycles: [cycle], evidence: [index.evidence, corrigenda.evidence, pdf.evidence], totalAvailable: totalRows,
    complete: false, warnings: [
      `Only APSC advertisement 12/2026 is extracted from ${totalRows} register rows; other advertisements and departments remain gaps.`,
      "No application cutoff hour, formal language level, appointment term or assigned exam venue appears in the checked notice.",
      "Founder must recheck portal, later amendments, Assam residence proof and category/age exceptions before approval.",
    ] };
};

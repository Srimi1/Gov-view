/** Ladakh 2026-27 Central Pool medical admission: exact notice and portal-bound draft. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { civilDateIn } from "../lib/time.ts";
import type { Connector, Evidence } from "./types.ts";
import { evidenceSource, makeCycle, stripTags } from "./util.ts";

interface Document { key: string; url: string; sha256: string }
interface Extraction {
  cycleId: string; indexUrl: string; portalUrl: string; applicationUrl: string;
  opensOn: string; closesOn: string; documents: Document[];
}
const extraction = JSON.parse(readFileSync(new URL("../data/extractions/ladakh-central-pool-2026.json", import.meta.url), "utf8")) as Extraction;
export const LADAKH_HME_INDEX = extraction.indexUrl;
export const LADAKH_HME_PORTAL = extraction.portalUrl;

/** Index identity, PDF link, and index date must still describe the same intake. */
export function checkLadakhAdmissionIndex(html: string): void {
  const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) => match[1]);
  const relevant = rows.filter((row) => /Central Pool MBBS\s*(?:&|&amp;)\s*BDS Seats/i.test(row) && /2026-27/.test(row));
  if (relevant.length !== 1 || !/758\)?\s*DHSL/i.test(stripTags(relevant[0])) || !/22\/09\/2026/.test(stripTags(relevant[0]))) {
    throw new Error("Ladakh Central Pool 758/2026 index row changed or amended; review required");
  }
  const links = [...relevant[0].matchAll(/<a\b[^>]*href=["']([^"']+\.pdf)["']/gi)].map((match) => match[1]);
  if (links.length !== 1 || links[0] !== extraction.documents[0].url) throw new Error("Ladakh Central Pool notice PDF link changed; review required");
}

/** Published application announcement controls dates; notice issue dates conflict. */
export function checkLadakhAdmissionPortal(html: string): void {
  const text = stripTags(html).replace(/\s+/g, " ");
  const windows = [...text.matchAll(/application process for Ladakh Central Pool Medical Seats for the academic year 2026-27 will be open from ([^.]+)\./gi)].map((match) => match[1].trim());
  if (!windows.length || windows.some((window) => window !== "23rd September 2026 to 29th September 2026")) {
    throw new Error("Ladakh HME application dates changed or disappeared; review required");
  }
  if (/Central Pool Medical Seats.{0,180}\b(?:extended|cancelled|postponed)\b/i.test(text)) {
    throw new Error("Ladakh HME material update needs review before reusing application dates");
  }
  const links = [...html.matchAll(/href=["']([^"']*uploads\/notifications\/[^"']+\.pdf)["']/gi)].map((match) => new URL(match[1], extraction.portalUrl).href);
  if (!links.length || links.some((url) => url !== extraction.documents[1].url)) throw new Error("Ladakh HME guidelines PDF link changed; review required");
}

export const ladakhHme: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("Ladakh HME scanned PDF fetch required");
  const index = await fetchText(LADAKH_HME_INDEX, { accept: "text/html" });
  const portal = await fetchText(LADAKH_HME_PORTAL, { accept: "text/html" });
  if (index.evidence.url !== LADAKH_HME_INDEX || portal.evidence.url !== LADAKH_HME_PORTAL) throw new Error("Ladakh HME official source redirected");
  checkLadakhAdmissionIndex(index.text);
  checkLadakhAdmissionPortal(portal.text);
  const documents = new Map<string, Evidence>();
  for (const document of extraction.documents) {
    const pdf = await fetchBytes(document.url, { accept: "application/pdf" });
    const hash = createHash("sha256").update(pdf.bytes).digest("hex");
    if (pdf.bytes.subarray(0, 5).toString() !== "%PDF-" || pdf.evidence.url !== document.url || pdf.evidence.sha256 !== hash || hash !== document.sha256) {
      throw new Error(`Ladakh HME ${document.key} PDF changed; dates and eligibility withheld`);
    }
    documents.set(document.key, pdf.evidence);
  }
  const today = civilDateIn("Asia/Kolkata", now);
  const status = today < extraction.opensOn ? "upcoming" : today > extraction.closesOn ? "closed" : "open";
  const cycle = makeCycle({
    id: extraction.cycleId,
    title: "Ladakh Central Pool MBBS/BDS admission 2026–27",
    cycleLabel: "Notification 758-DHSL/2026 · 2026–27",
    authority: source.authority,
    programme: "Ladakh Central Pool medical seats",
    pathway: "admission",
    jurisdictionCode: "IN",
    jurisdictionName: "India",
    subdivisionCodes: ["IN-LA"],
    scopeLabel: "Union Territory of Ladakh quota; allotted colleges are in other Indian states",
    outcome: "Selection for 7 MBBS or 2 BDS Central Pool seats, subject to NEET merit and college allotment",
    status,
    statusNote: "Official HME portal announces 23–29 September 2026 applications; closing clock time is not stated. Founder review pending.",
    applicationWindow: {
      opensOn: extraction.opensOn, closesOn: extraction.closesOn,
      officialTimeZone: "Asia/Kolkata", cutoffLocalTime: null, precision: "date",
      note: "Dates from the official HME portal. The scanned notice has conflicting issue dates (18 and 22 September) and only says within seven days; no cutoff clock time was published in checked sources.",
    },
    qualifications: "Valid NEET 2026 score at the minimum applicable category threshold, plus Government of India medical admission qualifications. Ladakh quota guideline requires child of a permanent Ladakh resident, or a qualifying posted-employee child who passed classes 10 and 12 at a recognized institution in Ladakh (notice pp. 15–16).",
    citizenshipRule: "Nationality is not stated in the Ladakh quota notice or amended local eligibility clause. Foreign-national Central Pool seats mentioned in general guidelines use a separate Ministry of External Affairs allocation; international-applicant eligibility for this Ladakh quota needs authority confirmation.",
    residenceRule: "Parent must meet the Ladakh permanent-resident route (15 years of residence), or the applicant must meet the posted-employee child route and Ladakh class 10/12 schooling conditions. Check original guidelines pp. 15–16; applicant's current address alone cannot decide this.",
    selectionStages: ["Online application plus signed/scanned documents to the notice email", "Eligibility and document scrutiny", "Common merit list by NEET 2026 rank", "College allotment by rank and stated preferences"],
    fee: "Application fee not stated in checked official notice; verify with authority.",
    rules: { complete: false, asOn: null, manualChecks: [
      { stage: "apply", text: "Confirm Ladakh parent-residence or posted-employee child route and class 10/12 records against amended guidelines pp. 15–16." },
      { stage: "selection", text: "Confirm valid NEET 2026 score, category threshold and application documents." },
      { stage: "outcome", text: "Confirm nationality permission, medical admission conditions, merit rank and allotted-college requirements." },
    ] },
    venues: [{ kind: "unknown", name: "NEET 2026 exam venue is not specified in this admission notice; allotted colleges are outcomes, not exam venues" }],
    sources: [
      evidenceSource(source, index.evidence, "Ladakh official notification register", "HTML", "English"),
      evidenceSource(source, portal.evidence, "Ladakh HME 2026–27 application announcement", "HTML", "English"),
      evidenceSource(source, documents.get("application-notice")!, "Notification 758-DHSL/2026 and amended local guidelines", "scanned PDF", "English"),
      evidenceSource(source, documents.get("portal-guidelines")!, "HME portal 2026–27 guidelines", "scanned PDF", "English"),
    ],
    applicationUrl: extraction.applicationUrl,
  });
  return { cycles: [cycle], evidence: [index.evidence, portal.evidence, ...documents.values()], complete: false, warnings: [
    "Notice heading has 18 and 22 September issue dates; official HME portal supplies explicit 23–29 September application window. Closing clock time remains unknown.",
    "One intake notice covers 7 MBBS and 2 BDS seats. Founder should confirm whether portal requires separate course applications before accepting cycle count.",
    "Nationality is not specified for this Ladakh quota. Foreign-national seats in general Central Pool guidelines belong to a different ministry allocation; do not infer eligibility here.",
    "No mandatory language level or certificate was found in checked notice or guidelines. NEET exam medium is not an admission language rule.",
    "Other Ladakh Administration admission and recruitment notices remain unextracted.",
  ] };
};

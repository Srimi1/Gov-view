/** Exact MPESB Police Constable 2026 rulebook and amendment; review-only. */
import { readFileSync } from "node:fs";
import { civilDateIn } from "../lib/time.ts";
import type { Connector, Evidence } from "./types.ts";
import { decodeEntities, evidenceSource, makeCycle, stripTags } from "./util.ts";

interface Extraction {
  homeUrl: string; formsUrl: string; rulebookUrl: string; rulebookSha256: string;
  revisedUrl: string; revisedSha256: string; applicationUrl: string;
  title: string; opensOn: string; closesOn: string; correctionClosesOn: string; examStartsOn: string;
}
const notice = JSON.parse(readFileSync(new URL("../data/extractions/mpesb-pcrt-2026.json", import.meta.url), "utf8")) as Extraction;

/** Bind exact public home row and both published rulebook links. */
export function verifyMpesbHome(html: string): void {
  const rows = [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .filter((match) => stripTags(match[1]).includes("Police Constable (G.D.) Recruitment Test - 2026"));
  const row = rows[0]?.[1] ?? "";
  const links = [...row.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({ url: new URL(decodeEntities(match[1]), notice.homeUrl).href, text: stripTags(match[2]).replace(/\s+/g, " ") }));
  if (rows.length !== 1 || !stripTags(row).includes("Start Date:22/09/2026") ||
      !links.some((link) => link.url === notice.formsUrl && link.text.includes("Online Form - Police Constable")) ||
      !links.some((link) => link.url === notice.rulebookUrl && link.text === "Rulebook") ||
      !links.some((link) => link.url === notice.revisedUrl && link.text === "Rulebook Revised Page-01")) {
    throw new Error("MPESB Police Constable home notice or amendment links changed; review required");
  }
}

/** MPOnline's active form row must still name one application, not correction-only service. */
export function verifyMpesbForm(html: string): void {
  const index = html.indexOf("आरक्षक (जी.डी.) के पद पर सीधी भर्ती हेतु चयन परीक्षा–2026");
  const next = html.indexOf("</tr>", index);
  const row = index < 0 || next < 0 ? "" : html.slice(index, html.indexOf("</tr>", next + 5));
  const text = stripTags(row).replace(/\s+/g, " ");
  const apply = /href="([^"]+notifications\.aspx\?[^\"]+)"[^>]*>\s*<img[^>]*title="आवेदन करे /i.exec(row)?.[1];
  const applyUrl = apply ? new URL(decodeEntities(apply), notice.formsUrl).href : null;
  if (!text.includes("आवेदन पत्र") || !text.includes("22 Sep 2026") || !text.includes("06 Oct 2026") ||
      !row.includes("PCRT_GD_2026_RuleBook_09092026.pdf") || applyUrl !== notice.applicationUrl) {
    throw new Error("MPOnline Police Constable application row changed; review required");
  }
}

function expectDocument(evidence: Evidence, expectedUrl: string, expectedHash: string): void {
  if (evidence.url !== expectedUrl || evidence.sha256 !== expectedHash || evidence.contentType.toLowerCase().includes("html")) {
    throw new Error(`MPESB original document changed at ${expectedUrl}; review required`);
  }
}

export const mpesbPcrt2026: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("MPESB connector needs exact-byte PDF fetching");
  const home = await fetchText(notice.homeUrl, { accept: "text/html" });
  const forms = await fetchText(notice.formsUrl, { accept: "text/html" });
  if (home.evidence.url !== notice.homeUrl || forms.evidence.url !== notice.formsUrl) throw new Error("MPESB official page redirected; review required");
  verifyMpesbHome(home.text);
  verifyMpesbForm(forms.text);
  const rulebook = await fetchBytes(notice.rulebookUrl, { accept: "application/pdf" });
  const revised = await fetchBytes(notice.revisedUrl, { accept: "application/pdf" });
  expectDocument(rulebook.evidence, notice.rulebookUrl, notice.rulebookSha256);
  expectDocument(revised.evidence, notice.revisedUrl, notice.revisedSha256);
  const pastEverywhere = civilDateIn("Etc/GMT+12", now) > notice.closesOn;
  const cycle = makeCycle({
    id: "mpesb-police-constable-gd-2026", sourceId: source.id,
    title: "Madhya Pradesh Police Constable (General Duty) — 2026",
    programme: notice.title, cycleLabel: "2026 · Police Constable GD",
    authority: "Police Headquarters, Home (Police) Department, Government of Madhya Pradesh",
    pathway: "recruitment", jurisdictionCode: "IN", jurisdictionName: "India", subdivisionCodes: ["IN-MP"],
    scopeLabel: "Direct recruitment to Madhya Pradesh Police Constable (GD). Madhya Pradesh is hiring jurisdiction, not an asserted exam venue or blanket domicile requirement.",
    outcome: "Possible appointment as Police Constable (General Duty) after written, physical and document checks; passing an exam alone is not appointment.",
    status: pastEverywhere ? "closed" : "open",
    statusNote: "MPESB and MPOnline give 22 September–6 October 2026 as new-application dates. 11 October is correction deadline only. No cutoff hour or official timezone is printed. Founder review pending.",
    applicationWindow: { opensOn: notice.opensOn, closesOn: notice.closesOn, cutoffLocalTime: null, officialTimeZone: null,
      precision: "date", note: "Both official form row and rulebook state 6 October for new applications. Separate correction window ends 11 October; it does not reopen applications." },
    qualifications: "Post-specific education, age, physical standards, document and category conditions are in the Hindi rulebook and require founder review. The first-stage written test is Hindi multiple-choice; physical efficiency and document verification follow.",
    citizenshipRule: "Original Hindi rulebook §3(i) states that an applicant must be an Indian citizen. No foreign-citizen application route is stated for this police recruitment.",
    residenceRule: "Revised first page mentions Madhya Pradesh domicile for certain fee concessions. That concession is not a blanket applicant domicile rule; any separate residence or category condition needs full rulebook review.",
    languageNote: "Rulebook §8–9 describes first-stage written multiple-choice questions in Hindi. It does not print a formal Hindi proficiency certificate or CEFR-type level; ability to take the Hindi paper needs applicant verification.",
    selectionStages: ["Online application", "First-stage Hindi multiple-choice written test", "Physical efficiency and document verification", "Medical and character checks before appointment"],
    fee: "Revised first page has category-specific examination and portal charges; amount and concession eligibility need founder confirmation before display as a personalized fee.",
    rules: { complete: false, asOn: null,
      nationality: { allowed: ["IN"], evidence: "Original MPESB Police Constable 2026 Hindi rulebook, §3(i): applicant must be an Indian citizen." },
      manualChecks: [
        { stage: "apply", text: "Verify rulebook age, education, category documents, fee and any residence condition. New applications end 6 October; correction-only service ends 11 October." },
        { stage: "selection", text: "Confirm ability to take Hindi MCQ paper and meet physical efficiency and document checks; no formal language level is printed." },
        { stage: "outcome", text: "Confirm medical, character and final police appointment criteria. Exam success alone is not appointment." },
      ] },
    venues: [{ kind: "unknown", name: "Exam and physical-test venues not confirmed from checked notice pages" }],
    sources: [
      evidenceSource(source, home.evidence, "MPESB current Police Constable form and rulebook links", "HTML", "English/Hindi"),
      evidenceSource(source, forms.evidence, "MPOnline Police Constable 2026 application row", "HTML", "Hindi"),
      evidenceSource(source, rulebook.evidence, "Police Constable GD 2026 original rulebook", "PDF", "Hindi"),
      evidenceSource(source, revised.evidence, "Police Constable GD 2026 revised first page", "scanned PDF", "Hindi"),
    ],
    applicationMethod: "online", applicationUrl: notice.applicationUrl,
  });
  return { cycles: [cycle], evidence: [home.evidence, forms.evidence, rulebook.evidence, revised.evidence], complete: false, warnings: [
    "Pilot covers one MPESB Police Constable intake only; other MPESB and MPPSC recruitment remain gaps.",
    "Revised first page is scanned and exact-hash pinned. Founder must confirm its fee/category text and check later amendments.",
    "Hindi is printed as written-test medium, not a formal proficiency level. Exam and physical-test venues are not asserted from work jurisdiction.",
  ] };
};

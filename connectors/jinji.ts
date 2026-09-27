/** National Personnel Authority: only extract guides whose exact PDF was checked. */
import type { Connector } from "./types.ts";
import { evidenceSource, makeCycle, stripTags } from "./util.ts";

const LIST = "https://www.jinji.go.jp/saiyo/siken/jyukennannnaiichiran.html";
const BASE = "https://www.jinji.go.jp";
const GENERAL_EDUCATION_2026 = `${BASE}/content/900036094.pdf`;
// SHA-256 of the official 12-page 2026 guide. A revision needs fresh extraction and review.
const GENERAL_EDUCATION_SHA256 = "743add69aa699f3126d2003c9f2e4b80534dbd32dc0f9b00a9b651dc2a13512e";

export interface GuideEntry { name: string; pdf: string; level: "university" | "high-school" }

/** Each table row with a guide link; group names from earlier rows carry down (rowspan). */
export function parseGuides(html: string): GuideEntry[] {
  const entries: GuideEntry[] = [];
  const tables = html.split(/<table/i).slice(1);
  for (const table of tables) {
    let group = "";
    for (const row of table.split(/<tr/i).slice(1)) {
      const cells = row.split(/<t[dh]/i).slice(1);
      const pdf = /href="([^"]+\.pdf)"/i.exec(row)?.[1];
      const texts = cells.map((cell) => stripTags(`<x${cell}`).replace(/\s+/g, "")).filter((text) => text && !/受験案内|^\d+／\d+$|^[０-９\d]+／[０-９\d]+$/.test(text));
      // A cell naming the exam family ("国家公務員採用…試験" or "専門職試験…") starts a new group.
      const groupText = texts.find((text) => /^国家公務員採用|^専門職試験/.test(text));
      if (groupText) group = groupText;
      if (!pdf) continue;
      const name = texts.filter((text) => text !== groupText).join(" ");
      const title = [group, name].filter(Boolean).join(" ").trim() || "国家公務員採用試験";
      entries.push({ name: title, pdf: new URL(pdf, BASE).toString(), level: /高卒/.test(title) ? "high-school" : "university" });
    }
  }
  return entries;
}

export const jinji: Connector = async ({ source, fetchText, fetchBytes }) => {
  const page = await fetchText(LIST, { accept: "text/html" });
  const guides = parseGuides(page.text);
  const guide = guides.find((entry) => entry.pdf === GENERAL_EDUCATION_2026 && /大卒程度試験（秋）（教養区分）/.test(entry.name));
  if (!guide) return { cycles: [], evidence: [page.evidence], complete: false, warnings: ["2026 general education guide missing from official index; no cycle extracted."] };
  if (!fetchBytes) throw new Error("Jinji connector needs exact-byte PDF fetch");
  const pdf = await fetchBytes(guide.pdf, { accept: "application/pdf" });
  if (pdf.evidence.sha256 !== GENERAL_EDUCATION_SHA256) {
    return { cycles: [], evidence: [page.evidence, pdf.evidence], complete: false, warnings: ["Official 2026 guide PDF changed; recheck dates and eligibility before extraction."] };
  }
  const cycle = makeCycle({
    id: "jinji-comprehensive-general-education-2026",
    title: "国家公務員採用総合職試験（大卒程度試験・秋・教養区分）2026",
    cycleLabel: "2026",
    authority: "人事院 (National Personnel Authority)",
    programme: "National Civil Service Comprehensive Service Exam — General Education",
    pathway: "recruitment",
    status: "closed",
    statusNote: "Online applications closed 24 August 2026. Candidate record awaits founder review.",
    jurisdictionCode: "JP",
    jurisdictionName: "Japan",
    scopeLabel: "National public service",
    outcome: "Eligibility for appointment to policy planning or research roles; passing the exam alone does not guarantee appointment.",
    applicationWindow: { opensOn: "2026-07-31", closesOn: "2026-08-24", officialTimeZone: "Asia/Tokyo", cutoffLocalTime: null, precision: "date", note: "Opens at 09:00 JST on 31 July. Guide gives no closing clock time; data must be received by 24 August." },
    qualifications: "Born 2 April 1996–1 April 2007; or born on/after 2 April 2007 with a university degree, expected graduation by March 2027, or equivalent qualification recognized by the authority (guide p. 2).",
    citizenshipRule: "Japanese nationality is required to sit this exam. The guide does not separately establish whether a non-Japanese person can submit the online form. Japanese citizens who also hold foreign nationality cannot become diplomatic civil servants (guide p. 2). Foreign university graduates still need Japanese nationality.",
    residenceRule: "Residence condition not stated in checked guide; verify with authority.",
    selectionStages: ["First exam: basic ability and general essay (4 October 2026)", "Second exam: policy proposal, discussion and interview (24–27 November 2026)", "Optional external English score may add 15 or 25 points; TOEFL iBT, TOEIC L&R, IELTS or Eiken (guide pp. 4, 11–12). No mandatory English score or JLPT level stated."],
    fee: "Fee not stated in checked guide; verify with authority.",
    rules: {
      asOn: null,
      nationality: { allowed: ["JP"], stage: "selection", evidence: "2026 guide p. 2: 日本の国籍を有しない者は受験できません (people without Japanese nationality cannot sit this exam)." },
      manualChecks: [
        { stage: "apply", text: "Check the guide's birth-date and degree alternatives on p. 2. Online form access for non-Japanese applicants is not separately established; Japanese nationality is required for examination." },
        { stage: "selection", text: "Check other statutory disqualifications on p. 2 and exam requirements on pp. 3–4." },
        { stage: "outcome", text: "Confirm appointing ministry requirements; dual nationality bars diplomatic civil service (guide p. 2)." },
      ],
    },
    venues: [{ kind: "unknown", name: "Exam city choices listed in guide p. 3; street venues not confirmed" }],
    sources: [
      evidenceSource(source, pdf.evidence, "2026 comprehensive service general education guide (受験案内)", "PDF", "Japanese", guide.pdf),
      { ...evidenceSource(source, page.evidence, "List of exam guides", "HTML", "Japanese", LIST), id: `${source.id}:list` },
    ],
    applicationUrl: "https://www.jinji-shiken.go.jp/juken.html",
  });
  return {
    cycles: [cycle], evidence: [page.evidence, pdf.evidence], complete: false,
    totalAvailable: guides.length,
    warnings: [`Only 1 of ${guides.length} linked guides has a checked PDF extraction; other exam cycles remain a coverage gap.`],
  };
};

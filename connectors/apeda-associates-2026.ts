/** Two APEDA August associate contracts, discovered through NCS; review-only. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { civilDateIn } from "../lib/time.ts";
import type { Connector, Evidence } from "./types.ts";
import { evidenceSource, makeCycle, stripTags } from "./util.ts";

interface Role {
  id: string; name: string; noticeOn: string; closesOn: string;
  cutoffLocalTime: string | null; pdfUrl: string; pdfSha256: string;
  qualifications: string; salary: string; languageNote: string;
}
interface Extraction {
  indexUrl: string; archiveUrl: string;
  indexRowsSha256: string; archiveRowsSha256: string;
  indexRowCount: number; archiveRowCount: number; roles: Role[];
}
const data = JSON.parse(readFileSync(new URL("../data/extractions/apeda-associates-2026.json", import.meta.url), "utf8")) as Extraction;
const digest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

/** Bind visible document rows, ignoring unrelated navigation and counters. */
export function apedaDocumentRows(html: string): { text: string; urls: string[] }[] {
  return [...html.matchAll(/<div class="itmelist">([\s\S]*?)<\/div>/g)].map((match) => ({
    text: stripTags(match[1]).replace(/\s+/g, " ").trim(),
    urls: [...match[1].matchAll(/href="([^"]+)"/g)].map((link) => new URL(link[1], data.indexUrl).href),
  }));
}

export function verifyApedaPages(index: string, archive: string): void {
  const current = apedaDocumentRows(index);
  const previous = apedaDocumentRows(archive);
  if (!index.includes('href="/recruitment-appointment-archive"') ||
      current.length !== data.indexRowCount || previous.length !== data.archiveRowCount ||
      digest(JSON.stringify(current)) !== data.indexRowsSha256 ||
      digest(JSON.stringify(previous)) !== data.archiveRowsSha256) {
    throw new Error("APEDA document rows changed; possible amendment or edition needs review");
  }
  for (const role of data.roles) {
    const rows = current.filter((row) => row.urls.includes(role.pdfUrl));
    if (rows.length !== 1 || !rows[0].text.toLowerCase().includes(`associate (${role.name.toLowerCase()}) (on contract)`)) {
      throw new Error(`APEDA ${role.name} notice link or contract label changed`);
    }
  }
}

function verifyPdf(bytes: Buffer, evidence: Evidence, role: Role): void {
  if (bytes.subarray(0, 5).toString() !== "%PDF-" || evidence.url !== role.pdfUrl ||
      digest(bytes) !== role.pdfSha256 || evidence.sha256 !== role.pdfSha256) {
    throw new Error(`APEDA ${role.name} PDF changed; extracted fields withheld`);
  }
}

export const apedaAssociates2026: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("APEDA original PDF bytes required");
  const index = await fetchText(data.indexUrl, { accept: "text/html" });
  const archive = await fetchText(data.archiveUrl, { accept: "text/html" });
  if (index.evidence.url !== data.indexUrl || archive.evidence.url !== data.archiveUrl) {
    throw new Error("APEDA source page redirected; review required");
  }
  verifyApedaPages(index.text, archive.text);
  const evidence = [index.evidence, archive.evidence];
  const cycles = [];
  for (const role of data.roles) {
    const pdf = await fetchBytes(role.pdfUrl, { accept: "application/pdf" });
    verifyPdf(pdf.bytes, pdf.evidence, role);
    evidence.push(pdf.evidence);
    // No official timezone is printed. Close only after every civil timezone
    // has passed the date; do not convert the Legal notice's 17:00 into UTC.
    const latestDate = civilDateIn("Etc/GMT+12", now);
    const earliestDate = civilDateIn("Pacific/Kiritimati", now);
    const status = latestDate > role.closesOn ? "closed" as const :
      earliestDate < role.closesOn && latestDate >= role.noticeOn ? "open" as const : "uncertain" as const;
    cycles.push(makeCycle({
      id: role.id, sourceId: source.id,
      title: `Associate (${role.name}) — APEDA`,
      programme: `APEDA Associate (${role.name}) contract recruitment`,
      cycleLabel: `Notice ${role.noticeOn} · PAD-2023-24-000091`, authority: source.authority,
      pathway: "recruitment", appointmentType: "contract", jurisdictionCode: "IN", jurisdictionName: "India",
      subdivisionCodes: ["IN-DL"],
      scopeLabel: "Central-government autonomous authority contract in New Delhi; location does not establish applicant domicile or interview venue.",
      outcome: `One Associate (${role.name}) vacancy. Initial one-year contract includes three-week probation; performance-based yearly extensions cannot exceed three years. No right to subsequent government employment.`,
      status, statusNote: "Original August notice and current/archive indexes retained. NCS still lists this notice after its printed deadline. No approval recorded; later document-row changes stop extraction.",
      applicationWindow: { opensOn: null, closesOn: role.closesOn, cutoffLocalTime: role.cutoffLocalTime,
        officialTimeZone: null, precision: role.cutoffLocalTime ? "minute" : "date",
        note: `Notice gives ${role.closesOn}${role.cutoffLocalTime ? " by 1700 hrs" : " without a cutoff time"}. Official timezone is not stated. Notice date is not a confirmed opening date. Office hours are not an application cutoff.` },
      qualifications: `${role.qualifications} Upper age limit 45; notice gives no age reckoning date or relaxation rules.`,
      citizenshipRule: "Notice does not specify permitted citizenships or an international-applicant route. Nationality field on form is not permission; verify with APEDA.",
      residenceRule: "No applicant domicile or residence requirement stated. New Delhi is work location; international appointment/work authorization requires verification.",
      languageNote: role.languageNote,
      salary: role.salary,
      fee: "No application fee stated in retained notice; confirm with APEDA.",
      selectionStages: ["Email one typed and signed prescribed application, scanned CV and self-attested documents; mention position applied for", "APEDA screening; only shortlisted candidates contacted by email for interview", "Interview arrangements communicated separately", "Qualification and experience verification, police verification report and medical fitness certificate before engagement"],
      rules: { complete: false, asOn: null,
        manualChecks: [
          { stage: "apply", text: `Verify citizenship route, age reckoning date, required ${role.name === "Legal" ? "LL.B. and relevant experience, intellectual-property knowledge and communication skills" : "Master's discipline, post-Master's experience, visualization tools and office software"}; complete prescribed form and deadline procedure.` },
          { stage: "selection", text: "Minimum qualifications do not guarantee interview. Confirm shortlist, venue and any language expectations; no formal language level is printed." },
          { stage: "outcome", text: "Verify international work authorization, document checks, police verification, medical fitness and final contract terms; no permanent employment right." },
        ],
      },
      workLocations: ["APEDA, New Delhi"],
      venues: [{ kind: "unknown", name: "Interview venue not published; APEDA office address is not an interview location" }],
      sources: [
        evidenceSource(source, index.evidence, "APEDA recruitment and appointment index", "HTML", "English"),
        evidenceSource(source, archive.evidence, "APEDA recruitment archive: separate prior editions", "HTML", "English"),
        evidenceSource(source, pdf.evidence, `APEDA Associate (${role.name}) notice ${role.noticeOn} and prescribed form`, "PDF", "English"),
      ],
      applicationMethod: "email", applicationUrl: role.pdfUrl,
    }));
  }
  return { cycles, evidence, complete: false, warnings: [
    "Two separate role-specific applications count as two cycles, despite shared file number PAD-2023-24-000091. NCS posting date and vacancy counts are not cycle identifiers.",
    "Both August deadlines have passed. Legal gives 1700 hrs without an official timezone; Trade gives only a date. No timezone or midnight cutoff inferred.",
    "Nationality and languages-known form fields establish no foreign-applicant permission or mandatory language level. Age reckoning date is unstated; eligibility remains manual.",
    "Current index has seven document rows and archive has 206. Only these two August notices were extracted; other advertisements, prior editions and linked result notices remain gaps.",
    "Any current/archive document-row change or original PDF byte change stops extraction for review; no disappearance is interpreted as cancellation.",
  ] };
};

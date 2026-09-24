/**
 * National Personnel Authority (人事院, Japan) — list of exam guides for the
 * national public service recruitment exams. Application dates are printed in
 * each guide (PDF), so records arrive as "being checked" until a reviewer
 * enters the dates from the guide.
 */
import type { OpportunityCycle } from "../lib/opportunities.ts";
import type { Connector } from "./types.ts";
import { evidenceSource, makeCycle, shortHash, stripTags } from "./util.ts";

const LIST = "https://www.jinji.go.jp/saiyo/siken/jyukennannnaiichiran.html";
const BASE = "https://www.jinji.go.jp";

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

export const jinji: Connector = async ({ source, fetchText }) => {
  const page = await fetchText(LIST, { accept: "text/html" });
  const guides = parseGuides(page.text);
  const cycles: OpportunityCycle[] = guides.map((guide) => makeCycle({
    id: `jinji-${shortHash(guide.pdf, 10)}`,
    title: guide.name,
    authority: "人事院 (National Personnel Authority)",
    programme: "国家公務員採用試験 — national public service recruitment exam",
    pathway: "recruitment",
    status: "uncertain",
    statusNote: "Application dates are in the exam guide (PDF). A reviewer adds them after checking the guide.",
    jurisdictionCode: "JP",
    jurisdictionName: "Japan",
    scopeLabel: "National public service",
    outcome: "Appointment as a national public servant",
    applicationWindow: { opensOn: null, closesOn: null, officialTimeZone: "Asia/Tokyo", cutoffLocalTime: null, precision: "unknown" },
    qualifications: guide.level === "high-school" ? "High-school level exam — age limits apply (see the guide)." : "University level exam — age and degree conditions in the guide.",
    citizenshipRule: "Japanese nationality is required for national public service exams.",
    residenceRule: "No residence requirement.",
    selectionStages: ["First exam (written)", "Second exam (interview and others)", "Ministry interviews"],
    fee: "Free to apply.",
    rules: {
      asOn: null,
      nationality: { allowed: ["JP"], evidence: "受験案内：日本の国籍を有しない者は受験できません (people without Japanese nationality cannot take the exam)." },
    },
    venues: [{ kind: "unknown", name: "Exam cities are listed in the guide" }],
    sources: [
      evidenceSource(source, page.evidence, "Exam guide (受験案内, PDF)", "PDF", "Japanese", guide.pdf),
      { ...evidenceSource(source, page.evidence, "List of exam guides", "HTML", "Japanese", LIST), id: `${source.id}:list` },
    ],
    applicationUrl: "https://www.jinji-shiken.go.jp/juken.html",
  }));
  return { cycles, evidence: [page.evidence], warnings: cycles.length ? [] : ["No exam guides found — page layout may have changed."] };
};

#!/usr/bin/env node
/** Official Employment News table -> research leads, never applicant listings. */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { politeFetchText } from "../connectors/http.ts";
import { assertAllowedSourceUrl, assertNoCandidateListText } from "../connectors/privacy.ts";
import { stripTags } from "../connectors/util.ts";
import { isIsoDate } from "../lib/time.ts";

export const EMPLOYMENT_NEWS_URL = "https://employmentnews.gov.in/newemp/AllJobs.aspx?k=All";

export interface EmploymentNewsLead {
  id: string;
  issueDate: string;
  issueDateRaw: string;
  organisation: string;
  post: string;
  appointmentMethod: string;
  /** Reported by discovery journal; must be checked against hiring authority. */
  reportedDeadline: string;
  verification: "authority-not-checked";
}

function date(value: string, order: "month-first" | "day-first"): string {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!match) throw new Error(`Invalid Employment News date: ${value}`);
  const month = order === "month-first" ? match[1] : match[2];
  const day = order === "month-first" ? match[2] : match[1];
  const iso = `${match[3]}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  if (!isIsoDate(iso)) throw new Error(`Invalid Employment News date: ${value}`);
  return iso;
}

/** Parse only the All JOBS table, validating all rows before returning any lead. */
export function parseEmploymentNews(html: string): EmploymentNewsLead[] {
  const heading = /<h4\b[^>]*>\s*All JOBS\s*<\/h4>/i.exec(html);
  if (!heading) throw new Error("Employment News All JOBS heading missing");
  const afterHeading = html.slice(heading.index + heading[0].length);
  const table = /<table\b[^>]*>([\s\S]*?)<\/table>/i.exec(afterHeading)?.[1];
  if (!table) throw new Error("Employment News jobs table missing");
  const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((row) => [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => stripTags(cell[1]).replace(/\s+/g, " ").trim()));
  // ASP.NET template leaves one empty trailing table row after the repeater.
  if (rows.at(-1)?.length === 1 && rows.at(-1)?.[0] === "") rows.pop();
  if (!rows.length || rows[0].length !== 5 ||
      rows[0][0].indexOf("ISSUED DATE") < 0 || rows[0][4].indexOf("LAST DATE") < 0) {
    throw new Error("Employment News table columns changed");
  }
  if (rows.length < 2) throw new Error("Employment News table has no leads; inspect source before clearing previous snapshot");
  // Header claims MM/DD/YYYY, but this official snapshot includes 31/08 and
  // 24/08. Those cannot be month-first. Stop if future rows lose this proof.
  if (!rows.slice(1).some((cells) => Number(cells[0]?.split("/")[0]) > 12)) {
    throw new Error("Employment News issue-date order ambiguous; inspect conflicting header");
  }
  const seen = new Set<string>();
  return rows.slice(1).map((cells) => {
    if (cells.length !== 5 || cells.slice(1, 4).some((value) => !value)) {
      throw new Error("Employment News row shape changed");
    }
    const issueDateRaw = cells[0];
    const issueDate = date(issueDateRaw, "day-first");
    const reportedDeadline = date(cells[4], "day-first");
    const [organisation, post, appointmentMethod] = cells.slice(1, 4);
    const identity = `${issueDate}|${organisation.toLowerCase()}|${post.toLowerCase()}|${appointmentMethod.toLowerCase()}`;
    const id = `en-${createHash("sha256").update(identity).digest("hex").slice(0, 16)}`;
    if (seen.has(id)) throw new Error("Employment News duplicate lead identity; review rows");
    seen.add(id);
    return { id, issueDate, issueDateRaw, organisation, post, appointmentMethod, reportedDeadline,
      verification: "authority-not-checked" as const };
  });
}

function writeAtomically(path: string, text: string) {
  const temp = `${path}.tmp`;
  writeFileSync(temp, text);
  renameSync(temp, path);
}

async function main() {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const directory = join(root, "data/discovery");
  const outputPath = join(directory, "in-employment-news.json");
  if (!process.argv.includes("--force") && existsSync(outputPath)) {
    const previous = JSON.parse(readFileSync(outputPath, "utf8")) as { evidence?: { fetchedAt?: string } };
    const last = Date.parse(previous.evidence?.fetchedAt ?? "");
    const age = Date.now() - last;
    if (Number.isFinite(age) && age >= 0 && age < 24 * 3_600_000) {
      console.log("Employment News discovery not due; previous lead snapshot retained.");
      return;
    }
  }
  assertAllowedSourceUrl(EMPLOYMENT_NEWS_URL);
  const response = await politeFetchText(EMPLOYMENT_NEWS_URL, { accept: "text/html" });
  if (response.evidence.url !== EMPLOYMENT_NEWS_URL) throw new Error("Employment News source redirected; inspect before using leads");
  assertNoCandidateListText(response.text, response.evidence.contentType, response.evidence.url);
  const leads = parseEmploymentNews(response.text);
  const evidenceDirectory = join(root, "data/evidence/bodies/in-employment-news-discovery");
  mkdirSync(evidenceDirectory, { recursive: true });
  const evidenceFile = join(evidenceDirectory, `${response.evidence.sha256}.txt.gz`);
  if (!existsSync(evidenceFile)) writeFileSync(evidenceFile, gzipSync(response.bytes ?? Buffer.from(response.text)));
  mkdirSync(directory, { recursive: true });
  writeAtomically(outputPath, `${JSON.stringify({
    sourceUrl: EMPLOYMENT_NEWS_URL,
    sourceKind: "official-discovery-journal",
    listingStatus: "research-leads-only",
    issueDateFormat: "day-first-inferred-from-unambiguous-rows; page-header-conflicts",
    evidence: response.evidence,
    observedRows: leads.length,
    leads,
    note: "Employment News is a Government of India discovery journal. Its issue-date header says MM/DD/YYYY, but rows such as 31/08/2026 prove this snapshot uses day-first; raw strings are retained. Table has no hiring-authority notice links or applicant eligibility rules. Reported dates and methods must be checked against each authority before any application cycle enters founder review. These leads never enter public search or map counts.",
  }, null, 2)}\n`);
  console.log(`Saved ${leads.length} Employment News research leads; 0 applicant cycles published.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error((error as Error).message); process.exitCode = 1; });
}

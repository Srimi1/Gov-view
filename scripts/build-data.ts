#!/usr/bin/env node
/**
 * Turns the reviewed records in data/published/ into small static files the
 * browser loads on demand. Runs before `next build` (npm "prebuild").
 *
 *   public/data/index.json            counts per country, build time
 *   public/data/list/<CC>.json        compact records for list, map and filters
 *   public/data/detail/<CC>-<n>.json  full records, a few hundred per file
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { EligibilityRules } from "../lib/eligibility/types.ts";
import type { CycleSummary, OpportunityCycle } from "../lib/opportunities.ts";

/** Rules without their quotes: the list only needs the verdict; the detail view shows the evidence. */
function leanRules(rules: EligibilityRules | null): EligibilityRules | null {
  if (!rules) return null;
  const strip = <T extends { evidence: string } | undefined>(rule: T): T => (rule ? { ...rule, evidence: "" } : rule);
  return {
    ...rules,
    age: strip(rules.age),
    education: strip(rules.education),
    nationality: strip(rules.nationality),
    residence: strip(rules.residence),
    attempts: strip(rules.attempts),
    experience: strip(rules.experience),
    // Language evaluation requires the evidence and source, even in list summaries.
    languages: rules.languages,
    manualChecks: rules.manualChecks?.map((check) => ({ ...check, text: "" })),
  };
}

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SOURCE = join(ROOT, "data/published/cycles");
const OUT = join(ROOT, "public/data");
const SHARD_SIZE = 300;

export function summarize(item: OpportunityCycle, shard: number): CycleSummary {
  return {
    id: item.id,
    fixture: item.fixture,
    title: item.title,
    authority: item.authority,
    programme: item.programme,
    pathway: item.pathway,
    status: item.status,
    jurisdictionCode: item.jurisdictionCode,
    jurisdictionName: item.jurisdictionName,
    ...(item.subdivisionCodes?.length ? { subdivisionCodes: item.subdivisionCodes } : {}),
    scopeLabel: item.scopeLabel,
    outcome: item.outcome,
    applicationWindow: item.applicationWindow,
    rules: leanRules(item.rules),
    // Only pinned venues matter for the map; names are shortened.
    venues: item.venues.filter((venue) => venue.kind === "published").map((venue) => (venue.kind === "published" ? { ...venue, name: "" } : venue)),
    // The two latest changes are enough for "recently updated".
    changes: item.changes.slice(-2).map(({ at, kind }) => ({ at, kind, summary: "" })),
    shard,
  };
}

function main() {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(join(OUT, "list"), { recursive: true });
  mkdirSync(join(OUT, "detail"), { recursive: true });
  const countries: { code: string; count: number }[] = [];
  const files = existsSync(SOURCE) ? readdirSync(SOURCE).filter((file) => /^[A-Z]{2}\.json$/.test(file)) : [];
  for (const file of files) {
    const code = file.slice(0, 2);
    const records = JSON.parse(readFileSync(join(SOURCE, file), "utf8")) as OpportunityCycle[];
    if (!records.length) continue;
    const summaries: CycleSummary[] = [];
    for (let start = 0, shard = 0; start < records.length; start += SHARD_SIZE, shard += 1) {
      const chunk = records.slice(start, start + SHARD_SIZE);
      writeFileSync(join(OUT, "detail", `${code}-${shard}.json`), JSON.stringify(chunk));
      for (const record of chunk) summaries.push(summarize(record, shard));
    }
    writeFileSync(join(OUT, "list", `${code}.json`), JSON.stringify(summaries));
    countries.push({ code, count: records.length });
  }
  const total = countries.reduce((sum, country) => sum + country.count, 0);
  writeFileSync(join(OUT, "index.json"), JSON.stringify({ generatedAt: new Date().toISOString(), total, countries }));
  console.log(`public/data: ${total} records across ${countries.length} countries`);
}

main();

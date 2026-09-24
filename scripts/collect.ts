#!/usr/bin/env node
/**
 * Collects opportunities from every due source in sources/registry.json and
 * writes reviewed-by-PR data files. Free to run: GitHub Actions calls it on a
 * schedule and opens a pull request with the changes.
 *
 *   node --experimental-strip-types scripts/collect.ts                 all due sources
 *   node --experimental-strip-types scripts/collect.ts --source in-upsc,in-ssc
 *   node --experimental-strip-types scripts/collect.ts --force         ignore cadence
 *   node --experimental-strip-types scripts/collect.ts --dry-run       print, write nothing
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { connectors } from "../connectors/index.ts";
import { politeFetchText } from "../connectors/http.ts";
import { markFailedRun, mergeSuccessfulRun } from "../connectors/merge.ts";
import { MissingSecretError, type Evidence, type SourceConfig } from "../connectors/types.ts";
import type { CoverageRecord, OpportunityCycle } from "../lib/opportunities.ts";
import { civilDateIn } from "../lib/time.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PUBLISHED = join(ROOT, "data/published");
const CYCLES_DIR = join(PUBLISHED, "cycles");
const STATUS_FILE = join(PUBLISHED, "sources-status.json");
const OVERRIDES_DIR = join(ROOT, "data/overrides");
const EVIDENCE_DIR = join(ROOT, "data/evidence");

interface SourceStatus {
  lastAttemptAt: string | null;
  lastSuccessfulFetchAt: string | null;
  lastError: string | null;
  consecutiveFailures: number;
  recordCount: number;
  totalAvailable?: number;
  needsSecret?: string[];
}

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};
const dryRun = flag("dry-run");
const force = flag("force");
const only = option("source")?.split(",").map((id) => id.trim()).filter(Boolean);

const readJson = <T>(path: string, fallback: T): T => (existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) as T : fallback);

/** One record per line keeps pull-request diffs readable and reviewable. */
function writeRecords(path: string, records: unknown[]) {
  writeFileSync(path, `[\n${records.map((record) => JSON.stringify(record)).join(",\n")}\n]\n`);
}

function loadOverrides(): Map<string, Partial<OpportunityCycle>> {
  const overrides = new Map<string, Partial<OpportunityCycle>>();
  if (!existsSync(OVERRIDES_DIR)) return overrides;
  for (const file of readdirSync(OVERRIDES_DIR)) {
    if (!file.endsWith(".json")) continue;
    const value = JSON.parse(readFileSync(join(OVERRIDES_DIR, file), "utf8")) as Partial<OpportunityCycle>;
    overrides.set(file.replace(/\.json$/, ""), value);
  }
  return overrides;
}

async function main() {
  const registry = readJson<{ sources: SourceConfig[] }>(join(ROOT, "sources/registry.json"), { sources: [] });
  const status = readJson<Record<string, SourceStatus>>(STATUS_FILE, {});
  const overrides = loadOverrides();
  const now = new Date();
  const byCountry = new Map<string, OpportunityCycle[]>();
  const countryFile = (country: string) => join(CYCLES_DIR, `${country}.json`);
  const recordsFor = (country: string) => {
    if (!byCountry.has(country)) byCountry.set(country, readJson<OpportunityCycle[]>(countryFile(country), []));
    return byCountry.get(country)!;
  };

  const due = registry.sources.filter((source) => {
    if (only) return only.includes(source.id);
    if (!source.enabled || !connectors[source.connector]) return false;
    const last = status[source.id]?.lastAttemptAt;
    return force || !last || now.getTime() - Date.parse(last) >= source.cadenceHours * 3_600_000 * 0.9;
  });
  if (!due.length) {
    console.log("No sources due.");
    return;
  }

  let failures = 0;
  for (const source of due) {
    const connector = connectors[source.connector];
    const previousStatus: SourceStatus = status[source.id] ?? { lastAttemptAt: null, lastSuccessfulFetchAt: null, lastError: null, consecutiveFailures: 0, recordCount: 0 };
    const all = recordsFor(source.country);
    const mine = all.filter((item) => item.sourceId === source.id);
    const others = all.filter((item) => item.sourceId !== source.id);
    const started = Date.now();
    console.log(`\n▸ ${source.id} (${source.name})`);
    if (!connector) {
      console.log("  no connector — skipped");
      continue;
    }
    try {
      const result = await connector({
        source,
        now,
        env: process.env,
        fetchText: (url, init) => politeFetchText(url, { ...init, ignoreRobotsFor: source.robotsException?.hosts }),
        log: (message) => console.log(`  ${message}`),
      });
      for (const warning of result.warnings) console.warn(`  ⚠ ${warning}`);
      if (!result.cycles.length && mine.length > 5) {
        // An empty answer from a source that normally has records is treated as a failure, not as "everything closed".
        throw new Error("Source returned no records; keeping previous data");
      }
      const merged = mergeSuccessfulRun({
        sourceId: source.id,
        previous: mine,
        fresh: result.cycles,
        overrides,
        now,
        today: (item) => civilDateIn(item.applicationWindow.officialTimeZone, now),
      });
      byCountry.set(source.country, [...others, ...merged].sort((a, b) => a.id.localeCompare(b.id)));
      status[source.id] = {
        lastAttemptAt: now.toISOString(),
        lastSuccessfulFetchAt: now.toISOString(),
        lastError: null,
        consecutiveFailures: 0,
        recordCount: merged.length,
        ...(result.totalAvailable && result.totalAvailable > result.cycles.length ? { totalAvailable: result.totalAvailable } : {}),
      };
      if (!dryRun) writeEvidence(source.id, result.evidence);
      console.log(`  ✓ ${result.cycles.length} collected, ${merged.length} kept (${Math.round((Date.now() - started) / 1000)}s)`);
      if (dryRun) for (const cycle of result.cycles.slice(0, 3)) console.log(`    · ${cycle.title} — closes ${cycle.applicationWindow.closesOn ?? "?"}`);
    } catch (error) {
      const missing = error instanceof MissingSecretError ? error.names : undefined;
      if (!missing) failures += 1;
      const consecutiveFailures = missing ? previousStatus.consecutiveFailures : previousStatus.consecutiveFailures + 1;
      byCountry.set(source.country, [...others, ...markFailedRun(mine, consecutiveFailures, previousStatus.lastSuccessfulFetchAt)].sort((a, b) => a.id.localeCompare(b.id)));
      status[source.id] = { ...previousStatus, lastAttemptAt: now.toISOString(), lastError: (error as Error).message, consecutiveFailures, ...(missing ? { needsSecret: missing } : {}) };
      console.error(`  ✗ ${missing ? `skipped — set ${missing.join(", ")}` : (error as Error).message}`);
    }
  }

  if (dryRun) {
    console.log("\nDry run: nothing written.");
    return;
  }
  mkdirSync(CYCLES_DIR, { recursive: true });
  for (const [country, records] of byCountry) writeRecords(countryFile(country), records);
  writeFileSync(STATUS_FILE, `${JSON.stringify(status, null, 2)}\n`);
  writeCoverage(registry.sources, status);
  // Fail the job only if every due source failed, so one broken site doesn't block the rest.
  if (failures && failures === due.length) process.exitCode = 1;
}

function writeEvidence(sourceId: string, evidence: Evidence[]) {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  writeFileSync(join(EVIDENCE_DIR, `${sourceId}.json`), `${JSON.stringify(evidence.map(({ url, fetchedAt, sha256, bytes, contentType }) => ({ url, fetchedAt, sha256, bytes, contentType })), null, 1)}\n`);
}

function writeCoverage(sources: SourceConfig[], status: Record<string, SourceStatus>) {
  const countries = [...new Set(sources.map((source) => source.country))];
  const coverage: CoverageRecord[] = countries.map((country) => {
    const mine = sources.filter((source) => source.country === country);
    const connected = mine.filter((source) => source.enabled && status[source.id]?.lastSuccessfulFetchAt);
    const count = readJson<OpportunityCycle[]>(join(CYCLES_DIR, `${country}.json`), []).filter((item) => item.status !== "closed" && item.status !== "cancelled").length;
    const latest = (key: "lastSuccessfulFetchAt") => connected.map((source) => status[source.id]?.[key]).filter(Boolean).sort().at(-1) ?? null;
    const gaps = [
      ...mine.filter((source) => !source.enabled).map((source) => `${source.name}: ${source.notes ?? "not connected"}`),
      ...mine.filter((source) => status[source.id]?.needsSecret).map((source) => `${source.name}: waiting for a free API key`),
      ...mine.filter((source) => (status[source.id]?.consecutiveFailures ?? 0) >= 2).map((source) => `${source.name}: last ${status[source.id]!.consecutiveFailures} checks failed`),
      ...mine.filter((source) => status[source.id]?.totalAvailable).map((source) => `${source.name}: showing ${status[source.id]!.recordCount} of ${status[source.id]!.totalAvailable}`),
    ];
    return {
      jurisdictionCode: country,
      fixture: false,
      status: !connected.length ? "no-verified-listings" : count ? "verified-listings" : "sources-checked-no-current",
      researchedAuthorities: mine.map((source) => source.authority),
      connectedSourceCount: connected.length,
      unresolvedGaps: gaps,
      lastSuccessfulFetchAt: latest("lastSuccessfulFetchAt"),
      lastValidatedAt: latest("lastSuccessfulFetchAt"),
    };
  });
  writeFileSync(join(PUBLISHED, "coverage.json"), `${JSON.stringify(coverage, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

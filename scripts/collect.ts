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
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { connectors } from "../connectors/index.ts";
import { politeFetchBytes, politeFetchText } from "../connectors/http.ts";
import { assertAllowedSourceUrl, assertNoCandidateListCycle, assertNoCandidateListText } from "../connectors/privacy.ts";
import { markFailedRun, mergeSuccessfulRun, retainApprovedSnapshots, splitForPublication } from "../connectors/merge.ts";
import { MissingSecretError, type Evidence, type SourceConfig } from "../connectors/types.ts";
import type { CoverageRecord, OpportunityCycle } from "../lib/opportunities.ts";
import { approvalRevisions, isApprovedCycle } from "../lib/review.server.ts";
import { civilDateIn } from "../lib/time.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PUBLISHED = join(ROOT, "data/published");
const CYCLES_DIR = join(PUBLISHED, "cycles");
const APPROVED_DIR = join(ROOT, "data/approved/cycles");
const STATUS_FILE = join(PUBLISHED, "sources-status.json");
const OVERRIDES_DIR = join(ROOT, "data/overrides");
const EVIDENCE_DIR = join(ROOT, "data/evidence");
const MAX_RETAINED_EVIDENCE_BYTES = 800 * 1024 * 1024;

interface SourceStatus {
  lastAttemptAt: string | null;
  lastSuccessfulFetchAt: string | null;
  lastError: string | null;
  consecutiveFailures: number;
  recordCount: number;
  totalAvailable?: number;
  complete?: boolean;
  continuation?: string;
  pendingReviewCount?: number;
  lastValidatedAt?: string | null;
  needsSecret?: string[];
}

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};
const dryRun = flag("dry-run");
const stageOnly = flag("stage");
const force = flag("force");
const only = option("source")?.split(",").map((id) => id.trim()).filter(Boolean);

const readJson = <T>(path: string, fallback: T): T => (existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) as T : fallback);

function writeAtomic(path: string, value: Buffer | string): void {
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, value);
    renameSync(temporary, path);
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}

function directoryBytes(path: string): number {
  if (!existsSync(path)) return 0;
  return readdirSync(path, { withFileTypes: true }).reduce((total, entry) => {
    const child = join(path, entry.name);
    return total + (entry.isDirectory() ? directoryBytes(child) : entry.isFile() ? statSync(child).size : 0);
  }, 0);
}

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

function writeReviewPacket(sourceId: string, now: Date, cycles: OpportunityCycle[], evidence: Evidence[], warnings: string[], complete: boolean | undefined, continuation: string | undefined, totalAvailable: number | undefined) {
  const directory = join(ROOT, "data/review");
  const path = join(directory, `${sourceId}.json`);
  // An incomplete page or pagination run cannot clear a pending review packet.
  if (!cycles.length) { if (complete === true && existsSync(path)) unlinkSync(path); return; }
  mkdirSync(directory, { recursive: true });
  const revisions = Object.fromEntries(cycles.map((cycle) => [cycle.id, approvalRevisions(cycle)]));
  const old = readJson<{ approvalRevisions?: Record<string, unknown>; warnings?: string[]; complete?: boolean; continuation?: string; totalAvailable?: number } | null>(path, null);
  if (old && JSON.stringify([old.approvalRevisions, old.warnings, old.complete, old.continuation, old.totalAvailable]) === JSON.stringify([revisions, warnings, complete === true, continuation, totalAvailable])) return;
  writeFileSync(path, `${JSON.stringify({
    sourceId, collectedAt: now.toISOString(), reviewStatus: "pending", complete: complete === true,
    ...(continuation ? { continuation } : {}), ...(totalAvailable !== undefined ? { totalAvailable } : {}),
    cycles, evidence, warnings,
    approvalRevisions: revisions,
  }, null, 2)}\n`);
}

async function main() {
  const registry = readJson<{ sources: SourceConfig[] }>(join(ROOT, "sources/registry.json"), { sources: [] });
  const status = readJson<Record<string, SourceStatus>>(STATUS_FILE, {});
  const overrides = loadOverrides();
  const now = new Date();
  let retainedEvidenceBytes = dryRun ? 0 : directoryBytes(EVIDENCE_DIR);
  const retain = (path: string, bytes: Buffer) => {
    const existing = existsSync(path);
    if (!existing && retainedEvidenceBytes + bytes.length > MAX_RETAINED_EVIDENCE_BYTES) throw new Error("Retained evidence storage budget reached; previous records preserved");
    // A cloud-synced file can exist as a dataless placeholder. Refresh verified bytes locally.
    writeAtomic(path, bytes);
    if (!existing) retainedEvidenceBytes += bytes.length;
  };
  const collectionDeadline = Date.now() + 35 * 60 * 1000;
  const byCountry = new Map<string, OpportunityCycle[]>();
  const dirtyCountries = new Set<string>();
  const approvedByCountry = new Map<string, OpportunityCycle[]>();
  const dirtyApprovedCountries = new Set<string>();
  const countryFile = (country: string) => join(CYCLES_DIR, `${country}.json`);
  const approvedFile = (country: string) => join(APPROVED_DIR, `${country}.json`);
  const recordsFor = (country: string) => {
    if (!byCountry.has(country)) byCountry.set(country, readJson<OpportunityCycle[]>(countryFile(country), []));
    return byCountry.get(country)!;
  };
  const rememberApproved = (country: string, candidates: OpportunityCycle[]) => {
    const previous = approvedByCountry.get(country) ?? readJson<OpportunityCycle[]>(approvedFile(country), []);
    const retained = retainApprovedSnapshots(previous, candidates);
    if (JSON.stringify(retained) !== JSON.stringify(previous)) dirtyApprovedCountries.add(country);
    approvedByCountry.set(country, retained);
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
    // Preserve a previously reviewed revision before any new, unapproved
    // collection can replace or remove it from the mutable published file.
    if (!dryRun && !stageOnly) rememberApproved(source.country, all);
    const mine = all.filter((item) => item.sourceId === source.id);
    const others = all.filter((item) => item.sourceId !== source.id);
    const started = Date.now();
    console.log(`\n▸ ${source.id} (${source.name})`);
    if (!connector) {
      console.log("  no connector — skipped");
      continue;
    }
    if (Date.now() >= collectionDeadline) {
      failures += 1;
      status[source.id] = { ...previousStatus, lastAttemptAt: new Date().toISOString(), lastError: "Collection time budget reached; source retained for next run", consecutiveFailures: previousStatus.consecutiveFailures + 1 };
      console.error("  ✗ collection time budget reached; source retained for next run");
      continue;
    }
    try {
      const result = await connector({
        source,
        now,
        env: process.env,
        fetchBytes: async (url, init) => {
          assertAllowedSourceUrl(url);
          const fetched = await politeFetchBytes(url, { ...init, ignoreRobotsFor: source.robotsException?.hosts });
          if (!dryRun) {
            const directory = join(EVIDENCE_DIR, "bodies", source.id);
            mkdirSync(directory, { recursive: true });
            const path = join(directory, `${fetched.evidence.sha256}.bin`);
            retain(path, fetched.bytes);
          }
          return fetched;
        },
        fetchText: async (url, init) => {
          assertAllowedSourceUrl(url);
          const fetched = await politeFetchText(url, { ...init, ignoreRobotsFor: source.robotsException?.hosts });
          assertNoCandidateListText(fetched.text, fetched.evidence.contentType, fetched.evidence.url);
          if (!dryRun) {
            const directory = join(EVIDENCE_DIR, "bodies", source.id);
            mkdirSync(directory, { recursive: true });
            const path = join(directory, `${fetched.evidence.sha256}.txt.gz`);
            retain(path, gzipSync(fetched.bytes));
          }
          return fetched;
        },
        log: (message) => console.log(`  ${message}`),
      });
      for (const cycle of result.cycles) assertNoCandidateListCycle(cycle);
      // Source freshness comes from completed HTTP responses, not the run's
      // start time. A result without actual receipts cannot claim a fresh check.
      const latestFetch = result.evidence.reduce((latest, evidence) => {
        const fetchedAt = Date.parse(evidence.fetchedAt);
        if (!Number.isFinite(fetchedAt)) throw new Error("Source returned an invalid fetch receipt timestamp");
        return Math.max(latest, fetchedAt);
      }, -Infinity);
      if (!Number.isFinite(latestFetch)) throw new Error("Source returned no successful fetch receipts; keeping previous freshness");
      const lastSuccessfulFetchAt = new Date(latestFetch).toISOString();
      for (const warning of result.warnings) console.warn(`  ⚠ ${warning}`);
      if (!result.cycles.length && mine.length && result.complete === true) {
        // An empty answer from a source that normally has records is treated as a failure, not as "everything closed".
        throw new Error("Source returned no records; keeping previous data");
      }
      const candidates = splitForPublication(result.cycles, mine, source.id, overrides);
      const pending = stageOnly ? [...candidates.approved, ...candidates.pending] : candidates.pending;
      if (!dryRun) {
        writeReviewPacket(source.id, now, pending, result.evidence, result.warnings, result.complete, result.continuation, result.totalAvailable);
        writeEvidence(source.id, result.evidence);
      }
      // Disabled adapters remain draft-only even when a cycle has review approval.
      const approvedFresh = stageOnly || !source.enabled ? [] : candidates.approved;
      if (!dryRun && !stageOnly) rememberApproved(source.country, approvedFresh);
      const merged = mergeSuccessfulRun({
        sourceId: source.id,
        previous: mine,
        fresh: approvedFresh,
        overrides: new Map(),
        now,
        today: (item) => civilDateIn(item.applicationWindow.officialTimeZone ?? "Etc/GMT+12", now),
        snapshotComplete: result.complete === true && pending.length === 0,
      });
      if (!stageOnly) {
        const updated = [...others, ...merged].sort((a, b) => a.id.localeCompare(b.id));
        if (JSON.stringify(updated) !== JSON.stringify(all)) dirtyCountries.add(source.country);
        byCountry.set(source.country, updated);
      }
      status[source.id] = {
        lastAttemptAt: now.toISOString(),
        lastSuccessfulFetchAt,
        lastError: null,
        consecutiveFailures: 0,
        recordCount: merged.length,
        complete: result.complete === true,
        pendingReviewCount: pending.length,
        lastValidatedAt: [previousStatus.lastValidatedAt, ...approvedFresh.map((cycle) => cycle.reviewDecision?.reviewedAt)].filter((value): value is string => !!value).sort().at(-1) ?? null,
        ...(result.continuation ? { continuation: result.continuation } : {}),
        ...(result.totalAvailable !== undefined ? { totalAvailable: result.totalAvailable } : {}),
      };
      console.log(`  ✓ ${result.cycles.length} collected, ${approvedFresh.length} approved, ${pending.length} pending, ${merged.length} kept (${Math.round((Date.now() - started) / 1000)}s)`);
      if (dryRun) for (const cycle of result.cycles.slice(0, 3)) console.log(`    · ${cycle.title} — closes ${cycle.applicationWindow.closesOn ?? "?"}`);
    } catch (error) {
      const missing = error instanceof MissingSecretError ? error.names : undefined;
      if (!missing) failures += 1;
      const consecutiveFailures = missing ? previousStatus.consecutiveFailures : previousStatus.consecutiveFailures + 1;
      if (!stageOnly) {
        const updated = [...others, ...markFailedRun(mine, consecutiveFailures, previousStatus.lastSuccessfulFetchAt)].sort((a, b) => a.id.localeCompare(b.id));
        if (JSON.stringify(updated) !== JSON.stringify(all)) dirtyCountries.add(source.country);
        byCountry.set(source.country, updated);
      }
      status[source.id] = { ...previousStatus, lastAttemptAt: now.toISOString(), lastError: (error as Error).message, consecutiveFailures, ...(missing ? { needsSecret: missing } : {}) };
      console.error(`  ✗ ${missing ? `skipped — set ${missing.join(", ")}` : (error as Error).message}`);
    }
  }

  if (dryRun) {
    console.log("\nDry run: nothing written.");
    return;
  }
  if (stageOnly) {
    // A staged check still changes source freshness and coverage. It must not
    // publish candidate opportunities or write country cycle files.
    mkdirSync(PUBLISHED, { recursive: true });
    writeFileSync(STATUS_FILE, `${JSON.stringify(status, null, 2)}\n`);
    writeCoverage(registry.sources, status);
    console.log("\nStage only: review packets, evidence and source health written; published opportunities unchanged.");
    if (failures && failures === due.length) process.exitCode = 1;
    return;
  }
  if (dirtyApprovedCountries.size) mkdirSync(APPROVED_DIR, { recursive: true });
  for (const country of dirtyApprovedCountries) writeRecords(approvedFile(country), approvedByCountry.get(country)!);
  mkdirSync(CYCLES_DIR, { recursive: true });
  for (const country of dirtyCountries) writeRecords(countryFile(country), recordsFor(country));
  writeFileSync(STATUS_FILE, `${JSON.stringify(status, null, 2)}\n`);
  writeCoverage(registry.sources, status);
  // Fail the job only if every due source failed, so one broken site doesn't block the rest.
  if (failures && failures === due.length) process.exitCode = 1;
}

function writeEvidence(sourceId: string, evidence: Evidence[]) {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const path = join(EVIDENCE_DIR, `${sourceId}.json`);
  writeAtomic(path, `${JSON.stringify(evidence.map(({ url, fetchedAt, sha256, bytes, contentType }) => ({ url, fetchedAt, sha256, bytes, contentType })), null, 1)}\n`);
}

function writeCoverage(sources: SourceConfig[], status: Record<string, SourceStatus>) {
  const countries = [...new Set(sources.map((source) => source.country))];
  const coverage: CoverageRecord[] = countries.map((country) => {
    const mine = sources.filter((source) => source.country === country);
    const fetched = mine.filter((source) => status[source.id]?.lastSuccessfulFetchAt);
    const active = readJson<OpportunityCycle[]>(join(CYCLES_DIR, `${country}.json`), []).filter((item) => item.status !== "closed" && item.status !== "cancelled");
    const approvedCount = active.filter(isApprovedCycle).length;
    const latest = (key: "lastSuccessfulFetchAt" | "lastValidatedAt") => fetched.map((source) => status[source.id]?.[key]).filter((value): value is string => !!value).sort().at(-1) ?? null;
    const gaps = [
      ...mine.filter((source) => !source.enabled).map((source) => `${source.name}: ${source.notes ?? "not connected"}`),
      ...mine.filter((source) => status[source.id]?.needsSecret).map((source) => `${source.name}: waiting for a free API key`),
      ...mine.filter((source) => (status[source.id]?.consecutiveFailures ?? 0) >= 2).map((source) => `${source.name}: last ${status[source.id]!.consecutiveFailures} checks failed`),
      ...mine.filter((source) => status[source.id]?.totalAvailable).map((source) => `${source.name}: ${status[source.id]!.recordCount} records retained; source reports ${status[source.id]!.totalAvailable} items`),
      ...mine.filter((source) => (status[source.id]?.pendingReviewCount ?? 0) > 0).map((source) => `${source.name}: ${status[source.id]!.pendingReviewCount} candidate revisions await review`),
      ...mine.filter((source) => status[source.id]?.complete === false).map((source) => `${source.name}: latest source check incomplete; some notices may be missing`),
      ...mine.filter((source) => source.accessGap).map((source) => `${source.name}: ${source.accessGap}`),
      ...mine.filter((source) => status[source.id]?.lastSuccessfulFetchAt && Date.now() - Date.parse(status[source.id]!.lastSuccessfulFetchAt!) > source.cadenceHours * 3_600_000 * 2).map((source) => `${source.name}: scheduled checks overdue`),
    ];
    return {
      jurisdictionCode: country,
      fixture: false,
      status: approvedCount ? "verified-listings" : active.length || fetched.length ? "partial" : "no-verified-listings",
      researchedAuthorities: mine.map((source) => source.authority),
      connectedSourceCount: fetched.length,
      unresolvedGaps: gaps,
      lastSuccessfulFetchAt: latest("lastSuccessfulFetchAt"),
      lastValidatedAt: latest("lastValidatedAt"),
    };
  });
  writeFileSync(join(PUBLISHED, "coverage.json"), `${JSON.stringify(coverage, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

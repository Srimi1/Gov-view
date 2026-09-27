#!/usr/bin/env node
/** Read-only local metrics. No network, billing API, or inferred audit results. */
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { OpportunityCycle } from "../lib/opportunities.ts";
import { isApprovedCycle } from "../lib/review.server.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const MAX_JSON_BYTES = 64 * 1024 * 1024;
const MAX_INPUT_FILES = 1_000;
const MAX_EXPORT_FILES = 25_000;
const MAX_EXPORT_BYTES = 1024 * 1024 * 1024;

type Source = { id: string; country: string; enabled: boolean; cadenceHours: number };
type SourceStatus = { lastSuccessfulFetchAt?: string | null; lastError?: string | null };
type ReviewPacket = { reviewStatus?: string; collectedAt?: string; cycles?: { id?: string }[] };
type RuleField = "age" | "education" | "nationality" | "residence" | "attempts" | "experience" | "languages" | "manualChecks";
const ruleFields: RuleField[] = ["age", "education", "nationality", "residence", "attempts", "experience", "languages", "manualChecks"];

function readJson<T>(path: string): T {
  if (!existsSync(path)) throw new Error(`Required metrics input missing: ${path}`);
  const size = lstatSync(path).size;
  if (size > MAX_JSON_BYTES) throw new Error(`Metrics input exceeds 64 MiB: ${path}`);
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function jsonFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  const files = readdirSync(directory).filter((name) => name.endsWith(".json")).sort();
  if (files.length > MAX_INPUT_FILES) throw new Error(`More than ${MAX_INPUT_FILES} JSON inputs in ${directory}`);
  return files.map((name) => join(directory, name));
}

function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function validInstant(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function exportFootprint(directory: string) {
  if (!existsSync(directory)) return { status: "unavailable" as const, reason: "Static export has not been built." };
  let files = 0;
  let bytes = 0;
  let largestAssetBytes = 0;
  let examinedEntries = 0;
  let truncated = false;
  const stack = [directory];
  while (stack.length && !truncated) {
    const current = stack.pop()!;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      examinedEntries++;
      if (examinedEntries > MAX_EXPORT_FILES + 10_000) { truncated = true; break; }
      const path = join(current, entry.name);
      if (entry.isDirectory()) stack.push(path);
      else if (entry.isFile()) {
        const size = lstatSync(path).size;
        files++;
        bytes += size;
        largestAssetBytes = Math.max(largestAssetBytes, size);
        if (files > MAX_EXPORT_FILES || bytes > MAX_EXPORT_BYTES) { truncated = true; break; }
      }
      // Symlinks are ignored; never traverse outside export.
    }
  }
  const limits = { files: 18_000, totalBytes: 750 * 1024 * 1024, perAssetBytes: 20 * 1024 * 1024 };
  const alreadyOver = files > limits.files || bytes > limits.totalBytes || largestAssetBytes > limits.perAssetBytes;
  return { status: "measured" as const, filesAtLeast: files, bytesAtLeast: bytes, largestAssetBytes,
    truncated, exact: !truncated, limits, withinLimits: alreadyOver ? false : truncated ? null : true };
}

export function collectMetrics(root: string = ROOT, now: Date = new Date()) {
  const inventory = readJson<{ inventoryAsOf: string; jurisdictions: { code: string }[] }>(join(root, "data/reference/jurisdictions.json"));
  const registry = readJson<{ sources: Source[] }>(join(root, "sources/registry.json"));
  const sourceStatus = readJson<Record<string, SourceStatus>>(join(root, "data/published/sources-status.json"));
  const inventoryCodes = new Set(inventory.jurisdictions.map((entry) => entry.code));
  const sourceCodes = new Set(registry.sources.map((source) => source.country));
  const enabledCodes = new Set(registry.sources.filter((source) => source.enabled).map((source) => source.country));
  const publishedCodes = new Set<string>();
  const approvedCodes = new Set<string>();
  const approved: OpportunityCycle[] = [];
  let collectedRecords = 0;
  for (const file of jsonFiles(join(root, "data/published/cycles"))) {
    const records = readJson<OpportunityCycle[]>(file);
    if (!Array.isArray(records)) throw new Error(`Expected cycle array: ${file}`);
    collectedRecords += records.length;
    for (const record of records) {
      if (record.fixture) continue;
      publishedCodes.add(record.jurisdictionCode);
      if (isApprovedCycle(record)) { approved.push(record); approvedCodes.add(record.jurisdictionCode); }
    }
  }
  const publicIndexPath = join(root, "public/data/index.json");
  const publicIndex = existsSync(publicIndexPath) ? readJson<{ total: number; countries: { code: string }[] }>(publicIndexPath) : null;

  const fieldCounts = Object.fromEntries(ruleFields.map((field) => [field, 0])) as Record<RuleField, number>;
  let completeRules = 0;
  let anyStructuredRule = 0;
  let verifiedSyllabusCycles = 0;
  let verifiedTopics = 0;
  const syllabusProgrammes = new Set<string>();
  const reviewMinutes: number[] = [];
  for (const record of approved) {
    const rules = record.rules;
    if (rules) {
      if (rules.complete === true) completeRules++;
      let hasField = false;
      for (const field of ruleFields) {
        const value = rules[field];
        const present = Array.isArray(value) ? value.length > 0 : value !== undefined;
        if (present) { fieldCounts[field]++; hasField = true; }
      }
      if (hasField) anyStructuredRule++;
    }
    if (record.syllabus?.status === "verified") {
      verifiedSyllabusCycles++;
      verifiedTopics += record.syllabus.topics.length;
      syllabusProgrammes.add(record.programmeId ?? `${record.authority}:${record.programme}`);
    }
    const minutes = record.reviewDecision?.minutesSpent;
    if (typeof minutes === "number" && Number.isFinite(minutes) && minutes >= 0) reviewMinutes.push(minutes);
  }

  let pendingPackets = 0;
  let pendingCycles = 0;
  let unknownPacketAge = 0;
  const packetAgesDays: number[] = [];
  for (const file of jsonFiles(join(root, "data/review"))) {
    const packet = readJson<ReviewPacket>(file);
    if (packet.reviewStatus !== "pending") continue;
    pendingPackets++;
    const count = Array.isArray(packet.cycles) ? new Set(packet.cycles.map((record) => record.id).filter(Boolean)).size : 0;
    pendingCycles += count;
    const collected = validInstant(packet.collectedAt);
    if (collected === null) unknownPacketAge++;
    else packetAgesDays.push(Math.max(0, (now.getTime() - collected) / 86_400_000));
  }
  const medianReviewMinutes = median(reviewMinutes);

  let enabledSources = 0;
  let freshSources = 0;
  let overdueSources = 0;
  let neverFetchedSources = 0;
  let sourcesWithError = 0;
  for (const source of registry.sources) {
    if (!source.enabled) continue;
    enabledSources++;
    const status = sourceStatus[source.id];
    if (status?.lastError) sourcesWithError++;
    const fetched = validInstant(status?.lastSuccessfulFetchAt);
    if (fetched === null) neverFetchedSources++;
    else if (!Number.isFinite(source.cadenceHours) || source.cadenceHours <= 0 || now.getTime() - fetched > source.cadenceHours * 2 * 3_600_000) overdueSources++;
    else freshSources++;
  }

  const unavailable = (reason: string) => ({ status: "unavailable" as const, reason });
  return {
    generatedAt: now.toISOString(),
    coverage: {
      inventoryAsOf: inventory.inventoryAsOf, jurisdictions: inventoryCodes.size,
      jurisdictionsWithRegisteredSource: [...sourceCodes].filter((code) => inventoryCodes.has(code)).length,
      jurisdictionsWithEnabledSource: [...enabledCodes].filter((code) => inventoryCodes.has(code)).length,
      unresearchedJurisdictions: [...inventoryCodes].filter((code) => !sourceCodes.has(code)).length,
      jurisdictionsWithCollectedRecords: publishedCodes.size,
      jurisdictionsWithApprovedRecords: approvedCodes.size,
      jurisdictionsWithPublicRecords: publicIndex?.countries.length ?? null,
      unknownRegistryJurisdictions: [...sourceCodes].filter((code) => !inventoryCodes.has(code)).sort(),
      collectedRecords, publicRecords: publicIndex?.total ?? null, approvedRecords: approved.length,
    },
    approvedRuleDepth: { denominator: approved.length, withAnyStructuredRule: anyStructuredRule, completeRules, fieldCounts },
    syllabus: { denominator: approved.length, verifiedCycles: verifiedSyllabusCycles, verifiedProgrammes: syllabusProgrammes.size, verifiedTopics },
    review: {
      measuredDecisions: reviewMinutes.length, measuredMinutes: reviewMinutes.reduce((sum, value) => sum + value, 0), medianMinutesPerDecision: medianReviewMinutes,
      pendingPackets, pendingCycles, oldestPacketAgeDays: packetAgesDays.length ? Math.max(...packetAgesDays) : null,
      medianPacketAgeDays: median(packetAgesDays), unknownPacketAge,
      estimatedPendingMinutes: medianReviewMinutes === null ? null : pendingCycles * medianReviewMinutes,
      exceedsTwoHourWeeklyCapacity: medianReviewMinutes === null ? null : pendingCycles * medianReviewMinutes > 120,
    },
    sourceFreshness: { enabledSources, disabledSources: registry.sources.length - enabledSources, freshSources, overdueSources, neverFetchedSources, sourcesWithError, overdueThreshold: "2 × source cadence" },
    build: exportFootprint(join(root, "out")),
    audits: {
      falseChangeRate: unavailable("No verified labelled change audit dataset."),
      incorrectDateIncidents: unavailable("No verified incident register."),
      usage: unavailable("No verified privacy-appropriate usage measurement."),
    },
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.stdout.write(`${JSON.stringify(collectMetrics(), null, 2)}\n`);
}

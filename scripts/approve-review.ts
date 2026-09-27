#!/usr/bin/env node
/** Human-run approval for one exact staged opportunity revision. */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { applyOverride } from "../connectors/merge.ts";
import { makeReviewDecision } from "../connectors/review-approval.ts";
import type { OpportunityCycle } from "../lib/opportunities.ts";
import { isApprovedCycle } from "../lib/review.server.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const args = process.argv.slice(2);
function option(name: string): string {
  const index = args.indexOf(`--${name}`);
  if (index < 0 || !args[index + 1]) throw new Error(`Missing --${name}`);
  return args[index + 1];
}

export function approveStagedCandidate(packet: { sourceId: string; reviewStatus: string; cycles: OpportunityCycle[] }, id: string, override: Partial<OpportunityCycle>, input: Parameters<typeof makeReviewDecision>[1], now = new Date()) {
  if (packet.reviewStatus !== "pending") throw new Error("Only pending review packets can be approved");
  const matches = packet.cycles.filter((cycle) => cycle.id === id);
  if (matches.length !== 1) throw new Error(`Expected one staged candidate for ${id}; found ${matches.length}`);
  const candidate = applyOverride({ ...matches[0], sourceId: packet.sourceId }, override);
  const reviewDecision = makeReviewDecision(candidate, input, now);
  const approved = { ...candidate, reviewDecision };
  if (!isApprovedCycle(approved)) throw new Error("Approval revision check failed");
  return { override: { ...override, reviewDecision }, approved };
}

/** Verify exact retained bytes, including compressed text responses, before approval. */
export function verifyRetainedEvidence(root: string, sourceId: string, cycle: OpportunityCycle): void {
  const fetched = cycle.sources.filter((source) => source.fetchStatus === "fetched");
  if (!fetched.length) throw new Error("Candidate has no fetched evidence");
  for (const source of fetched) {
    if (!/^[a-f0-9]{64}$/i.test(source.sha256 ?? "")) throw new Error(`Missing fetched hash for ${source.title}`);
    const directory = join(root, "data/evidence/bodies", sourceId);
    const candidates = [
      { path: join(directory, `${source.sha256}.bin`), compressed: false },
      { path: join(directory, `${source.sha256}.txt.gz`), compressed: true },
      { path: join(directory, `${source.sha256}.txt`), compressed: false },
    ];
    const retained = candidates.find((candidate) => existsSync(candidate.path));
    if (!retained) throw new Error(`Exact fetched bytes not retained for ${source.title}`);
    const bytes = retained.compressed ? gunzipSync(readFileSync(retained.path)) : readFileSync(retained.path);
    const hash = createHash("sha256").update(bytes).digest("hex");
    if (hash !== source.sha256) throw new Error(`Retained evidence hash mismatch for ${source.title}`);
  }
}

async function main() {
  if (args[0] !== "approve") throw new Error("Usage: approve-review.ts approve --source ID --id ID --reviewer NAME --minutes N --reason TEXT --evidence-summary TEXT --evidence-revision SHA256 --record-revision SHA256");
  const sourceId = option("source");
  const id = option("id");
  if (![sourceId, id].every((value) => /^[a-z0-9][a-z0-9-]{0,179}$/.test(value))) throw new Error("Unsafe source or candidate id");
  const packetPath = join(ROOT, "data/review", `${sourceId}.json`);
  if (!existsSync(packetPath)) throw new Error(`No staged review packet for ${sourceId}`);
  const packet = JSON.parse(readFileSync(packetPath, "utf8")) as { sourceId: string; reviewStatus: string; cycles: OpportunityCycle[] };
  if (packet.sourceId !== sourceId || !Array.isArray(packet.cycles)) throw new Error("Review packet source mismatch or missing cycles");
  const overridePath = join(ROOT, "data/overrides", `${id}.json`);
  const override = existsSync(overridePath) ? JSON.parse(readFileSync(overridePath, "utf8")) as Partial<OpportunityCycle> : {};
  const { override: reviewed, approved } = approveStagedCandidate(packet, id, override, {
    reviewer: option("reviewer"),
    reason: option("reason"),
    evidenceSummary: option("evidence-summary"),
    minutesSpent: Number(option("minutes")),
    evidenceRevision: option("evidence-revision"),
    recordRevision: option("record-revision"),
  });
  verifyRetainedEvidence(ROOT, sourceId, approved);
  mkdirSync(join(ROOT, "data/overrides"), { recursive: true });
  const temporaryPath = `${overridePath}.tmp-${process.pid}`;
  writeFileSync(temporaryPath, `${JSON.stringify(reviewed, null, 2)}\n`, { flag: "wx" });
  renameSync(temporaryPath, overridePath);
  console.log(`Approved ${approved.id} at ${approved.reviewDecision?.reviewedAt}. Next collection can publish this exact revision.`);
  console.log(`Fetched evidence: ${approved.sources.filter((source) => source.fetchStatus === "fetched").map((source) => `${source.fetchedUrl} (${source.sha256?.slice(0, 12)})`).join(", ")}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error((error as Error).message); process.exitCode = 1; });
}

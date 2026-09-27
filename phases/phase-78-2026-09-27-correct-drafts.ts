/** Repair three unapproved candidates from retained evidence; no network or approval. */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { approvalRevisions, isApprovedCycle } from "../lib/review.server.ts";
import { andhraPsc } from "../connectors/andhra-psc.ts";
import { cgpsc } from "../connectors/cgpsc.ts";
import { renderReviewSheet } from "../scripts/review-sheet.ts";
import { verifyRetainedEvidence } from "../scripts/approve-review.ts";

const root = new URL("../", import.meta.url);
const load = (path: string) => JSON.parse(readFileSync(new URL(path, root), "utf8"));
const sources = load("sources/registry.json").sources;
const amendments = [];
const prepared = [];
for (const [id, connector, htmlFile, pdfFile] of [
  ["in-ap-recruitment", andhraPsc, "andhra-recruitment.html", "andhra-16-2026.pdf"],
  ["in-ct-recruitment", cgpsc, "cgpsc-advertisements.html", "cgpsc-05-2026.pdf"],
] as const) {
  const packet = load(`data/review/${id}.json`);
  if (packet.reviewStatus !== "pending" || packet.cycles.some(isApprovedCycle)) throw new Error("Expected unapproved packet");
  const source = sources.find((item: { id: string }) => item.id === id);
  if (!source || source.enabled !== false || source.reviewRequired !== true) throw new Error("Source review gate changed");
  const evidenceFor = (url: string) => {
    const evidence = packet.evidence.find((item: { url: string }) => item.url === url);
    if (!evidence) throw new Error("No retained fetch metadata for " + url);
    return evidence;
  };
  const proposed = await connector({
    source, now: new Date(packet.collectedAt), env: {}, log: () => {},
    fetchText: async (url) => ({ text: readFileSync(new URL(`data/evidence/research/${htmlFile}`, root), "utf8"), evidence: evidenceFor(url) }),
    fetchBytes: async (url) => ({ bytes: readFileSync(new URL(`data/evidence/research/${pdfFile}`, root)), evidence: evidenceFor(url) }),
  });
  if (proposed.cycles.length !== packet.cycles.length) throw new Error("Cycle identity/count changed");
  for (const cycle of packet.cycles) {
    const next = proposed.cycles.find((item) => item.id === cycle.id);
    if (!next) throw new Error("Missing prior cycle identity");
    const before = approvalRevisions(cycle);
    cycle.applicationWindow = next.applicationWindow;
    cycle.selectionStages = next.selectionStages;
    if (id === "in-ct-recruitment") {
      cycle.status = next.status;
      cycle.statusNote = next.statusNote;
    }
    // Legacy packets lack fetched/linked markers. Establish them only after
    // validating their canonical retained bodies; preserve original fetch times.
    for (const document of cycle.sources) {
      evidenceFor(document.url);
      document.fetchStatus = "fetched";
      document.fetchedUrl = document.url;
      document.lastValidatedAt = null;
    }
    cycle.lastVerifiedAt = null;
    verifyRetainedEvidence(fileURLToPath(root), id, cycle);
    const after = approvalRevisions(cycle);
    if (isApprovedCycle(cycle)) throw new Error("Correction must not approve candidate");
    amendments.push({ sourceId: id, cycleId: cycle.id, before, after });
  }
  packet.approvalRevisions = Object.fromEntries(packet.cycles.map((cycle: Parameters<typeof approvalRevisions>[0]) => [cycle.id, approvalRevisions(cycle)]));
  packet.researchAmendedAt = new Date().toISOString();
  prepared.push({ id, packet, sheets: packet.cycles.map((cycle: Parameters<typeof approvalRevisions>[0]) => ({ id: cycle.id, text: renderReviewSheet(packet, cycle, null) })) });
}
// Every candidate and retained body has been checked before writing amendments.
for (const { id, packet, sheets } of prepared) {
  writeFileSync(new URL(`data/review/${id}.json`, root), JSON.stringify(packet, null, 2) + "\n");
  for (const sheet of sheets) writeFileSync(new URL(`data/review/sheets/${sheet.id}.md`, root), sheet.text);
}
writeFileSync(new URL("phases/phase-78-2026-09-27-draft-amendments.json", root), JSON.stringify({ amendedAt: new Date().toISOString(), networkRequests: 0, newEvidenceBytes: 0, approvals: 0, amendments }, null, 2) + "\n");
console.log(JSON.stringify({ amendedPackets: 2, amendedCycles: amendments.length, reviewSheets: 3, networkRequests: 0, approvals: 0 }));

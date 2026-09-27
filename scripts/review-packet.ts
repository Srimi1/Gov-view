#!/usr/bin/env node
/** Produces a local founder review index. Never changes records or review decisions. */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import type { OpportunityCycle } from "../lib/opportunities.ts";
import type { SourceConfig } from "../connectors/types.ts";
import { civilDateIn, daysBetween } from "../lib/time.ts";

const directory = fileURLToPath(new URL("../data/review/", import.meta.url));
const cell = (value: string) => value.replace(/[\r\n]+/g, " ").replaceAll("|", "\\|").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const registry = JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")) as { sources: SourceConfig[] };
const draftSources = new Set(registry.sources.filter((source) => source.reviewRequired && /^[a-z0-9-]+$/.test(source.id)).map((source) => source.id));
const packets = readdirSync(directory).filter((file) => file.endsWith(".json") && draftSources.has(file.slice(0, -5))).sort().map((file) => {
  const packet = JSON.parse(readFileSync(join(directory, file), "utf8")) as { sourceId: string; collectedAt: string; reviewStatus: string; cycles: OpportunityCycle[]; warnings: string[] };
  if (`${packet.sourceId}.json` !== file || packet.reviewStatus !== "pending") throw new Error(`Unexpected review packet: ${file}`);
  return { file, ...packet };
});
const count = packets.reduce((total, packet) => total + packet.cycles.length, 0);
const lines = ["# Opportunity review queue", "", `Generated ${new Date().toISOString()}. ${count} draft cycles across ${packets.length} source connectors.`, "", "**Pending founder review. These drafts are excluded from the public export. Counts are draft candidates, not verified open opportunities.**", "", "## Review order", "", "1. Confirm withdrawal and material conflicts from original notices and amendments.", "2. Verify imminent deadlines, official timezone and cutoff precision.", "3. Resolve qualifications, nationality, residence and language conditions for the exact post/cycle.", "4. Record reviewer, decision date, approve/amend/reject reason and time spent before publication. No review decisions or elapsed review minutes are inferred by this report.", "", "Sources that require first-run review remain disabled for automatic publication pending connector acceptance. This queue is not the required 200-notice acceptance audit.", ""];
const now = new Date();
const reviewItems = packets.flatMap((packet) => packet.cycles.map((cycle) => {
  const closes = cycle.applicationWindow.closesOn;
  const days = closes ? daysBetween(civilDateIn(cycle.applicationWindow.officialTimeZone ?? "Etc/GMT+12", now), closes) : null;
  const dueSoon = days !== null && days >= 0 && days <= 30 && cycle.status !== "cancelled";
  // Warning text is a triage hint, never a verified interpretation of the notice.
  const possibleConflict = [...packet.warnings, cycle.statusNote ?? ""].some((warning) => /\b(conflict|contradict|disagree|inconsistent|must resolve)\b/i.test(warning));
  return { packet, cycle, dueSoon, possibleConflict };
}));
const priorityItems = reviewItems.filter((item) => item.dueSoon || item.possibleConflict).sort((a, b) => {
  const priority = (item: typeof a) => item.dueSoon && item.possibleConflict ? 0 : item.dueSoon ? 1 : 2;
  return priority(a) - priority(b)
    || (a.cycle.applicationWindow.closesOn ?? "9999").localeCompare(b.cycle.applicationWindow.closesOn ?? "9999")
    || a.packet.sourceId.localeCompare(b.packet.sourceId)
    || a.cycle.id.localeCompare(b.cycle.id);
});
lines.push("## Priority review candidates", "", "Potential conflicts come from draft warnings and need direct source review. Dates are draft application deadlines; a second required postal step may have its own deadline. This order does not approve or publish records.", "");
if (priorityItems.length) {
  lines.push("| Priority | Deadline | Source | Cycle | Review signal |", "| --- | --- | --- | --- | --- |");
  for (const { packet, cycle, dueSoon, possibleConflict } of priorityItems) {
    const window = cycle.applicationWindow;
    const deadline = window.closesOn ? `${window.closesOn}${window.cutoffLocalTime ? ` ${window.cutoffLocalTime} ${window.officialTimeZone ?? "(zone unknown)"}` : " (time unverified)"}` : "Unknown";
    lines.push(`| ${dueSoon && possibleConflict ? "Conflict + due soon" : dueSoon ? "Due soon" : "Potential conflict"} | ${cell(deadline)} | ${cell(packet.sourceId)} | ${cell(cycle.cycleLabel)} | ${possibleConflict ? "Inspect conflicting evidence" : "Confirm deadline and eligibility"} |`);
  }
} else lines.push("No imminent deadlines or potential conflicts flagged in pending drafts.");
lines.push("");
const dueSoon = reviewItems.filter((item) => item.dueSoon).sort((a, b) => {
  return a.cycle.applicationWindow.closesOn!.localeCompare(b.cycle.applicationWindow.closesOn!) || a.cycle.id.localeCompare(b.cycle.id);
});
lines.push("## Deadline watch — next 30 days", "", "Draft windows only. Confirm original notice, amendments and cutoff before treating any listing as open.", "");
if (dueSoon.length) {
  lines.push("| Deadline | Source | Cycle | Job / examination |", "| --- | --- | --- | --- |");
  for (const { packet, cycle } of dueSoon) {
    const window = cycle.applicationWindow;
    lines.push(`| ${window.closesOn}${window.cutoffLocalTime ? ` ${window.cutoffLocalTime} ${window.officialTimeZone ?? "(zone unknown)"}` : " (time unverified)"} | ${cell(packet.sourceId)} | ${cell(cycle.cycleLabel)} | ${cell(cycle.title)} |`);
  }
} else lines.push("No pending draft has a recorded deadline within 30 days.");
lines.push("");
for (const packet of packets) {
  lines.push(`## ${cell(packet.sourceId)}`, "", `Collected ${packet.collectedAt}. [Full draft and evidence metadata](${packet.file}).`, "", "| Cycle | Job / examination | Application deadline | Draft status |", "| --- | --- | --- | --- |");
  const cycles = [...packet.cycles].sort((a, b) => Number(b.status === "cancelled") - Number(a.status === "cancelled") || (a.applicationWindow.closesOn ?? "9999").localeCompare(b.applicationWindow.closesOn ?? "9999"));
  for (const cycle of cycles) {
    const window = cycle.applicationWindow;
    lines.push(`| ${cell(cycle.cycleLabel)} | ${cell(cycle.title)} | ${window.closesOn ?? "Unknown"}${window.cutoffLocalTime ? ` ${window.cutoffLocalTime} ${window.officialTimeZone ?? "(zone unknown)"}` : " (cutoff time unknown)"} | ${cell(cycle.status)} |`);
  }
  lines.push("", "### Unresolved collection/review items", "", ...packet.warnings.map((warning) => `- ${cell(warning)}`), "");
  for (const cycle of cycles.filter((cycle) => cycle.rules?.languages?.length)) {
    lines.push(`### Language evidence: ${cell(cycle.cycleLabel)}`, "");
    for (const rule of cycle.rules!.languages!) lines.push(`- **${cell(rule.stage)}**: ${cell(rule.requirement)} Evidence: ${cell(rule.evidence)}`, "");
  }
  for (const cycle of cycles.filter((cycle) => cycle.rules?.nationality)) {
    const nationality = cycle.rules!.nationality!;
    lines.push(`### International-applicant evidence: ${cell(cycle.cycleLabel)}`, "",
      `- **Draft nationality rule:** ${cell(nationality.allowed.join(", "))}${nationality.ociAccepted ? "; OCI accepted" : ""}${nationality.conditional?.length ? `; conditional: ${cell(nationality.conditional.join(", "))}` : ""}${nationality.uncertain?.length ? `; needs individual review: ${cell(nationality.uncertain.map((code) => code === "*" ? "all other nationalities" : code).join(", "))}` : ""}. Evidence: ${cell(nationality.evidence)}`,
      ...(nationality.conditionalReason ? [`- **Conditional route:** ${cell(nationality.conditionalReason)}`] : []),
      ...(nationality.uncertainReason ? [`- **Uncertain route:** ${cell(nationality.uncertainReason)}`] : []),
      `- **Residence / benefits:** ${cell(cycle.residenceRule)}`,
      "- Verify original-language wording, exceptions and current amendments before approving this rule. Passing nationality alone never establishes full eligibility.", "");
  }
}
writeFileSync(join(directory, "SUMMARY.md"), `${lines.join("\n")}\n`);
console.log(`Saved review summary: ${count} drafts from ${packets.length} sources.`);

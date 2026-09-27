#!/usr/bin/env node
/** Local founder worksheet for one exact staged revision. Produces no decision. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { OpportunityCycle } from "../lib/opportunities.ts";
import { approvalRevisions, isApprovedCycle } from "../lib/review.server.ts";
import { verifyRetainedEvidence } from "./approve-review.ts";

interface Packet {
  sourceId: string;
  reviewStatus: string;
  collectedAt: string;
  cycles: OpportunityCycle[];
  warnings: string[];
  approvalRevisions: Record<string, { evidenceRevision: string; recordRevision: string }>;
}

/** Draft descriptions can contain untrusted source text; keep it inert in Markdown. */
const plain = (value: unknown): string => (typeof value === "string" ? value : JSON.stringify(value) ?? "undefined")
  .replace(/[\u0000-\u001f\u007f]+/g, " ")
  .replace(/\\/g, "\\\\")
  .replace(/([`*_\[\]()|])/g, "\\$1")
  .replace(/</g, "&lt;").replace(/>/g, "&gt;");

function officialLink(value: string | null | undefined): string {
  if (!value) return "Unavailable";
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return "Unavailable";
    return `[Open official source](${url.href.replaceAll(")", "%29").replaceAll("(", "%28")})`;
  } catch { return "Unavailable"; }
}

const fields = [
  "title", "cycleLabel", "pathway", "appointmentType", "scopeLabel", "outcome", "applicationWindow", "qualifications", "languageNote",
  "citizenshipRule", "residenceRule", "selectionStages", "fee", "rules", "workLocations", "venues", "applicationMethod", "applicationUrl",
] as const;

/** Exact proposal and previous approved revision; never authorises publication. */
export function renderReviewSheet(packet: Packet, cycle: OpportunityCycle, previous: OpportunityCycle | null): string {
  if (packet.reviewStatus !== "pending" || packet.sourceId !== cycle.sourceId || packet.cycles.filter((item) => item.id === cycle.id).length !== 1) {
    throw new Error("Review sheet needs one matching pending candidate");
  }
  if (previous && (!isApprovedCycle(previous) || previous.id !== cycle.id)) throw new Error("Previous revision must be approved and match cycle");
  const revisions = approvalRevisions(cycle);
  const recorded = packet.approvalRevisions?.[cycle.id];
  if (!recorded || recorded.evidenceRevision !== revisions.evidenceRevision || recorded.recordRevision !== revisions.recordRevision) {
    throw new Error("Review packet revisions do not match candidate; recollect before review");
  }
  const window = cycle.applicationWindow;
  const lines = [
    `# Founder review: ${plain(cycle.title)}`,
    "",
    "**Pending draft. No approval or publication is recorded by this sheet.**",
    "",
    `- Source: ${plain(packet.sourceId)}`,
    `- Cycle ID: ${plain(cycle.id)}`,
    `- Collected: ${plain(packet.collectedAt)}`,
    `- Proposed deadline: ${plain(window.closesOn ?? "unknown")}${window.cutoffLocalTime ? ` ${plain(window.cutoffLocalTime)}` : " (clock time unknown)"} ${plain(window.officialTimeZone ?? "official time zone unknown")}; precision ${plain(window.precision)}`,
    `- Evidence revision: \`${revisions.evidenceRevision}\``,
    `- Record revision: \`${revisions.recordRevision}\``,
    "",
    "## Original evidence",
    "",
    "| Document | Language / format | Link | Retained hash |",
    "| --- | --- | --- | --- |",
    ...cycle.sources.map((source) => `| ${plain(source.title)} | ${plain(`${source.language} / ${source.format}`)} | ${officialLink(source.url)} | ${source.fetchStatus === "fetched" ? `\`${plain(source.sha256 ?? "missing")}\`` : "linked; fetch separately"} |`),
    "",
    "Check original-language pages and later amendments. A successful fetch proves document bytes were retained; it does not verify extracted claims.",
    "",
    "## Proposed fields",
    "",
    ...fields.flatMap((field) => cycle[field] === undefined ? [] : [`- [ ] **${field}** — ${plain(cycle[field])}`, ""]),
    "## Previous approved revision",
    "",
  ];
  if (!previous) lines.push("None for this cycle. Treat every field as a first publication check.", "");
  else {
    const changed = fields.filter((field) => JSON.stringify(previous[field]) !== JSON.stringify(cycle[field]));
    lines.push(`Approved at ${plain(previous.reviewDecision?.reviewedAt ?? "unknown")}. ${changed.length} proposed field groups changed.`, "");
    if (changed.length) lines.push("| Field | Previous approved | Proposed |", "| --- | --- | --- |", ...changed.map((field) => `| ${field} | ${plain(previous[field])} | ${plain(cycle[field])} |`), "");
  }
  lines.push("## Warnings and gaps", "", ...packet.warnings.map((warning) => `- ${plain(warning)}`), "", "## Founder decision record", "",
    "- [ ] Verify exact retained bytes, linked documents, notice dates, amendments and status.",
    "- [ ] Resolve nationality, residence, language and qualification conditions for each application, selection and outcome stage.",
    "- [ ] Approve, amend or reject with reason, reviewer name, evidence summary and actual minutes spent. If amended, regenerate this sheet for the new record revision.",
    "", "No decision, reviewer identity or time spent is filled automatically.", "");
  return `${lines.join("\n")}\n`;
}

function option(args: string[], name: string): string {
  const position = args.indexOf(`--${name}`);
  if (position < 0 || !args[position + 1] || !/^[a-z0-9][a-z0-9-]{0,179}$/.test(args[position + 1])) throw new Error(`Use --${name} with a safe source/cycle ID`);
  return args[position + 1];
}

function main(args: string[]) {
  const sourceId = option(args, "source");
  const id = option(args, "id");
  const root = fileURLToPath(new URL("..", import.meta.url));
  const packet = JSON.parse(readFileSync(join(root, "data/review", `${sourceId}.json`), "utf8")) as Packet;
  const matches = packet.cycles.filter((cycle) => cycle.id === id);
  if (matches.length !== 1 || packet.sourceId !== sourceId) throw new Error("Expected one candidate in matching source packet");
  const cycle = matches[0];
  verifyRetainedEvidence(root, sourceId, cycle);
  const approvedFile = join(root, "data/approved/cycles", `${cycle.jurisdictionCode}.json`);
  const approved = existsSync(approvedFile) ? JSON.parse(readFileSync(approvedFile, "utf8")) as OpportunityCycle[] : [];
  const previous = approved.filter((item) => item.id === id && item.sourceId === sourceId && isApprovedCycle(item))
    .sort((a, b) => (b.reviewDecision?.reviewedAt ?? "").localeCompare(a.reviewDecision?.reviewedAt ?? ""))[0] ?? null;
  const output = renderReviewSheet(packet, cycle, previous);
  const directory = join(root, "data/review/sheets");
  mkdirSync(directory, { recursive: true });
  const path = join(directory, `${id}.md`);
  writeFileSync(path, output);
  console.log(`Saved ${path}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error((error as Error).message); process.exitCode = 1; }
}

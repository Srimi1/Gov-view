import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseTnpscDashboard, parseTnpscIndex, tnpsc, TNPSC_INDEX } from "./tnpsc.ts";
import type { ConnectorContext, SourceConfig } from "./types.ts";

const read = (name: string) => readFileSync(new URL(`../data/evidence/research/${name}`, import.meta.url));
const index = read("tnpsc-index.html").toString();
const dashboard = read("tnpsc-dashboard.html").toString();
const entry = parseTnpscIndex(index).entries.find((entry) => entry.number === "8/2026")!;
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[]).find((source) => source.id === "in-tn-recruitment")!;
const metadata = JSON.parse(read("tnpsc-08-2026.json").toString());
const evidence = (url: string, body: Buffer) => ({ url, fetchedAt: "2026-09-25T00:00:00Z", sha256: createHash("sha256").update(body).digest("hex"), contentType: "text/html", bytes: body.length });

test("TNPSC uses application end, not later payment date; annual IDs remain distinct", () => {
  const parsed = parseTnpscIndex(index);
  const group2 = parsed.entries.find((entry) => entry.number === "7/2026")!;
  assert.equal(group2.closesOn, "2026-09-09");
  assert.equal(group2.paymentClosesOn, "2026-09-15");
  assert.equal(entry.id, "tnpsc-2026-8");
  assert.equal(entry.opensOn, "2026-09-07");
  const previousYear = parseTnpscIndex(index.replaceAll("2026", "2025"));
  assert.ok(previousYear.entries.some((entry) => entry.id === "tnpsc-2025-8"));
  assert.equal(new Set(parsed.entries.map((entry) => entry.id)).size, parsed.entries.length);
});

test("TNPSC dashboard must match cycle and dates; cutoff is from explicit local time", () => {
  assert.deepEqual(parseTnpscDashboard(dashboard, entry), { cutoff: "23:59", documentUrl: metadata.url });
  assert.throws(() => parseTnpscDashboard(dashboard, { ...entry, number: "8/2025" }), /different application cycle/);
  assert.throws(() => parseTnpscDashboard(dashboard, { ...entry, closesOn: "2026-10-08" }), /dates conflict/);
  assert.throws(() => parseTnpscDashboard(dashboard.replace("11:59 P.M", "11:99 P.M"), entry), /Invalid.*time/);
  assert.throws(() => parseTnpscDashboard(dashboard.replace(metadata.url.replaceAll("%20", " "), "https://evil.example/notice.pdf"), entry), /documents need review/);
});

test("TNPSC index drift and off-domain dashboard links cannot become published candidates", () => {
  assert.throws(() => parseTnpscIndex("<html>Maintenance</html>"), /table changed/);
  assert.throws(() => parseTnpscIndex(index.replaceAll("https://tnpsc.gov.in/web/examdashboard/", "https://evil.example/web/examdashboard/")), /No TNPSC application rows/);
});

function context(changed = false): ConnectorContext {
  return { source, now: new Date("2026-09-25T00:00:00Z"), env: {}, log: () => {}, fetchText: async (url) => {
    const text = url === TNPSC_INDEX ? index : dashboard;
    return { text, evidence: evidence(url, Buffer.from(text)) };
  }, fetchBytes: async (url) => {
    const bytes = changed ? Buffer.from("%PDF-changed revision") : read("tnpsc-08-2026.pdf");
    return { bytes, evidence: { ...evidence(url, bytes), contentType: "application/pdf" } };
  } };
}

test("Tamil language extraction remains bound to exact retained PDF and pending review", async () => {
  assert.equal(source.reviewRequired, true);
  const result = await tnpsc(context());
  const cycle = result.cycles.find((cycle) => cycle.id === entry.id)!;
  assert.equal(cycle.rules?.languages?.length, 2);
  assert.equal(cycle.rules?.complete, false);
  assert.ok(cycle.rules?.languages?.every((rule) => rule.language === "ta" && !rule.framework && !rule.minimumLevel));
  assert.match(cycle.rules!.languages![0].requirement, /1695, 1694, 3799 and 3833/);
  assert.match(cycle.rules!.languages![1].requirement, /40% \(60 marks\)/);
  assert.equal(cycle.rules?.nationality, undefined);
  assert.ok(cycle.sources.every((source) => source.verificationStatus === "pending-review" && source.lastValidatedAt === null));
  assert.equal(cycle.venues[0].kind, "unknown");
});

test("changed PDF suppresses old language extraction and flags conflict", async () => {
  const result = await tnpsc(context(true));
  const cycle = result.cycles.find((cycle) => cycle.id === entry.id)!;
  assert.equal(cycle.rules, null);
  assert.equal(cycle.status, "uncertain");
  assert.ok(result.warnings.some((warning) => /language extraction withheld/.test(warning)));
});

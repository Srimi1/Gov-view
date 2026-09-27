import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { nlsiuOtherFaculty2026, verifyNlsiuOtherPages } from "./nlsiu-other-faculty-2026.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const data = JSON.parse(readFileSync(new URL("../data/extractions/nlsiu-other-faculty-2026.json", import.meta.url), "utf8")) as {
  indexUrl: string; facultyUrl: string;
  roles: { id: string; title: string; notification: string; noticeUrl: string; pdfUrl: string; pdfSha256: string;
    corrigendumUrl?: string; corrigendumSha256?: string }[];
};
const research = new URL("../data/evidence/research/", import.meta.url);
const html = new Map<string, string>([
  [data.indexUrl, readFileSync(new URL("nlsiu-work-with-us-2026.html", research), "utf8")],
  [data.facultyUrl, readFileSync(new URL("nlsiu-faculty-september-2026.html", research), "utf8")],
]);
const pdf = new Map<string, Buffer>();
for (const role of data.roles) {
  const id = role.notification.split("/")[0];
  const stem = role.title === "Associate Professor (Public Policy)" ? "nlsiu-associate-professor-public-policy" :
    role.title === "Associate Professor (Law)" ? "nlsiu-associate-professor-law" :
    role.title.startsWith("Associate") ? "nlsiu-associate-professor-hss" : "nlsiu-professor-hss";
  html.set(role.noticeUrl, readFileSync(new URL(`${stem}-2026.html`, research), "utf8"));
  pdf.set(role.pdfUrl, readFileSync(new URL(`nlsiu-notification-${id}-2026.pdf`, research)));
  if (role.corrigendumUrl) pdf.set(role.corrigendumUrl, readFileSync(new URL(`${stem}-corrigendum-2026.pdf`, research)));
}
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[])
  .find((item) => item.id === "in-ka-nlsiu-other-faculty-2026")!;
const evidence = (url: string, bytes: Buffer, contentType: string): Evidence => ({
  url, fetchedAt: "2026-09-25T00:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length, contentType,
});
function context(changedUrl?: string): ConnectorContext {
  return { source, now: new Date("2026-09-25T00:00:00Z"), env: {}, log: () => {},
    fetchText: async (url) => {
      const text = html.get(url);
      assert.ok(text, url);
      return { text, evidence: evidence(url, Buffer.from(text), "text/html") };
    },
    fetchBytes: async (url) => {
      const original = pdf.get(url);
      assert.ok(original, url);
      const bytes = url === changedUrl ? Buffer.concat([original, Buffer.from("changed")]) : original;
      return { bytes, evidence: evidence(url, bytes, "application/pdf") };
    },
  };
}

test("four separate NLSIU role pages and original notices bind to exact revisions", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  for (const role of data.roles) {
    verifyNlsiuOtherPages(html.get(data.indexUrl)!, html.get(data.facultyUrl)!, html.get(role.noticeUrl)!, role as Parameters<typeof verifyNlsiuOtherPages>[3]);
    assert.equal(evidence(role.pdfUrl, pdf.get(role.pdfUrl)!, "application/pdf").sha256, role.pdfSha256);
    if (role.corrigendumUrl) assert.equal(evidence(role.corrigendumUrl, pdf.get(role.corrigendumUrl)!, "application/pdf").sha256, role.corrigendumSha256);
  }
  const law = data.roles.find((role) => role.notification === "16/2026")!;
  assert.throws(() => verifyNlsiuOtherPages(html.get(data.indexUrl)!, html.get(data.facultyUrl)!,
    html.get(law.noticeUrl)!.replace("Foreign nationals/OCI/NRI/PIO are permitted to apply", "Foreign nationals may not apply"),
    law as Parameters<typeof verifyNlsiuOtherPages>[3]), /changed/);
  assert.throws(() => verifyNlsiuOtherPages(html.get(data.indexUrl)!, html.get(data.facultyUrl)!,
    html.get(law.noticeUrl)!.replace('<div class="news-events-page__content">',
      '<div class="news-events-page__content"><a href="https://www.nls.ac.in/wp-content/uploads/2026/09/new-amendment.pdf">Amendment</a>'),
    law as Parameters<typeof verifyNlsiuOtherPages>[3]), /unreviewed documents/);
  await assert.rejects(nlsiuOtherFaculty2026(context(data.roles[1].corrigendumUrl)), /document .* changed/);
});

test("five NLSIU September roles yield four new drafts, with corrected subject areas and separate visa check", async () => {
  const result = await nlsiuOtherFaculty2026(context());
  assert.equal(result.cycles.length, 4);
  assert.equal(result.evidence.length, 12);
  assert.deepEqual(result.cycles.map((cycle) => cycle.id), data.roles.map((role) => role.id));
  assert.equal(result.cycles.reduce((sum, cycle) => sum + Number(/^(\d+) permanent/.exec(cycle.outcome)?.[1] ?? 0), 0), 11);
  for (const cycle of result.cycles) {
    assert.equal(cycle.status, "open");
    assert.equal(cycle.appointmentType, "permanent");
    assert.equal(cycle.applicationWindow.closesOn, "2026-10-26");
    assert.equal(cycle.applicationWindow.cutoffLocalTime, "17:00");
    assert.equal(cycle.applicationWindow.officialTimeZone, "Asia/Kolkata");
    assert.equal(cycle.rules?.nationality?.allowed[0], "*");
    assert.equal(cycle.rules?.languages, undefined);
    assert.equal(cycle.venues[0].kind, "unknown");
    const check = evaluateEligibility(cycle.rules, { nationality: "US" });
    assert.equal(check.canApply.checks.find((item) => item.rule === "nationality")?.result, "matches-published-criteria");
    assert.equal(check.canObtainOutcome.result, "needs-verification");
  }
  for (const cycle of result.cycles.filter((item) => item.title.includes("Humanities"))) {
    assert.match(cycle.qualifications, /Sociology and Anthropology/);
    assert.equal(cycle.sources.at(-1)?.format, "scanned PDF");
  }
});

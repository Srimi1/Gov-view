import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { pihmctAssistantLecturer2026, verifyPihmctPages } from "./pihmct-assistant-lecturer-2026.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const data = JSON.parse(readFileSync(new URL("../data/extractions/pihmct-assistant-lecturer-2026.json", import.meta.url), "utf8")) as {
  boardUrl: string; detailUrl: string; noticeUrl: string; noticeSha256: string;
};
const board = readFileSync(new URL("../data/evidence/research/pihmct-notice-board-2026.html", import.meta.url), "utf8");
const detail = readFileSync(new URL("../data/evidence/research/pihmct-assistant-lecturer-page-2026.html", import.meta.url), "utf8");
const pdf = readFileSync(new URL("../data/evidence/research/pihmct-assistant-lecturer-2026.pdf", import.meta.url));
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[])
  .find((item) => item.id === "in-py-pihmct-lecturer-2026")!;
const evidence = (url: string, bytes: Buffer): Evidence => ({
  url, fetchedAt: "2026-09-25T00:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length,
  contentType: url.endsWith(".pdf") ? "application/pdf" : "text/html",
});
function context(changed = false, now = new Date("2026-09-25T00:00:00Z")): ConnectorContext {
  return { source, now, env: {}, log: () => {},
    fetchText: async (url) => {
      assert.ok(url === data.boardUrl || url === data.detailUrl);
      const html = url === data.boardUrl ? board : detail;
      return { text: html, evidence: evidence(url, Buffer.from(html)) };
    },
    fetchBytes: async (url) => {
      assert.equal(url, data.noticeUrl);
      const bytes = changed ? Buffer.concat([pdf, Buffer.from("changed")]) : pdf;
      return { bytes, evidence: evidence(url, bytes) };
    },
  };
}

test("PIHMCT page links and exact PDF bytes gate extraction", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  assert.doesNotThrow(() => verifyPihmctPages(board, detail));
  assert.throws(() => verifyPihmctPages(board.replace("19-08-2026", "20-08-2026"), detail), /changed/);
  assert.throws(() => verifyPihmctPages(board, detail.replace("recruitment-notice-assistant-lecturer-contract.pdf", "changed.pdf")), /changed/);
  assert.equal(evidence(data.noticeUrl, pdf).sha256, data.noticeSha256);
  await assert.rejects(pihmctAssistantLecturer2026(context(true)), /PDF changed/);
});

test("PIHMCT three positions count once; foreign citizenship and language stay unverified", async () => {
  const result = await pihmctAssistantLecturer2026(context());
  assert.equal(result.complete, false);
  assert.equal(result.cycles.length, 1);
  const cycle = result.cycles[0];
  assert.equal(cycle.id, "pihmct-assistant-lecturer-2026");
  assert.equal(cycle.appointmentType, "contract");
  assert.equal(cycle.status, "open");
  assert.equal(cycle.applicationWindow.opensOn, null);
  assert.equal(cycle.applicationWindow.closesOn, "2026-10-25");
  assert.equal(cycle.applicationWindow.cutoffLocalTime, null);
  assert.equal(cycle.applicationWindow.officialTimeZone, null);
  assert.equal(cycle.venues[0].kind, "unknown");
  assert.equal(cycle.rules?.nationality, undefined);
  assert.equal(cycle.rules?.languages, undefined);
  assert.equal(evaluateEligibility(cycle.rules, { nationality: "US" }).canApply.result, "needs-verification");
  assert.equal((await pihmctAssistantLecturer2026(context(false, new Date("2026-10-25T12:00:00Z")))).cycles[0].status, "uncertain");
  assert.equal((await pihmctAssistantLecturer2026(context(false, new Date("2026-10-26T00:00:00Z")))).cycles[0].status, "closed");
});

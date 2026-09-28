import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { secureExport, secureHtml } from "./secure-export.mjs";

test("exported page allows only its exact Next bootstrap script", () => {
  const script = "(self.__next_f=self.__next_f||[]).push([0])";
  const hash = createHash("sha256").update(script).digest("base64");
  const html = secureHtml(`<html><head></head><body><script>${script}</script></body></html>`);
  assert.match(html, new RegExp(`sha256-${hash.replace(/[+/=]/g, "\\$&")}`));
  assert.doesNotMatch(html, /script-src[^;]*unsafe-(?:inline|eval)/);
  assert.equal((html.match(/Content-Security-Policy/g) ?? []).length, 1);
  assert.ok(html.indexOf("Content-Security-Policy") < html.indexOf("<script>"));
  assert.equal(secureHtml(html), html);
});

test("export rejects a leaked key without exposing its value", async () => {
  const dir = await mkdtemp(join(tmpdir(), "govview-export-"));
  try {
    await writeFile(join(dir, "index.html"), `<html><head></head><body><script>const key="AKIAABCDEFGHIJKLMNOP"</script></body></html>`);
    await assert.rejects(secureExport(dir), /Possible AWS access key in exported asset: index\.html/);
    const output = await readFile(join(dir, "index.html"), "utf8");
    assert.match(output, /Content-Security-Policy/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("export rejects an unapproved draft record", async () => {
  const dir = await mkdtemp(join(tmpdir(), "govview-export-"));
  try {
    await mkdir(join(dir, "data", "detail"), { recursive: true });
    await writeFile(join(dir, "index.html"), "<html><head></head><body></body></html>");
    await writeFile(join(dir, "data", "detail", "IN-0.json"), JSON.stringify([
      { id: "in-draft-1", fixture: false, publicationApproved: false, reviewPending: false },
    ]));
    await assert.rejects(secureExport(dir), /Unapproved record in export: data\/detail\/IN-0\.json \(id in-draft-1\)/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("export accepts approved records and snapshots under re-review", async () => {
  const dir = await mkdtemp(join(tmpdir(), "govview-export-"));
  try {
    await mkdir(join(dir, "data", "list"), { recursive: true });
    await writeFile(join(dir, "index.html"), "<html><head></head><body></body></html>");
    await writeFile(join(dir, "data", "list", "IN-0.json"), JSON.stringify([
      { id: "in-ok-1", fixture: false, publicationApproved: true, reviewPending: false, reviewDecision: { status: "approved" } },
      { id: "in-ok-2", fixture: false, publicationApproved: false, reviewPending: true },
    ]));
    const result = await secureExport(dir);
    assert.equal(result.files, 2);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("export rejects a record whose review decision is not approved", async () => {
  const dir = await mkdtemp(join(tmpdir(), "govview-export-"));
  try {
    await mkdir(join(dir, "data", "detail"), { recursive: true });
    await writeFile(join(dir, "index.html"), "<html><head></head><body></body></html>");
    await writeFile(join(dir, "data", "detail", "IN-0.json"), JSON.stringify([
      { id: "in-sneaky-1", fixture: false, publicationApproved: true, reviewPending: false, reviewDecision: { status: "pending" } },
    ]));
    await assert.rejects(secureExport(dir), /Unapproved record in export: data\/detail\/IN-0\.json \(id in-sneaky-1\)/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("export rejects a fixture record", async () => {
  const dir = await mkdtemp(join(tmpdir(), "govview-export-"));
  try {
    await mkdir(join(dir, "data", "detail"), { recursive: true });
    await writeFile(join(dir, "index.html"), "<html><head></head><body></body></html>");
    await writeFile(join(dir, "data", "detail", "IN-0.json"), JSON.stringify([
      { id: "demo-1", fixture: true, publicationApproved: true, reviewPending: false },
    ]));
    await assert.rejects(secureExport(dir), /Fixture record in export: data\/detail\/IN-0\.json \(id demo-1\)/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("export rejects an injected review route", async () => {
  const dir = await mkdtemp(join(tmpdir(), "govview-export-"));
  try {
    await mkdir(join(dir, "tools", "review"), { recursive: true });
    await writeFile(join(dir, "tools", "review", "index.html"), "<html><head></head><body>review</body></html>");
    await assert.rejects(secureExport(dir), /Review tooling leaked into export: tools\/review\/index\.html/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("export rejects a review tool reference inside an asset", async () => {
  const dir = await mkdtemp(join(tmpdir(), "govview-export-"));
  try {
    await writeFile(join(dir, "index.html"), "<html><head></head><body>see tools/review/server.ts</body></html>");
    await assert.rejects(secureExport(dir), /Review tool reference in exported asset: index\.html/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("export rejects a .env file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "govview-export-"));
  try {
    await writeFile(join(dir, "index.html"), "<html><head></head><body></body></html>");
    await writeFile(join(dir, ".env"), "USAJOBS_API_KEY=secret\n");
    await assert.rejects(secureExport(dir), /Environment file in export: \.env/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("export rejects a job page without approval", async () => {
  const dir = await mkdtemp(join(tmpdir(), "govview-export-"));
  try {
    await mkdir(join(dir, "job", "ghost-record"), { recursive: true });
    await writeFile(join(dir, "job", "ghost-record", "index.html"), "<html><head></head><body></body></html>");
    await mkdir(join(dir, "data"), { recursive: true });
    await writeFile(join(dir, "data", "approved-pages.json"), JSON.stringify({ generatedAt: "2026-09-27T00:00:00.000Z", ids: [] }));
    await assert.rejects(secureExport(dir), /Exported job page without approval: ghost-record/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import test from "node:test";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SOURCE = "in-ut-recruitment";

/** Exercise the real collector CLI and its persisted health/evidence contract.
 * Only external HTTP responses are substituted; the actual workspace is read-only.
 */
function isolatedCollector() {
  const root = mkdtempSync(join(tmpdir(), "gov-view-collector-health-"));
  for (const directory of ["connectors", "lib"]) {
    cpSync(join(ROOT, directory), join(root, directory), {
      recursive: true,
      filter: (path) => !path.endsWith(".test.ts"),
    });
  }
  mkdirSync(join(root, "scripts"));
  cpSync(join(ROOT, "scripts/collect.ts"), join(root, "scripts/collect.ts"));
  cpSync(join(ROOT, "data/extractions"), join(root, "data/extractions"), { recursive: true });
  mkdirSync(join(root, "sources"));
  writeFileSync(join(root, "package.json"), JSON.stringify({ type: "module" }));
  const registry = JSON.parse(readFileSync(join(ROOT, "sources/registry.json"), "utf8"));
  writeFileSync(join(root, "sources/registry.json"), JSON.stringify({ sources: registry.sources.filter((source: { id: string }) => source.id === SOURCE) }));
  const evidence = JSON.parse(readFileSync(join(ROOT, `data/evidence/${SOURCE}.json`), "utf8")) as { url: string; sha256: string; contentType: string }[];
  const responses: Record<string, { path: string; contentType: string }> = {};
  for (const [index, item] of evidence.entries()) {
    const isHtml = item.contentType.includes("text/html");
    const retained = readFileSync(join(ROOT, `data/evidence/bodies/${SOURCE}/${item.sha256}.${isHtml ? "txt.gz" : "bin"}`));
    const path = join(root, `response-${index}.bin`);
    writeFileSync(path, isHtml ? gunzipSync(retained) : retained);
    responses[item.url] = { path, contentType: item.contentType };
  }
  writeFileSync(join(root, "responses.json"), JSON.stringify(responses));
  writeFileSync(join(root, "http-fixture.mjs"), `
    import { readFileSync } from 'node:fs';
    const responses = JSON.parse(readFileSync(new URL('./responses.json', import.meta.url), 'utf8'));
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.endsWith('/robots.txt')) return new Response('User-agent: *\\nAllow: /\\n', { headers: { 'Content-Type': 'text/plain' } });
      const response = responses[url];
      if (!response) throw new Error('Unexpected external request: ' + url);
      return new Response(readFileSync(response.path), { headers: { 'Content-Type': response.contentType } });
    };
  `);
  return {
    root,
    replaceOriginalNotice(bytes: Buffer) {
      writeFileSync(responses["https://psc.uk.gov.in/public/uploads/recruitment/1247631101.pdf"].path, bytes);
    },
    run() {
      return execFileSync(process.execPath, ["--experimental-strip-types", "--import", join(root, "http-fixture.mjs"), join(root, "scripts/collect.ts"), "--source", SOURCE, "--stage"], {
        cwd: root,
        encoding: "utf8",
        timeout: 20_000,
        stdio: ["ignore", "pipe", "pipe"],
      });
    },
    json(path: string) { return JSON.parse(readFileSync(join(root, path), "utf8")); },
  };
}

test("staged collection records the actual successful receipt time, separately from attempt and validation", () => {
  const fixture = isolatedCollector();
  try {
    assert.match(fixture.run(), /1 collected, 0 approved, 1 pending/);
    const health = fixture.json("data/published/sources-status.json")[SOURCE];
    const receipts = fixture.json(`data/evidence/${SOURCE}.json`);
    const finalReceipt = receipts.find((receipt: { url: string }) => receipt.url.endsWith("/52805175.pdf"));
    assert.ok(finalReceipt, "The final official notice response must be retained");
    assert.ok(Date.parse(finalReceipt.fetchedAt) > Date.parse(health.lastAttemptAt));
    assert.equal(health.lastSuccessfulFetchAt, finalReceipt.fetchedAt, "Successful fetch must use the receipt time, not the run start");
    assert.equal(health.lastValidatedAt, null);
    assert.equal(health.recordCount, 0);
    assert.deepEqual(fixture.json(`data/review/${SOURCE}.json`).cycles.map((cycle: { id: string }) => cycle.id), ["uttarakhand-psc-2026-a1-combined-civil-service"]);
    assert.equal(fixture.json("data/published/coverage.json")[0].lastSuccessfulFetchAt, finalReceipt.fetchedAt);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("failed notice check preserves the last successful time and pending cycle; retry creates no duplicate", () => {
  const fixture = isolatedCollector();
  try {
    fixture.run();
    const previousHealth = fixture.json("data/published/sources-status.json")[SOURCE];
    const packetPath = join(fixture.root, `data/review/${SOURCE}.json`);
    const previousPacket = readFileSync(packetPath, "utf8");
    const responses = fixture.json("responses.json");
    const original = readFileSync(responses["https://psc.uk.gov.in/public/uploads/recruitment/1247631101.pdf"].path);
    fixture.replaceOriginalNotice(Buffer.from("%PDF- changed official response"));
    assert.throws(() => fixture.run(), (error: unknown) => {
      const result = error as { status?: number; stderr?: string };
      return result.status === 1 && String(result.stderr).includes("PDF changed; extracted fields withheld");
    });
    const failedHealth = fixture.json("data/published/sources-status.json")[SOURCE];
    assert.equal(failedHealth.lastSuccessfulFetchAt, previousHealth.lastSuccessfulFetchAt);
    assert.equal(failedHealth.lastValidatedAt, null);
    assert.equal(failedHealth.consecutiveFailures, 1);
    assert.equal(readFileSync(packetPath, "utf8"), previousPacket);

    fixture.replaceOriginalNotice(original);
    assert.match(fixture.run(), /1 collected, 0 approved, 1 pending/);
    const retriedHealth = fixture.json("data/published/sources-status.json")[SOURCE];
    assert.equal(retriedHealth.consecutiveFailures, 0);
    assert.equal(retriedHealth.pendingReviewCount, 1);
    assert.equal(retriedHealth.recordCount, 0);
    assert.equal(retriedHealth.lastValidatedAt, null);
    assert.equal(readFileSync(packetPath, "utf8"), previousPacket);
    assert.ok(Date.parse(retriedHealth.lastSuccessfulFetchAt) > Date.parse(previousHealth.lastSuccessfulFetchAt));
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

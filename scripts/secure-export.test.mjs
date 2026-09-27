import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

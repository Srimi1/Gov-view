import assert from "node:assert/strict";
import test from "node:test";
import { isSafeHttpUrl } from "./safe-url.ts";

test("isSafeHttpUrl accepts only absolute http(s) URLs", () => {
  assert.equal(isSafeHttpUrl("https://example.gov/notice"), true);
  assert.equal(isSafeHttpUrl("http://example.gov/notice"), true);
  for (const bad of ["javascript:alert(1)", " javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,x", "vbscript:x", "/relative", "//example.gov", "", null, undefined]) {
    assert.equal(isSafeHttpUrl(bad), false, String(bad));
  }
});

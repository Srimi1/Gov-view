import assert from "node:assert/strict";
import test from "node:test";
import { isSafeHttpUrl } from "./safe-url.ts";

test("accepts absolute http and https URLs", () => {
  assert.equal(isSafeHttpUrl("https://example.gov/notice.pdf"), true);
  assert.equal(isSafeHttpUrl("http://example.gov/notice"), true);
});

test("rejects script, data and other non-web schemes", () => {
  for (const value of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", " javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "vbscript:x", "file:///etc/passwd", "mailto:a@b.c"]) {
    assert.equal(isSafeHttpUrl(value), false, value);
  }
});

test("rejects relative, empty and missing values", () => {
  for (const value of ["", "/notice", "//example.gov/notice", "example.gov", null, undefined]) {
    assert.equal(isSafeHttpUrl(value), false, String(value));
  }
});

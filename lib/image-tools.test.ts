import assert from "node:assert/strict";
import test from "node:test";
import { canResize, imageTypeFromSignature, outputFormats } from "./image-tools.ts";

test("image formats follow magic bytes instead of filename or MIME claim", () => {
  assert.equal(imageTypeFromSignature(new Uint8Array([0xff, 0xd8, 0xff, 0x00])), "image/jpeg");
  assert.equal(imageTypeFromSignature(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])), "image/png");
  assert.equal(imageTypeFromSignature(new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80])), "image/webp");
  assert.equal(imageTypeFromSignature(new TextEncoder().encode("<svg onload=alert(1)>")), null);
});

test("resizer requires reviewed exact output and supported format", () => {
  assert.equal(canResize({ kind: "photo", formats: ["JPG", "PNG"], width: 200, height: 200, maxBytes: 50_000, verified: true }), true);
  assert.deepEqual(outputFormats({ kind: "photo", formats: ["JPG", "image/jpeg", ".png"] }), ["image/jpeg", "image/png"]);
  assert.equal(canResize({ kind: "photo", formats: ["SVG"], width: 200, height: 200, verified: true }), false);
  assert.equal(canResize({ kind: "photo", formats: ["JPG"], width: 200, height: 200, verified: false }), false);
});

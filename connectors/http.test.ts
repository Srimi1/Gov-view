import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canUseSystemFetch, isBotChallenge } from "./http.ts";

test("system fetch fallback is scoped to known Node TLS, connection and DNS failures", () => {
  assert.equal(canUseSystemFetch({ cause: { code: "ERR_SSL_UNSAFE_LEGACY_RENEGOTIATION_DISABLED" } }, "https://punjab.gov.in/robots.txt"), true);
  assert.equal(canUseSystemFetch({ cause: { code: "ERR_SSL_UNSAFE_LEGACY_RENEGOTIATION_DISABLED" } }, "https://sssb.punjab.gov.in/robots.txt"), true);
  assert.equal(canUseSystemFetch({ cause: { code: "ERR_SSL_UNSAFE_LEGACY_RENEGOTIATION_DISABLED" } }, "https://psc.wb.gov.in/robots.txt"), true);
  assert.equal(canUseSystemFetch({ cause: { code: "ERR_SSL_UNSAFE_LEGACY_RENEGOTIATION_DISABLED" } }, "https://hpsc.gov.in/robots.txt"), false);
  assert.equal(canUseSystemFetch({ cause: { code: "UNABLE_TO_VERIFY_LEAF_SIGNATURE" } }), true);
  assert.equal(canUseSystemFetch({ cause: { code: "ECONNREFUSED" } }), false);
  assert.equal(canUseSystemFetch({ cause: { code: "UND_ERR_CONNECT_TIMEOUT" } }, "https://kvsangathan.nic.in/robots.txt"), true);
  assert.equal(canUseSystemFetch({ cause: { code: "UND_ERR_CONNECT_TIMEOUT" } }, "https://cdnbbsr.s3waas.gov.in/robots.txt"), true);
  assert.equal(canUseSystemFetch({ cause: { code: "UND_ERR_CONNECT_TIMEOUT" } }, "https://hpsc.gov.in/robots.txt"), false);
  assert.equal(canUseSystemFetch({ cause: { code: "ENOTFOUND" } }, "https://www.iprc.gov.in/robots.txt"), true);
  assert.equal(canUseSystemFetch({ cause: { code: "ENOTFOUND" } }, "https://hpsc.gov.in/robots.txt"), false);
});

test("challenge detection rejects HTML gates even with a misleading media type", () => {
  for (const contentType of ["text/html", "application/javascript", "application/json", ""]) {
    assert.equal(isBotChallenge('<!DOCTYPE html><html><body>Are you a robot? <form id="captcha"></form></body></html>', contentType), true);
  }
  assert.equal(isBotChallenge('<form class="altcha"></form>', "application/xhtml+xml"), true);
  assert.equal(isBotChallenge("Are you a robot?", "text/plain"), true);
});

test("public application code mentioning CAPTCHA is not a challenge response", () => {
  assert.equal(isBotChallenge('import{a}from"./chunk.js";const field="captcha";export{field};', "application/javascript"), false);
  assert.equal(isBotChallenge('{"title":"CAPTCHA accessibility research vacancy"}', "application/json"), false);
  assert.equal(isBotChallenge("<html><body>Official recruitment notices</body></html>", "text/html"), false);
  const publicNotices = readFileSync(new URL("../data/evidence/research/wbpsc-home.html", import.meta.url), "utf8");
  assert.equal(isBotChallenge(publicNotices, "text/html"), false);
  assert.equal(isBotChallenge(`<!DOCTYPE html><body>Are you a robot? ${publicNotices}`, "text/html"), true);
});

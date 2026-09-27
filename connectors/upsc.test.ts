import assert from "node:assert/strict";
import test from "node:test";
import { upsc } from "./upsc.ts";
import type { ConnectorContext, Evidence } from "./types.ts";

test("UPSC draft links current application portal and does not claim a linked PDF was fetched", async () => {
  const examUrl = "https://www.upsc.gov.in/examinations/Engineering%20Services%20%28Preliminary%29%20Examination%2C%202027";
  const list = `<div class="view-content"><a href="/examinations/Engineering%20Services%20%28Preliminary%29%20Examination%2C%202027">Engineering Services (Preliminary) Examination, 2027</a></div>`;
  const page = `<div>Name of Examination: Engineering Services (Preliminary) Examination, 2027 Date of Notification 16/09/2026 Date of Commencement of Examination 31/01/2027 Duration of Examination One Day Last Date for Receipt of Applications 06/10/2026 - 6:00pm Date of Upload 16/09/2026 Download Notification <a href="/sites/default/files/Notif-ESEP-2027.pdf">Notice</a></div>`;
  const context: ConnectorContext = {
    source: { id: "in-upsc", name: "UPSC", country: "IN", authority: "Union Public Service Commission", homepage: "https://www.upsc.gov.in/examinations/active-exams", connector: "upsc", cadenceHours: 6, licence: "", enabled: true },
    now: new Date("2026-09-25T00:00:00Z"), env: {}, log: () => {},
    fetchText: async (url) => {
      assert.ok(url === examUrl || url === "https://www.upsc.gov.in/examinations/active-exams");
      const text = url === examUrl ? page : list;
      const evidence: Evidence = { url, fetchedAt: "2026-09-25T00:00:00Z", sha256: "a".repeat(64), contentType: "text/html", bytes: Buffer.byteLength(text) };
      return { text, evidence };
    },
  };
  const result = await upsc(context);
  assert.equal(result.cycles.length, 1);
  const cycle = result.cycles[0];
  assert.equal(cycle.applicationUrl, "https://upsconline.nic.in/");
  assert.equal(cycle.sources[0].fetchStatus, "fetched");
  assert.equal(cycle.sources[1].fetchStatus, "linked");
  assert.equal(cycle.sources[1].sha256, undefined);
  assert.equal(cycle.sources[1].lastSuccessfulFetchAt, null);
});

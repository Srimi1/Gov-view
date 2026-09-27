import assert from "node:assert/strict";
import test from "node:test";
import { demoOpportunities, type OpportunityCycle } from "./opportunities.ts";
import { approvedFeedEntries, renderAtom, renderRss } from "./feed.ts";

function record(): OpportunityCycle {
  const revision = "a".repeat(64);
  return {
    ...demoOpportunities[0], fixture: false, publicationApproved: true, evidenceRevision: revision,
    reviewDecision: { status: "approved", evidenceRevision: revision, recordRevision: "b".repeat(64), reviewer: "Reviewer", reviewedAt: "2026-09-25T10:00:00Z" },
    sources: [{ ...demoOpportunities[0].sources[0], verificationStatus: "verified", url: "https://official.example/notice" }],
    changes: [
      { at: "2026-09-25T10:00:00Z", kind: "created", summary: "New <notice> & details" },
      { at: "2026-09-25T11:00:00Z", kind: "source-failure", summary: "Fetch failed" },
      { at: "2026-09-25T12:00:00Z", kind: "updated", summary: "Legacy health update" },
      { at: "2026-09-25T13:00:00Z", kind: "extended", summary: "Deadline extended" },
    ],
  };
}

test("feeds include only approved material changes with stable ids", () => {
  const entries = approvedFeedEntries(record(), "https://gov.example");
  assert.equal(entries.length, 2);
  assert.equal(entries[0].url, `https://gov.example/job/?id=${record().id}`);
  assert.match(entries[1].id, /extended/);
  const rss = renderRss("GOV View", entries, "https://gov.example/");
  const atom = renderAtom("GOV View", "urn:govview:feed:IN", entries, "https://gov.example/", new Date("2026-09-26T00:00:00Z"));
  assert.match(rss, /New &lt;notice&gt; &amp; details/);
  assert.doesNotMatch(rss, /Fetch failed|Legacy health update/);
  assert.match(atom, /<updated>2026-09-25T13:00:00.000Z<\/updated>/);
  assert.equal((rss.match(/<item>/g) ?? []).length, 2);
});

test("pending records produce no feed entries", () => {
  const item = record();
  item.publicationApproved = false;
  assert.deepEqual(approvedFeedEntries(item), []);
});

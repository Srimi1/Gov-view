import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { OpportunityCycle } from "./opportunities.ts";
import { approvalRevisions } from "./review.server.ts";

test("static pages include only current approved evidence revisions", async () => {
  const originalCwd = process.cwd();
  const scratch = mkdtempSync(join(tmpdir(), "govview-pages-"));
  try {
    const sample = (JSON.parse(readFileSync(join(originalCwd, "data/published/cycles/IN.json"), "utf8")) as OpportunityCycle[])[0];
    const approved = { ...sample, id: "approved-cycle", reviewDecision: undefined } as OpportunityCycle;
    const revisions = approvalRevisions(approved);
    approved.reviewDecision = { status: "approved", reviewer: "test reviewer", reviewedAt: "2026-09-25T12:00:00Z", minutesSpent: 3, ...revisions };
    const stale = { ...approved, id: "stale-cycle", title: "Changed after review" };
    const unreviewed = { ...sample, id: "legacy-cycle", reviewDecision: undefined };
    mkdirSync(join(scratch, "data/published/cycles"), { recursive: true });
    mkdirSync(join(scratch, "public/data"), { recursive: true });
    writeFileSync(join(scratch, "data/published/cycles/IN.json"), JSON.stringify([stale, unreviewed, approved]));
    writeFileSync(join(scratch, "public/data/approved-pages.json"), JSON.stringify({ ids: [stale.id, unreviewed.id, approved.id] }));
    process.chdir(scratch);
    const { approvedStaticPages } = await import("./static-pages.server.ts");
    assert.deepEqual(approvedStaticPages().map((item) => item.id), [approved.id]);
  } finally {
    process.chdir(originalCwd);
    rmSync(scratch, { recursive: true, force: true });
  }
});

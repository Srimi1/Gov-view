// Internal research only. Uses the existing robots, throttle and TLS policies.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { politeFetchBytes } from "../connectors/http.ts";

const requestPath = "data/discovery/india-admission-2026-09-27-requests.json";
const outcomePath = "data/discovery/india-admission-2026-09-27-fetch-outcomes.json";
const requests = JSON.parse(await readFile(requestPath, "utf8"));
let previous = [];
try { previous = JSON.parse(await readFile(outcomePath, "utf8")); }
catch (error) { if (error.code !== "ENOENT") throw error; }
const pending = requests.filter(request => !previous.some(result => result.url === request.url));
const groups = Map.groupBy(pending, request => new URL(request.url).hostname);
await mkdir("data/evidence/research", { recursive: true });
const outcomes = [...previous];
let save = Promise.resolve();
await Promise.all([...groups.values()].map(async group => {
  for (const request of group) {
    const attemptedAt = new Date().toISOString();
    const stem = `data/evidence/research/india65-${request.sourceId}-${request.label}-2026-09-27`;
    try {
      const result = await politeFetchBytes(request.url);
      const isPdf = result.bytes.subarray(0, 5).toString() === "%PDF-";
      if (request.format === "PDF" && !isPdf) throw new Error("Expected PDF; response has no PDF signature");
      if (request.format === "HTML" && !/html/i.test(result.evidence.contentType)) throw new Error(`Expected HTML; received ${result.evidence.contentType}`);
      const path = `${stem}.${request.format === "PDF" ? "pdf" : "html"}`;
      await writeFile(path, result.bytes);
      outcomes.push({ ...request, status: "retained", path, evidence: result.evidence });
      console.log(`${request.sourceId} ${request.label}: retained ${result.bytes.length} bytes`);
    } catch (error) {
      const path = `${stem}-failure.json`;
      const result = { ...request, status: "failed", path, attemptedAt, error: error.message };
      await writeFile(path, JSON.stringify(result, null, 2) + "\n");
      outcomes.push(result);
      console.log(`${request.sourceId} ${request.label}: failed ${error.message}`);
    }
    // Preserve each completed request even if a later host fails or execution stops.
    const snapshot = JSON.stringify(outcomes, null, 2) + "\n";
    save = save.then(() => writeFile(outcomePath, snapshot));
    await save;
  }
}));
await save;

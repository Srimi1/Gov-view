"use client";

import { useEffect, useState } from "react";
import { withBase } from "@/lib/base-path";
import { loadDetailById } from "@/lib/data-client";
import type { OpportunityCycle } from "@/lib/opportunities";
import {
  TRACKER_MAX_BYTES, compareTracked, mergeTracker, parseTrackerDocument,
  readTracker, snapshotOpportunity, writeTracker, type TrackedOpportunity,
  type TrackerComparison,
} from "@/lib/tracker";

const comparisonText: Record<TrackerComparison, string> = {
  unchanged: "No verified change since saved",
  "verified-change": "Verified record changed since saved",
  "now-reviewed": "Record now has a reviewed revision",
  "awaiting-review": "Current details awaiting review",
  "source-unavailable": "Current record unavailable; saved copy kept",
};

function downloadJson(entries: TrackedOpportunity[]) {
  const blob = new Blob([JSON.stringify({ version: 1, entries }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "gov-view-tracker.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export default function LocalTracker({ item }: { item: OpportunityCycle }) {
  const [entries, setEntries] = useState<TrackedOpportunity[]>([]);
  const [comparisons, setComparisons] = useState<Record<string, TrackerComparison | "checking">>({});
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try { setEntries(readTracker(window.localStorage).entries); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Local storage unavailable."); }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded || !entries.length) return;
    let cancelled = false;
    setComparisons(Object.fromEntries(entries.map((entry) => [entry.id, "checking"])));
    async function worker(offset: number) {
      for (let index = offset; index < entries.length; index += 2) {
        const saved = entries[index];
        let status: TrackerComparison;
        try {
          const current = saved.id === item.id ? item : await loadDetailById(saved.id);
          status = compareTracked(saved, current);
        } catch { status = "source-unavailable"; }
        if (cancelled) return;
        setComparisons((previous) => ({ ...previous, [saved.id]: status }));
      }
    }
    void Promise.all([worker(0), worker(1)]);
    return () => { cancelled = true; };
  }, [entries, item, loaded]);

  function persist(next: TrackedOpportunity[]) {
    try { writeTracker(window.localStorage, next); setEntries(next); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Local storage unavailable."); }
  }

  async function importFile(file: File | undefined) {
    if (!file) return;
    if (file.size > TRACKER_MAX_BYTES) { setError("Tracker file is too large."); return; }
    try {
      const incoming = parseTrackerDocument(await file.text());
      persist(mergeTracker(entries, incoming.entries));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Tracker import failed."); }
  }

  const saved = entries.some((entry) => entry.id === item.id);
  return (
    <div className="applicant-tool" style={{ display: "grid", gap: 12, justifyItems: "start", marginBlock: 12 }}>
      <p className="fine-print">Saved notices stay on this device. No account or upload.</p>
      <button className="button-quiet" type="button" disabled={!loaded} onClick={() => persist(saved ? entries.filter((entry) => entry.id !== item.id) : mergeTracker(entries, [snapshotOpportunity(item)]))}>
        {saved ? "Remove this notice" : "Save this notice"}
      </button>
      {error && <p className="field-error" role="alert">{error}</p>}
      {entries.length > 0 && <ul className="source-list" style={{ marginBlock: 12 }}>
        {entries.map((entry) => <li key={entry.id}>
          <a href={withBase(`/job/?id=${encodeURIComponent(entry.id)}`)}>{entry.title}</a>
          <small>{comparisonText[comparisons[entry.id] as TrackerComparison] ?? "Checking current record…"}</small>
          <small>Saved {new Date(entry.savedAt).toLocaleDateString()} · {entry.status}{entry.closesOn ? ` · deadline ${entry.closesOn}` : ""}</small>
        </li>)}
      </ul>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBlock: 12 }}>
        <button className="button-quiet" type="button" disabled={!entries.length} onClick={() => downloadJson(entries)}>Export JSON</button>
        <label className="button-quiet" style={{ cursor: "pointer" }}>Import JSON
          <input className="visually-hidden" type="file" accept="application/json,.json" onChange={(event) => { void importFile(event.target.files?.[0]); event.target.value = ""; }} />
        </label>
        <button className="button-quiet danger" type="button" disabled={!entries.length} onClick={() => { if (window.confirm("Delete all saved notices from this device?")) persist([]); }}>Clear all</button>
      </div>
    </div>
  );
}

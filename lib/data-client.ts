"use client";

import { withBase } from "./base-path.ts";
import { demoOpportunities, forceDemo, liveStatus, type CycleSummary, type OpportunityCycle } from "./opportunities.ts";

export interface DataIndex {
  generatedAt: string;
  revision?: string;
  total: number;
  approvedTotal?: number;
  coverage?: { jurisdictionsTotal: number; jurisdictionsWithRecords: number; jurisdictionsWithApprovedRecords: number };
  shards?: { listSize: number; detailSize: number };
  directLookup?: string;
  countries: { code: string; count: number; approvedCount?: number; listShards?: number }[];
  feeds?: {
    countries: { key: string; rss: string; atom: string }[];
    authorities: { key: string; rss: string; atom: string }[];
  };
}

export interface LoadedData {
  demo: boolean;
  items: CycleSummary[];
  generatedAt: string | null;
  loadedCount: number;
  total: number;
  complete: boolean;
  completeCountries: string[];
  errors: string[];
}

async function json<T>(path: string): Promise<T> {
  const response = await fetch(withBase(path));
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

let indexPromise: Promise<DataIndex> | null = null;
export function loadIndex(): Promise<DataIndex> {
  if (!indexPromise) {
    indexPromise = json<DataIndex>("/data/index.json");
    indexPromise.catch(() => { indexPromise = null; });
  }
  return indexPromise;
}

const progressListeners = new Set<(data: LoadedData) => void>();
let dataPromise: Promise<LoadedData> | null = null;
let latestData: LoadedData | null = null;
let rawItems: CycleSummary[] = [];
const listShards = new Map<string, CycleSummary[]>();
let demoSession = false;

function useDemo(): boolean {
  if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "1") demoSession = true;
  return forceDemo || demoSession;
}

function currentStatus(items: CycleSummary[]): CycleSummary[] {
  return items.map((item) => ({ ...item, status: liveStatus(item) }));
}

function publishProgress(data: LoadedData) {
  latestData = data;
  for (const listener of progressListeners) listener(data);
}

/** Update deadlines without downloading again; call on minute tick and tab focus. */
export function refreshLoadedStatuses(): LoadedData | null {
  if (!latestData) return null;
  const refreshed = { ...latestData, items: currentStatus(rawItems) };
  publishProgress(refreshed);
  return refreshed;
}

/** Fetch lists incrementally; initial view needs one shard per country only. */
export function loadData(onProgress?: (data: LoadedData) => void, initialOnly = false, countryCode?: string): Promise<LoadedData> {
  if (onProgress) {
    progressListeners.add(onProgress);
    if (latestData) onProgress(latestData);
  }
  if (dataPromise) return dataPromise;
  if (useDemo()) {
    rawItems = demoOpportunities;
    const demo: LoadedData = { demo: true, items: demoOpportunities, generatedAt: null, loadedCount: demoOpportunities.length, total: demoOpportunities.length, complete: true, completeCountries: [...new Set(demoOpportunities.map((item) => item.jurisdictionCode))], errors: [] };
    publishProgress(demo);
    dataPromise = Promise.resolve(demo);
    return dataPromise;
  }
  dataPromise = (async () => {
    const index = await loadIndex();
    const errors: string[] = [];
    const taskGroups = index.countries.map((country) => ({ code: country.code, tasks: typeof country.listShards === "number"
      ? Array.from({ length: country.listShards }, (_, shard) => `/data/list/${country.code}-${shard}.json`)
      : [`/data/list/${country.code}.json`] })); // older exports
    const tasks = taskGroups.flatMap((group) => group.tasks);
    const required = countryCode ? taskGroups.find((group) => group.code === countryCode)?.tasks ?? []
      : initialOnly ? taskGroups.flatMap((group) => group.tasks.slice(0, 1)) : tasks;
    const snapshot = (complete: boolean): LoadedData => {
      rawItems = tasks.flatMap((task) => listShards.get(task) ?? []);
      const completeCountries = taskGroups.filter((group) => group.tasks.every((task) => listShards.has(task))).map((group) => group.code);
      if (countryCode && !taskGroups.some((group) => group.code === countryCode)) completeCountries.push(countryCode);
      return { demo: false, items: currentStatus(rawItems), generatedAt: index.generatedAt, loadedCount: rawItems.length, total: index.total, complete, completeCountries, errors: [...errors] };
    };
    publishProgress(snapshot(!tasks.length));
    const missing = required.filter((task) => !listShards.has(task));
    let cursor = 0;
    let lastNotified = 0;
    const worker = async () => {
      while (cursor < missing.length) {
        const task = missing[cursor++];
        try {
          listShards.set(task, await json<CycleSummary[]>(task));
        } catch (error) {
          errors.push(error instanceof Error ? error.message : String(error));
        }
        const now = Date.now();
        if (now - lastNotified >= 250 || cursor >= missing.length) {
          lastNotified = now;
          publishProgress(snapshot(false));
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, missing.length) }, worker));
    const result = snapshot(errors.length === 0 && tasks.every((task) => listShards.has(task)));
    publishProgress(result);
    if (!result.complete) dataPromise = null; // next click loads only missing shards
    return result;
  })();
  dataPromise.catch(() => { dataPromise = null; });
  return dataPromise;
}

export function unsubscribeData(listener: (data: LoadedData) => void) {
  progressListeners.delete(listener);
}

const detailShards = new Map<string, Promise<OpportunityCycle[]>>();
async function detailShard(code: string, shard: number): Promise<OpportunityCycle[]> {
  const key = `${code}-${shard}`;
  let value = detailShards.get(key);
  if (!value) {
    value = json<OpportunityCycle[]>(`/data/detail/${key}.json`);
    detailShards.set(key, value);
    value.catch(() => detailShards.delete(key));
  }
  return value;
}

/** Full record for known list entry, independently retryable. */
export async function loadDetail(summary: CycleSummary): Promise<OpportunityCycle | null> {
  if (summary.fixture) return demoOpportunities.find((item) => item.id === summary.id) ?? null;
  if (summary.shard === undefined) return null;
  const record = (await detailShard(summary.jurisdictionCode, summary.shard)).find((item) => item.id === summary.id);
  return record ? { ...record, status: liveStatus(record) } : null;
}

interface IdIndex { ids: Record<string, { code: string; shard: number }>; aliases: Record<string, string[]> }
let idIndexPromise: Promise<IdIndex> | null = null;
function loadIdIndex(): Promise<IdIndex> {
  if (!idIndexPromise) {
    idIndexPromise = loadIndex().then((index) => json<IdIndex>(index.directLookup ?? "/data/id-index.json"));
    idIndexPromise.catch(() => { idIndexPromise = null; });
  }
  return idIndexPromise;
}

export class AmbiguousCycleIdError extends Error {
  readonly candidates: string[];
  constructor(candidates: string[]) {
    super("Multiple annual editions match this old link.");
    this.candidates = candidates;
  }
}

/** Direct lookup avoids worldwide lists for a shared URL or saved notice. */
export async function loadDetailById(id: string): Promise<OpportunityCycle | null> {
  if (useDemo()) return demoOpportunities.find((item) => item.id === id) ?? null;
  const lookup = await loadIdIndex();
  const targets = lookup.aliases[id] ?? [id];
  if (targets.length > 1) throw new AmbiguousCycleIdError(targets);
  const target = targets[0];
  const location = lookup.ids[target];
  if (!location) return null;
  const record = (await detailShard(location.code, location.shard)).find((item) => item.id === target);
  return record ? { ...record, status: liveStatus(record) } : null;
}

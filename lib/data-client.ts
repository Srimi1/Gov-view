"use client";

import { withBase } from "./base-path.ts";
import { demoOpportunities, forceDemo, liveStatus, type CycleSummary, type OpportunityCycle } from "./opportunities.ts";

export interface LoadedData {
  demo: boolean;
  items: CycleSummary[];
  generatedAt: string | null;
}

async function json<T>(path: string): Promise<T> {
  const response = await fetch(withBase(path));
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

const withLiveStatus = (items: CycleSummary[]) => items.map((item) => ({ ...item, status: liveStatus(item) }));

let cached: Promise<LoadedData> | null = null;

/** All list records. Falls back to demo records until real data is published. */
export function loadData(): Promise<LoadedData> {
  if (cached) return cached;
  cached = (async () => {
    if (forceDemo) return { demo: true, items: demoOpportunities, generatedAt: null };
    try {
      const index = await json<{ total: number; generatedAt: string; countries: { code: string }[] }>("/data/index.json");
      if (!index.total) return { demo: true, items: demoOpportunities, generatedAt: null };
      const lists = await Promise.all(index.countries.map((country) => json<CycleSummary[]>(`/data/list/${country.code}.json`)));
      return { demo: false, items: withLiveStatus(lists.flat()), generatedAt: index.generatedAt };
    } catch (error) {
      console.warn("GOV View data unavailable, showing demo records", error);
      return { demo: true, items: demoOpportunities, generatedAt: null };
    }
  })();
  cached.catch(() => { cached = null; });
  return cached;
}

const shards = new Map<string, Promise<OpportunityCycle[]>>();

/** Full record for a list entry. Demo records are already complete. */
export async function loadDetail(summary: CycleSummary): Promise<OpportunityCycle | null> {
  if (summary.fixture || summary.shard === undefined) return demoOpportunities.find((item) => item.id === summary.id) ?? null;
  const key = `${summary.jurisdictionCode}-${summary.shard}`;
  let shard = shards.get(key);
  if (!shard) {
    shard = json<OpportunityCycle[]>(`/data/detail/${key}.json`);
    shards.set(key, shard);
    shard.catch(() => shards.delete(key));
  }
  const record = (await shard).find((item) => item.id === summary.id);
  return record ? { ...record, status: liveStatus(record) } : null;
}

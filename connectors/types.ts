import type { OpportunityCycle } from "../lib/opportunities.ts";
import type { FetchInit } from "./http.ts";

/** What a connector knows about one source in the registry. */
export interface SourceConfig {
  id: string;
  name: string;
  country: string;
  authority: string;
  homepage: string;
  connector: string;
  /** Hours between checks. Active sources run hourly, the rest daily. */
  cadenceHours: number;
  /** Environment variables the connector needs (free API keys). Never committed. */
  secrets?: string[];
  licence: string;
  notes?: string;
  enabled: boolean;
  /** Optional cap for very large feeds; the coverage page says when it applies. */
  maxRecords?: number;
  /**
   * Hosts whose robots.txt is not applied for this source, with the reason.
   * Only for official open-data files published for reuse; approved by the maintainer.
   */
  robotsException?: { hosts: string[]; reason: string; approvedOn: string };
}

/** Raw evidence kept for review: what we fetched, when, and its hash. */
export interface Evidence {
  url: string;
  fetchedAt: string;
  sha256: string;
  contentType: string;
  bytes: number;
}

/** A connector turns one official source into candidate cycles. It never publishes. */
export interface ConnectorResult {
  cycles: OpportunityCycle[];
  evidence: Evidence[];
  /** Total available at the source, when larger than what was kept (maxRecords). */
  totalAvailable?: number;
  warnings: string[];
}

export interface ConnectorContext {
  source: SourceConfig;
  now: Date;
  fetchText: (url: string, init?: FetchInit) => Promise<{ text: string; evidence: Evidence }>;
  env: Record<string, string | undefined>;
  log: (message: string) => void;
}

export type Connector = (context: ConnectorContext) => Promise<ConnectorResult>;

export class MissingSecretError extends Error {
  readonly names: string[];
  constructor(names: string[]) {
    super(`Missing secret(s): ${names.join(", ")}`);
    this.names = names;
  }
}

import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import { withBase } from "@/lib/base-path";
import { dateLabel } from "@/lib/format";
import { jurisdictions } from "@/lib/opportunities";
import { publishedOverview } from "@/lib/published.server";

export const metadata: Metadata = {
  title: "Where we look",
  description: "Which official sources GOV View checks in each country, when they were last checked, and what is still missing.",
};

const stateText = {
  "verified-listings": "Listings from checked sources",
  "sources-checked-no-current": "Sources checked — nothing open right now",
  "no-verified-listings": "Not covered yet",
} as const;

export default function CoveragePage() {
  const { demo, sources, status, coverage, counts } = publishedOverview();
  return (
    <div className="app">
      <SiteHeader current="coverage" />
      <div />
      <main className="page">
        <div className="page-inner">
          <h1>Where we look</h1>
          <p className="lede">
            We only list opportunities from official sources: recruitment boards, public service commissions, regulators and gazettes.
            Here's what we check in each country, when it last worked, and the gaps we know about.
            "Nothing open right now" and "not covered yet" are different — the first means we looked.
          </p>
          {demo && <p className="lede"><strong>No real data has been published yet, so this page shows demo entries.</strong></p>}
          <div className="coverage-grid">
            {jurisdictions.map((jurisdiction) => {
              const record = coverage.find((item) => item.jurisdictionCode === jurisdiction.code);
              const state = record?.status ?? "no-verified-listings";
              const countrySources = sources.filter((source) => source.country === jurisdiction.code);
              return (
                <article className="coverage-card" key={jurisdiction.code}>
                  <h2>{jurisdiction.name}</h2>
                  <p className={`coverage-state ${state}`}>{stateText[state]}</p>
                  <dl>
                    <dt>Listed</dt><dd>{demo ? "—" : counts[jurisdiction.code] ?? 0}</dd>
                    <dt>Last checked</dt><dd>{dateLabel(record?.lastSuccessfulFetchAt, "Never")}</dd>
                  </dl>
                  {!demo && countrySources.length > 0 && (
                    <ul className="source-list">
                      {countrySources.map((source) => {
                        const info = status[source.id];
                        const note = !source.enabled ? "Not connected" : info?.needsSecret ? "Waiting for a free API key" : info?.lastError ? `Last check failed: ${info.lastError}` : info?.lastSuccessfulFetchAt ? `${info.recordCount} records · checked ${dateLabel(info.lastSuccessfulFetchAt)}` : "Not checked yet";
                        return (
                          <li key={source.id}>
                            <a href={source.homepage} target="_blank" rel="noopener noreferrer">{source.name}</a>
                            <small>{note}</small>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {!!record?.unresolvedGaps.length && (<><strong>Known gaps</strong><ul>{record.unresolvedGaps.map((gap) => <li key={gap}>{gap}</li>)}</ul></>)}
                  <a href={withBase(`/?country=${jurisdiction.code}`)}>See {jurisdiction.name} opportunities →</a>
                </article>
              );
            })}
          </div>
          <p className="lede" style={{ marginTop: 32 }}>
            Know an official source we're missing? GOV View is open source — add it to <code>sources/registry.json</code> and open a pull request.
          </p>
        </div>
      </main>
    </div>
  );
}

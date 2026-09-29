"use client";

import { useEffect, useState } from "react";
import { filterSourceDirectory, readSourceFilters, sourceFilterSearch, type SourceFilters } from "@/lib/source-directory";
import { isSafeHttpUrl } from "@/lib/safe-url";

/** Public display fields only; collector configuration stays on the server. */
export interface SourceDirectoryEntry {
  id: string;
  name: string;
  authority: string;
  homepage: string;
  collectionStatus: string;
  jurisdictions: { code: string; name: string }[];
  notes?: string;
  accessGap?: string;
  discoveredFrom?: string;
  discoveredAt?: string;
}

const noJurisdictionOptions: { code: string; name: string }[] = [];

export default function SourceDirectory({ entries, jurisdictionOptions = noJurisdictionOptions }: {
  entries: SourceDirectoryEntry[];
  jurisdictionOptions?: { code: string; name: string }[];
}) {
  const [filters, setFilters] = useState<SourceFilters>({ query: "", jurisdiction: "", includeUnscoped: false });
  useEffect(() => {
    const restore = () => setFilters(readSourceFilters(window.location.search, jurisdictionOptions));
    restore();
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [jurisdictionOptions]);
  const updateFilters = (next: SourceFilters) => {
    setFilters(next);
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${sourceFilterSearch(next)}${window.location.hash}`);
  };
  const visible = filterSourceDirectory(entries, filters);
  const selectedJurisdiction = jurisdictionOptions.find(option => option.code === filters.jurisdiction);

  return <>
    <p>Source research can describe appointment types, international applicants and language requirements. It awaits review and does not establish whether you can apply, enter selection or obtain the resulting job or credential. Check the specific cycle and its official evidence.</p>
    {jurisdictionOptions.length > 0 && <>
      <label className="country-search" htmlFor="source-jurisdiction">Source jurisdiction
        <select id="source-jurisdiction" value={filters.jurisdiction} onChange={event => updateFilters({ ...filters, jurisdiction: event.target.value })} aria-describedby="source-jurisdiction-help">
          <option value="">All source jurisdictions</option>
          {jurisdictionOptions.map(({ code, name }) => <option key={code} value={code}>{name}</option>)}
        </select>
      </label>
      <p id="source-jurisdiction-help" className="source-search-help">Filters recorded source scope. It does not test applicant residence, citizenship or eligibility.</p>
      {filters.jurisdiction && <label className="source-scope-option">
        <input type="checkbox" checked={filters.includeUnscoped} onChange={event => updateFilters({ ...filters, includeUnscoped: event.target.checked })} />
        Include sources without a recorded state or territory scope
      </label>}
    </>}
    <label className="country-search" htmlFor="source-search">Search official sources
      <input id="source-search" type="search" maxLength={200} value={filters.query} onChange={(event) => updateFilters({ ...filters, query: event.target.value })} placeholder="Authority, state, citizenship or language" aria-describedby="source-search-help" />
    </label>
    <p id="source-search-help" className="source-search-help">Search matches written research, including restrictions and unresolved questions. A match is not an eligibility result.</p>
    <p className="country-results" role="status">{visible.length} of {entries.length} registered sources{selectedJurisdiction ? ` · ${selectedJurisdiction.name}` : ""}. Source counts are not application-cycle counts.</p>
    {(filters.query || filters.jurisdiction) && <button type="button" className="source-clear" onClick={() => updateFilters({ query: "", jurisdiction: "", includeUnscoped: false })}>Clear source filters</button>}
    {visible.length ? <ul className="country-source-list">{visible.map((entry) => <li key={entry.id}>
      {isSafeHttpUrl(entry.homepage) ? <a href={entry.homepage} target="_blank" rel="noopener noreferrer">{entry.name} ↗</a> : <span>{entry.name}</span>}
      <span>{entry.authority}</span>
      <small>Collection status: {entry.collectionStatus}</small>
      {entry.jurisdictions.length > 0 && <small>Jurisdiction: {entry.jurisdictions.map(({ code, name }) => `${name} (${code})`).join(", ")}</small>}
      <div className="source-research">
        <strong>Applicant and source research — awaiting review</strong>
        <p>{entry.notes || "No applicant research recorded for this source. Appointment type, international-applicant permission and language criteria need the specific official notice."}</p>
      </div>
      {entry.accessGap && <div className="source-gap"><strong>Collection gap</strong><p>{entry.accessGap}</p></div>}
      {isSafeHttpUrl(entry.discoveredFrom) && <small><a href={entry.discoveredFrom} target="_blank" rel="noopener noreferrer">Source identification evidence ↗</a>{entry.discoveredAt ? ` · researched ${entry.discoveredAt}` : ""}</small>}
    </li>)}</ul> : <p>No registered source matches this text. This does not mean there are no opportunities or that you are ineligible.</p>}
  </>;
}

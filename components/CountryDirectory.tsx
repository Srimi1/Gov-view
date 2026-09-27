"use client";

import { useState } from "react";
import { withBase } from "@/lib/base-path";

interface CountryEntry {
  code: string;
  name: string;
  count: number;
  approvedCount: number;
  research: string;
}

export default function CountryDirectory({ entries }: { entries: CountryEntry[] }) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLocaleLowerCase();
  const visible = entries.filter(({ code, name }) => `${name} ${code}`.toLocaleLowerCase().includes(needle));
  return <>
    <label className="country-search" htmlFor="country-search">Find country or territory
      <input id="country-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name or jurisdiction code" />
    </label>
    <p className="country-results" role="status">{visible.length} of {entries.length} places</p>
    <ul className="country-directory">
      {visible.map(({ code, name, count, approvedCount, research }) => <li key={code}>
        <a href={withBase(`/coverage/${code}/`)}><span>{name} <small>{code}</small></span><span>{approvedCount ? `${approvedCount.toLocaleString()} reviewed` : count ? `${count.toLocaleString()} records; review pending` : research}</span></a>
      </li>)}
    </ul>
  </>;
}

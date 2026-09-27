export interface SourceFilters {
  query: string;
  jurisdiction: string;
  includeUnscoped: boolean;
}

interface SearchableSource {
  name: string;
  authority: string;
  notes?: string;
  accessGap?: string;
  jurisdictions: { code: string; name: string }[];
}

export function readSourceFilters(search: string, options: { code: string }[]): SourceFilters {
  const params = new URLSearchParams(search);
  const state = params.get("state") ?? "";
  return {
    query: (params.get("sourceQuery") ?? "").slice(0, 200),
    jurisdiction: options.some(option => option.code === state) ? state : "",
    includeUnscoped: params.get("unscoped") === "1",
  };
}

/** Only public source-directory display state belongs in these links. */
export function sourceFilterSearch(filters: SourceFilters): string {
  const params = new URLSearchParams();
  if (filters.query) params.set("sourceQuery", filters.query.slice(0, 200));
  if (filters.jurisdiction) {
    params.set("state", filters.jurisdiction);
    if (filters.includeUnscoped) params.set("unscoped", "1");
  }
  return params.size ? `?${params.toString()}` : "";
}

export function filterSourceDirectory<T extends SearchableSource>(entries: T[], filters: SourceFilters): T[] {
  const needle = filters.query.trim().toLocaleLowerCase();
  return entries.filter(entry => {
    if (filters.jurisdiction && !entry.jurisdictions.some(({ code }) => code === filters.jurisdiction)
      && !(filters.includeUnscoped && entry.jurisdictions.length === 0)) return false;
    return [entry.name, entry.authority, entry.notes, entry.accessGap,
      ...entry.jurisdictions.flatMap(({ code, name }) => [code, name]),
    ].join(" ").toLocaleLowerCase().includes(needle);
  });
}

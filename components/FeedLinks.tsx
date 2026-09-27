"use client";

import { useEffect, useState } from "react";
import { loadIndex } from "@/lib/data-client";
import { withBase } from "@/lib/base-path";
import type { OpportunityCycle } from "@/lib/opportunities";

type FeedLink = { key: string; rss: string; atom: string };
type FeedIndex = { feeds?: { countries?: FeedLink[]; authorities?: FeedLink[] } };

export default function FeedLinks({ item }: { item: OpportunityCycle }) {
  const [links, setLinks] = useState<FeedLink[]>([]);
  useEffect(() => {
    let active = true;
    loadIndex().then((index) => {
      if (!active) return;
      const feeds = (index as FeedIndex).feeds;
      setLinks([
        ...(feeds?.countries ?? []).filter((feed) => feed.key === item.jurisdictionCode),
        ...(feeds?.authorities ?? []).filter((feed) => feed.key === item.authority),
      ]);
    }).catch(() => { if (active) setLinks([]); });
    return () => { active = false; };
  }, [item.authority, item.jurisdictionCode]);
  if (!links.length) return <p className="fine-print">No reviewed material changes feed yet for this country or authority.</p>;
  return <div className="applicant-tool" style={{ display: "grid", gap: 8, marginBlock: 12 }}>
    {links.map((feed) => <p key={feed.key}>
      {feed.key} changes: <a href={withBase(feed.rss)}>RSS</a> · <a href={withBase(feed.atom)}>Atom</a>
    </p>)}
  </div>;
}

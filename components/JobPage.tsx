"use client";

import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import JobArticle from "@/components/JobArticle";
import ProfileDialog from "@/components/ProfileDialog";
import SiteHeader from "@/components/SiteHeader";
import { useProfile } from "@/components/useProfile";
import { withBase } from "@/lib/base-path";
import { loadData, loadDetail } from "@/lib/data-client";
import { profileIsEmpty } from "@/lib/eligibility/evaluate";
import type { OpportunityCycle } from "@/lib/opportunities";

/** Shareable page for one opportunity: /job/?id=<id>. */
export default function JobPage() {
  const { profile, update, clear } = useProfile();
  const [open, setOpen] = useState(false);
  const [item, setItem] = useState<OpportunityCycle | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) { setState("missing"); return; }
    loadData()
      .then((data) => {
        const summary = data.items.find((entry) => entry.id === id);
        return summary ? loadDetail(summary) : null;
      })
      .then((record) => {
        setItem(record);
        setState(record ? "ready" : "missing");
        if (record) document.title = `${record.title} — GOV View`;
      })
      .catch(() => setState("missing"));
  }, []);

  return (
    <div className="app">
      <SiteHeader current="job" onProfile={() => setOpen(true)} hasProfile={!profileIsEmpty(profile)} />
      <div />
      <main className="page">
        <div className="job-page">
          <a className="back-link" href={withBase(item ? `/?cycle=${encodeURIComponent(item.id)}` : "/")}><ArrowLeft size={15} aria-hidden="true" />All opportunities</a>
          {state === "ready" && item && <JobArticle item={item} profile={profile} onEditProfile={() => setOpen(true)} />}
          {state === "loading" && <p className="reader-empty" role="status">Loading…</p>}
          {state === "missing" && (
            <div className="empty">
              <p><strong>We couldn't find this opportunity.</strong></p>
              <p>It may have closed and been removed. <a href={withBase("/")}>Search current opportunities</a>.</p>
            </div>
          )}
        </div>
      </main>
      <ProfileDialog open={open} profile={profile} onClose={() => setOpen(false)} onSave={update} onClear={clear} />
    </div>
  );
}

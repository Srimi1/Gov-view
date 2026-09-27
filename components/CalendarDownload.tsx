"use client";

import { useState } from "react";
import type { OpportunityCycle } from "@/lib/opportunities";
import { calendarForOpportunity } from "@/lib/ics";
import { approvedRevision } from "@/lib/public-approval";

export default function CalendarDownload({ item }: { item: OpportunityCycle }) {
  const [message, setMessage] = useState("");
  const approved = !!approvedRevision(item);
  function download() {
    const calendar = calendarForOpportunity(item);
    if (!calendar) { setMessage("No verified date and official source are ready for calendar export."); return; }
    const url = URL.createObjectURL(new Blob([calendar], { type: "text/calendar;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${item.id}.ics`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    setMessage("Calendar downloaded. Confirm dates on the official site; downloaded copies do not update automatically.");
  }
  return (
    <div className="applicant-tool" style={{ display: "grid", gap: 8, justifyItems: "start", marginBlock: 12 }}>
      <button type="button" className="button-quiet" disabled={!approved} onClick={download}>Download calendar (.ics)</button>
      {!approved && <p className="fine-print">Calendar export waits for review of this notice and its dates.</p>}
      {message && <p className="fine-print" role="status">{message}</p>}
    </div>
  );
}

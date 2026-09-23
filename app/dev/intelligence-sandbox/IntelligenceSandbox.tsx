"use client";

import { useState } from "react";
import { CoachBriefPanel } from "@/app/clients/[clientId]/submissions/[submissionId]/CoachBriefPanel";

export function IntelligenceSandbox() {
  const [reviewed, setReviewed] = useState(false);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">Client</p>
      <h1 className="font-display text-4xl tracking-tight">Jordan Client</h1>
      <p className="mt-2">
        {reviewed ? "Reviewed" : <span className="rounded-full bg-warn/15 px-3 py-1 text-warn">Needs Review</span>}
      </p>
      {!reviewed ? (
        <button type="button" className="mt-4 rounded-full border border-line px-4 py-2" onClick={() => setReviewed(true)}>
          Mark reviewed
        </button>
      ) : null}
      <section className="mt-10">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">Client-provided information</p>
        <h2 className="mt-2 font-display text-3xl tracking-tight">Submitted Information</h2>
        <p className="mt-4" data-testid="original-answer">
          Current injuries: Yes
        </p>
      </section>
      <section className="mt-10">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">Deterministic review flags</p>
        <h2 className="mt-2 font-display text-3xl tracking-tight">Coach Review Needed</h2>
        <p className="mt-2 text-xs uppercase tracking-[0.18em] text-muted">Review flag</p>
        <p className="font-display text-xl tracking-tight">Current injury or pain reported</p>
      </section>
      <CoachBriefPanel
        submissionId="sub_sandbox"
        initial={{ status: "pending" }}
        labels={{ current_injuries: "Current injuries", primary_goal: "Primary goal" }}
      />
    </main>
  );
}

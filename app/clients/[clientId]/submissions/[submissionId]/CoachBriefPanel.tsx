"use client";

import { useEffect, useState } from "react";
import type { CoachBriefPayload, SourcedText } from "@/lib/intelligence/types";
import type { CoachBriefStatus } from "@/lib/db/schema";

type BriefState = {
  status: CoachBriefStatus;
  payload?: CoachBriefPayload | null;
};

export function CoachBriefPanel({
  submissionId,
  initial,
  labels,
}: {
  submissionId: string;
  initial: BriefState | null;
  labels: Record<string, string>;
}) {
  const [brief, setBrief] = useState<BriefState | null>(initial);
  const [busy, setBusy] = useState(false);

  async function generate(retry = false) {
    setBusy(true);
    try {
      const response = await fetch(`/api/submissions/${submissionId}/coach-brief/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ retry }),
      });
      const payload = (await response.json().catch(() => null)) as BriefState | { error?: string } | null;
      if (payload && "status" in payload) setBrief(payload);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (initial?.status !== "pending") return;
    let cancelled = false;
    void fetch(`/api/submissions/${submissionId}/coach-brief/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ retry: false }),
    })
      .then((response) => response.json().catch(() => null))
      .then((payload: BriefState | { error?: string } | null) => {
        if (!cancelled && payload && "status" in payload) setBrief(payload);
      });
    return () => {
      cancelled = true;
    };
  }, [initial?.status, submissionId]);

  return (
    <section id="coach-brief" className="coach-brief">
      <p className="font-mono text-xs tracking-[0.22em] text-muted uppercase">03 · AI-generated context</p>
      <h2 className="mt-2 font-display text-3xl tracking-tight">AI Coach Brief</h2>
      <p className="mt-2 text-sm text-muted">AI-generated from the client&apos;s onboarding responses.</p>
      {brief?.status === "complete" && brief.payload ? (
        <BriefBody payload={brief.payload} labels={labels} />
      ) : brief?.status === "failed" ? (
        <div className="mt-4 rounded-2xl border border-line bg-surface p-6">
          <p>Coach Brief couldn&apos;t be generated.</p>
          <p className="mt-2 text-muted">Your client&apos;s submitted information is still available.</p>
          <button
            type="button"
            className="mt-4 rounded-full bg-accent px-5 py-2 text-sm text-surface"
            disabled={busy}
            onClick={() => void generate(true)}
          >
            Retry
          </button>
        </div>
      ) : (
        <p className="mt-4 text-muted">{busy || brief?.status === "processing" ? "Generating brief…" : "Pending generation."}</p>
      )}
    </section>
  );
}

function BriefBody({ payload, labels }: { payload: CoachBriefPayload; labels: Record<string, string> }) {
  return (
    <div className="mt-6 space-y-6">
      <SourcedBlock title="Summary" item={payload.summary} labels={labels} />
      <SourcedList title="Goals" items={payload.goals} labels={labels} />
      <SourcedList title="Training" items={payload.training} labels={labels} />
      <SourcedList title="Nutrition" items={payload.nutrition} labels={labels} />
      <SourcedList title="Lifestyle & Recovery" items={payload.lifestyleRecovery} labels={labels} />
      <SourcedList title="Coaching Preferences" items={payload.coachingPreferences} labels={labels} />
      <SourcedList title="Things to Review" items={payload.thingsToReview} labels={labels} ai />
      <SourcedList title="Kickoff Conversation" items={payload.kickoffTopics} labels={labels} />
    </div>
  );
}

function SourcedList({
  title,
  items,
  labels,
  ai,
}: {
  title: string;
  items?: SourcedText[];
  labels: Record<string, string>;
  ai?: boolean;
}) {
  if (!items?.length) return null;
  return (
    <section>
      <h3 className="font-display text-xl tracking-tight">{title}</h3>
      <ul className="mt-3 space-y-3">
        {items.map((item, index) => (
          <li key={`${title}-${index}`}>
            {ai ? <p className="text-xs uppercase tracking-[0.18em] text-muted">AI clarification</p> : null}
            <SourcedBlock item={item} labels={labels} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function SourcedBlock({ title, item, labels }: { title?: string; item: SourcedText; labels: Record<string, string> }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      {title ? <h3 className="font-display text-xl tracking-tight">{title}</h3> : null}
      <p className={title ? "mt-2" : ""}>{item.text}</p>
      <button type="button" className="mt-2 text-sm text-muted" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        {open ? "Hide sources" : `Based on ${item.sourceFieldKeys.length} answers`}
      </button>
      {open ? (
        <ul className="mt-2 text-sm text-muted">
          {item.sourceFieldKeys.map((key) => (
            <li key={key}>{labels[key] ?? key}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

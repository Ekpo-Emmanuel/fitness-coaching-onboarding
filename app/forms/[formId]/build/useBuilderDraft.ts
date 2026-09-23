"use client";
import { useEffect, useRef, useState } from "react";
import { renameFormAction, saveDraftAction } from "@/lib/forms/actions";
import { DraftSaveQueue } from "@/lib/forms/draft-save-queue";
import type { ClientIdentityMapping } from "@/lib/forms/identity";
import type { OnboardingSchema } from "@/lib/onboarding/schema/types";
import type { ReviewRuleSet } from "@/lib/review/types";
export type BuilderDraft = { name: string; schema: OnboardingSchema; identity: ClientIdentityMapping | null; reviewRules: ReviewRuleSet | null };
export function useBuilderDraft(formId: string, initial: BuilderDraft, initialRevision: number) {
  const [, render] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const key = `coaching_builder_recovery:${formId}`;
  const [queue] = useState(() => {
    let savedName = initial.name;
    const controller = new DraftSaveQueue(initial, initialRevision, async (value, revision) => {
      if (value.name !== savedName) {
        const renamed = await renameFormAction(formId, value.name);
        if (!("ok" in renamed && renamed.ok)) return { ok: false as const, error: "error" in renamed ? renamed.error : "Could not save the form name." };
        savedName = value.name;
      }
      const result = await saveDraftAction(formId, revision, value.schema, value.identity, value.reviewRules);
      if (!("ok" in result && result.ok)) return { ok: false as const, error: "error" in result ? result.error : "Could not save the draft.", conflict: "conflict" in result && result.conflict };
      return { ok: true as const, revision: result.revision, value: { ...value, schema: result.schema, identity: result.clientIdentityMapping ?? null, reviewRules: result.reviewRules ?? null } };
    }, () => {
      render((value) => value + 1);
      try {
        if (controller.dirty) sessionStorage.setItem(key, JSON.stringify({ value: controller.value, revision: controller.revision }));
        else sessionStorage.removeItem(key);
      } catch { /* In-memory edits and navigation guard remain available. */ }
    });
    return controller;
  });
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(key);
      if (saved) {
        const cached = JSON.parse(saved);
        if (cached.value?.schema?.sections && Number.isFinite(cached.revision)) { queue.restore(cached.value, cached.revision); }
      }
    } catch { /* Ignore malformed recovery data, never overwrite the server draft. */ }
    const beforeUnload = (event: BeforeUnloadEvent) => { if (queue.dirty) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", beforeUnload);
    return () => { if (timer.current) clearTimeout(timer.current); window.removeEventListener("beforeunload", beforeUnload); };
  }, [key, queue]);
  function edit(value: BuilderDraft) {
    queue.edit(value);
    if (timer.current) clearTimeout(timer.current);
    if (queue.state !== "conflict") timer.current = setTimeout(() => { void queue.flush().catch(() => undefined); }, 700);
  }
  async function flush() { if (timer.current) clearTimeout(timer.current); await queue.flush(); }
  function downloadRecovery() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(queue.value, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "coaching-draft-recovery.json"; link.click(); URL.revokeObjectURL(url);
  }
  function discardRecovery() { try { sessionStorage.removeItem(key); } catch {} window.location.reload(); }
  return { queue, draft: queue.value, edit, flush, recovered: queue.recovered, downloadRecovery, discardRecovery };
}

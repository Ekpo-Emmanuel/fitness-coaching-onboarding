"use client";

import { useCallback, useEffect, useRef } from "react";
import { OnboardingRenderer } from "@/app/onboarding/OnboardingRenderer";
import { OnboardingSubmitError, submitPublicForm } from "@/lib/onboarding/client-submit";
import type { OnboardingSchema } from "@/lib/onboarding/schema/types";

export function PublicForm({
  slug,
  schema,
  branding,
  formId,
  formVersionId,
  canCollect,
}: {
  slug: string;
  schema: OnboardingSchema;
  branding: { businessName: string; coachName: string; primaryColor: string | null };
  formId: string;
  formVersionId: string;
  canCollect: boolean;
}) {
  const attempt = useRef<{ id: string; startedAt: number } | null>(null);
  const getAttempt = useCallback(() => {
    if (attempt.current) return attempt.current;
    const fresh = { id: crypto.randomUUID(), startedAt: Date.now() };
    try {
      const id = sessionStorage.getItem(`attempt:${formVersionId}`);
      const startedAt = Number(sessionStorage.getItem(`started:${formVersionId}`));
      if (id) fresh.id = id;
      if (startedAt > 0 && Number.isFinite(startedAt)) fresh.startedAt = startedAt;
      sessionStorage.setItem(`attempt:${formVersionId}`, fresh.id);
      sessionStorage.setItem(`started:${formVersionId}`, String(fresh.startedAt));
    } catch { /* Stable in-memory attempt still protects retries when storage is blocked. */ }
    attempt.current = fresh;
    return fresh;
  }, [formVersionId]);
  useEffect(() => { getAttempt(); }, [getAttempt]);
  return (
    <OnboardingRenderer
      schema={schema}
      mode="public"
      branding={branding}
      storageKey={`onboarding_draft:${formId}:${formVersionId}`}
      onSubmit={
            canCollect
          ? async (answers, meta) => {
              const currentAttempt = getAttempt();
              await submitPublicForm(slug, answers, {
                submissionAttemptId: currentAttempt.id,
                startedAt: currentAttempt.startedAt,
                website: meta?.website ?? "",
              });
              try {
                sessionStorage.removeItem(`attempt:${formVersionId}`);
                sessionStorage.removeItem(`started:${formVersionId}`);
              } catch { /* The receipt is already confirmed. */ }
            }
          : async () => {
              throw new OnboardingSubmitError("This onboarding is not collecting answers yet.");
            }
      }
    />
  );
}

import type { OnboardingAnswers } from "./schema/types";

export class OnboardingSubmitError extends Error {
  constructor(
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "OnboardingSubmitError";
  }
}

export async function submitLegacyOnboarding(answers: OnboardingAnswers) {
  const response = await fetch("/api/onboarding", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(answers),
  });
  const payload = (await response.json().catch(() => null)) as
    | { error?: string; fields?: Record<string, string> }
    | null;
  if (!response.ok) {
    throw new OnboardingSubmitError(
      payload?.error || "We couldn't submit your onboarding just yet. Your answers are still here. Please try again.",
      payload?.fields,
    );
  }
}

export async function submitPublicForm(slug: string, answers: OnboardingAnswers, extra?: {
  submissionAttemptId: string;
  startedAt: number;
  website: string;
}) {
  const response = await fetch(`/api/public/forms/${encodeURIComponent(slug)}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      answers,
      submissionAttemptId: extra?.submissionAttemptId,
      startedAt: extra?.startedAt,
      website: extra?.website ?? "",
    }),
  });
  const payload = (await response.json().catch(() => null)) as
    | { error?: string; fields?: Record<string, string> }
    | null;
  if (!response.ok) {
    throw new OnboardingSubmitError(
      payload?.error || "We couldn't submit your onboarding just yet. Your answers are still here. Please try again.",
      payload?.fields,
    );
  }
}

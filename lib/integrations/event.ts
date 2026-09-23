import type { OnboardingSubmittedEventV1 } from "./types";

export function buildOnboardingSubmittedEvent(input: {
  deliveryId: string;
  occurredAt: Date;
  client: { id: string; fullName: string; email: string; phone?: string | null };
  form: { id: string; name: string; versionNumber: number };
  submission: { id: string; submittedAt: Date; reviewStatus: string; answers: Record<string, unknown> };
  reviewFlags: Array<{ code: string; label: string; sourceFieldKeys: string[] }>;
  fields: OnboardingSubmittedEventV1["fields"];
}): OnboardingSubmittedEventV1 {
  return {
    event: "onboarding.submitted",
    payloadVersion: "1",
    deliveryId: input.deliveryId,
    occurredAt: input.occurredAt.toISOString(),
    client: {
      id: input.client.id,
      fullName: input.client.fullName,
      email: input.client.email,
      phone: input.client.phone || undefined,
    },
    form: input.form,
    submission: {
      id: input.submission.id,
      submittedAt: input.submission.submittedAt.toISOString(),
      reviewStatus: input.submission.reviewStatus,
      answers: input.submission.answers,
    },
    reviewFlags: input.reviewFlags,
    fields: input.fields,
  };
}

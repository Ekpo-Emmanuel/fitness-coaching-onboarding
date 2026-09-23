import { allFields } from "@/lib/onboarding/schema/visibility";
import type { OnboardingAnswers, OnboardingSchema } from "@/lib/onboarding/schema/types";
import { formatAnswerValue } from "@/lib/submissions/display";

const SNAPSHOT_KEYS: Array<{ key: string; title: string }> = [
  { key: "primary_goal", title: "Primary goal" },
  { key: "training_experience", title: "Training experience" },
  { key: "training_days_available", title: "Training availability" },
  { key: "gym_name", title: "Training environment" },
];

export function submissionSnapshot(schema: OnboardingSchema, answers: OnboardingAnswers) {
  const fields = allFields(schema);
  return SNAPSHOT_KEYS.flatMap((item) => {
    const field = fields.find((candidate) => candidate.key === item.key);
    if (!field) return [];
    const value = formatAnswerValue(field, answers);
    if (!value || value === "—") return [];
    return [{ title: item.title, value, fieldLabel: field.label, fieldKey: field.key }];
  });
}

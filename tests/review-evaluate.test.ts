import { describe, expect, it } from "vitest";
import validAnswers from "./fixtures/valid-client-answers.json";
import { emmanuelOnboardingV1 } from "@/lib/onboarding/schemas/emmanuel-onboarding-v1";
import type { OnboardingAnswers } from "@/lib/onboarding/schema/types";
import { evaluateReviewRules } from "@/lib/review/evaluate";
import { V1_REVIEW_RULES } from "@/lib/review/v1-rules";

function answers(overrides: Record<string, unknown> = {}): OnboardingAnswers {
  return { ...(validAnswers as OnboardingAnswers), ...overrides };
}

function codes(overrides: Record<string, unknown> = {}) {
  return evaluateReviewRules({
    rules: V1_REVIEW_RULES,
    answers: answers(overrides),
    schema: emmanuelOnboardingV1,
  }).map((flag) => flag.code);
}

describe("review rule evaluation", () => {
  it("triggers each V1 health review rule", () => {
    expect(codes({ current_injuries: "yes" })).toContain("current_injury_or_pain");
    expect(codes({ exercise_restrictions: "yes" })).toContain("exercise_restriction");
    expect(codes({ medical_conditions: "yes" })).toContain("medical_condition");
    expect(codes({ medical_conditions: "unsure" })).toContain("medical_condition");
    expect(codes({ medications: "yes" })).toContain("medication_consideration");
    expect(codes({ medications: "prefer_privately" })).toContain("medication_consideration");
    expect(codes({ pregnancy_considerations: "yes" })).toContain("pregnancy_consideration");
    expect(codes({ pregnancy_considerations: "prefer_privately" })).toContain("pregnancy_consideration");
    expect(codes({ health_additional_notes: "old ankle sprain" })).toContain("other_health_note");
    expect(codes({ previous_injuries: "yes" })).toContain("previous_injury");
    expect(codes({ surgeries: "yes" })).toContain("surgery_history");
  });

  it("returns zero flags when nothing triggers", () => {
    expect(codes()).toEqual([]);
    expect(evaluateReviewRules({ rules: null, answers: answers(), schema: emmanuelOnboardingV1 })).toEqual([]);
  });
});

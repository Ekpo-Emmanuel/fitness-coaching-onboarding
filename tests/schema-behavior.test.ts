import { describe, expect, it } from "vitest";
import { emptyAnswers, validateAnswers, ValidationError } from "@/lib/onboarding/schema/engine";
import { isFieldVisible } from "@/lib/onboarding/schema/visibility";
import { emmanuelOnboardingV1 } from "@/lib/onboarding/schemas/emmanuel-onboarding-v1";
import { validDraft } from "./fixtures/onboarding-draft";

function field(key: string) {
  return emmanuelOnboardingV1.sections.flatMap((section) => section.fields).find((item) => item.key === key);
}

describe("schema visibility", () => {
  it("hides injury details until yes", () => {
    const target = field("current_injury_details");
    expect(target).toBeTruthy();
    expect(isFieldVisible(target!, { current_injuries: "no" })).toBe(false);
    expect(isFieldVisible(target!, { current_injuries: "yes" })).toBe(true);
  });

  it("shows medical details for yes and unsure", () => {
    const target = field("medical_condition_details");
    expect(isFieldVisible(target!, { medical_conditions: "no" })).toBe(false);
    expect(isFieldVisible(target!, { medical_conditions: "yes" })).toBe(true);
    expect(isFieldVisible(target!, { medical_conditions: "unsure" })).toBe(true);
  });

  it("shows macros when tracking calories", () => {
    const target = field("current_calories");
    expect(isFieldVisible(target!, { calorie_tracking: "no" })).toBe(false);
    expect(isFieldVisible(target!, { calorie_tracking: "yes" })).toBe(true);
  });

  it("keeps gym_name visible regardless of location", () => {
    const target = field("gym_name");
    expect(isFieldVisible(target!, { training_location: "home_gym" })).toBe(true);
    expect(isFieldVisible(target!, { training_location: "commercial_gym" })).toBe(true);
  });

  it("shows medication details only when medications is yes", () => {
    const target = field("medication_details");
    expect(isFieldVisible(target!, { medications: "no" })).toBe(false);
    expect(isFieldVisible(target!, { medications: "yes" })).toBe(true);
  });

  it("shows previous injury, surgery, and restriction details when parent is yes", () => {
    expect(isFieldVisible(field("previous_injury_details")!, { previous_injuries: "yes" })).toBe(true);
    expect(isFieldVisible(field("surgery_details")!, { surgeries: "yes" })).toBe(true);
    expect(isFieldVisible(field("exercise_restriction_details")!, { exercise_restrictions: "yes" })).toBe(true);
  });
});

describe("schema-driven answers", () => {
  it("accepts the V1 baseline draft", () => {
    expect(validateAnswers(emmanuelOnboardingV1, validDraft()).full_name).toBe("Marisol Keene");
  });

  it("does not require hidden optional details", () => {
    const answers = emptyAnswers(emmanuelOnboardingV1);
    expect(answers.height_unit).toBe("cm");
    expect(answers.weight_unit).toBe("lb");
  });

  it("still rejects unknown keys", () => {
    expect(() => validateAnswers(emmanuelOnboardingV1, { ...validDraft(), extra: "x" })).toThrow(ValidationError);
  });
});

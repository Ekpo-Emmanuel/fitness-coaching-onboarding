import { REVIEW_RULES_VERSION, type ReviewRuleSet } from "./types";

export const V1_REVIEW_RULES: ReviewRuleSet = {
  version: REVIEW_RULES_VERSION,
  rules: [
    {
      id: "rule_current_injury",
      code: "current_injury_or_pain",
      label: "Current injury or pain reported",
      conditions: { all: [{ fieldKey: "current_injuries", operator: "equals", value: "yes" }] },
      sourceFieldKeys: ["current_injuries", "current_injury_details"],
    },
    {
      id: "rule_exercise_restriction",
      code: "exercise_restriction",
      label: "Exercise restriction reported",
      conditions: { all: [{ fieldKey: "exercise_restrictions", operator: "equals", value: "yes" }] },
      sourceFieldKeys: ["exercise_restrictions", "exercise_restriction_details"],
    },
    {
      id: "rule_medical_condition",
      code: "medical_condition",
      label: "Medical consideration reported",
      conditions: {
        any: [
          { fieldKey: "medical_conditions", operator: "equals", value: "yes" },
          { fieldKey: "medical_conditions", operator: "equals", value: "unsure" },
        ],
      },
      sourceFieldKeys: ["medical_conditions", "medical_condition_details"],
    },
    {
      id: "rule_medication",
      code: "medication_consideration",
      label: "Medication information requires coach review",
      conditions: {
        any: [
          { fieldKey: "medications", operator: "equals", value: "yes" },
          { fieldKey: "medications", operator: "equals", value: "prefer_privately" },
        ],
      },
      sourceFieldKeys: ["medications", "medication_details"],
    },
    {
      id: "rule_pregnancy",
      code: "pregnancy_consideration",
      label: "Pregnancy/postpartum consideration reported",
      conditions: {
        any: [
          { fieldKey: "pregnancy_considerations", operator: "equals", value: "yes" },
          { fieldKey: "pregnancy_considerations", operator: "equals", value: "prefer_privately" },
        ],
      },
      sourceFieldKeys: ["pregnancy_considerations"],
    },
    {
      id: "rule_other_health_note",
      code: "other_health_note",
      label: "Additional health information provided",
      conditions: { all: [{ fieldKey: "health_additional_notes", operator: "is_not_empty" }] },
      sourceFieldKeys: ["health_additional_notes"],
    },
    {
      id: "rule_previous_injury",
      code: "previous_injury",
      label: "Previous injury reported",
      conditions: { all: [{ fieldKey: "previous_injuries", operator: "equals", value: "yes" }] },
      sourceFieldKeys: ["previous_injuries", "previous_injury_details"],
    },
    {
      id: "rule_surgery_history",
      code: "surgery_history",
      label: "Surgery history reported",
      conditions: { all: [{ fieldKey: "surgeries", operator: "equals", value: "yes" }] },
      sourceFieldKeys: ["surgeries", "surgery_details"],
    },
  ],
};

export const LEGACY_REASON_TO_CODE: Record<string, string> = {
  current_injury_or_pain: "current_injury_or_pain",
  exercise_restriction: "exercise_restriction",
  medical_condition: "medical_condition",
  medication_consideration: "medication_consideration",
  pregnancy_consideration: "pregnancy_consideration",
  other_health_note: "other_health_note",
  previous_injury: "previous_injury",
  surgery_history: "surgery_history",
};

import type { ValidatedOnboarding } from "./types";

export function buildHealthFlags(data: ValidatedOnboarding) {
  const reasons: string[] = [];

  if (data.current_injuries === "yes") reasons.push("current_injury_or_pain");
  if (data.exercise_restrictions === "yes") reasons.push("exercise_restriction");
  if (data.medical_conditions === "yes" || data.medical_conditions === "unsure") {
    reasons.push("medical_condition");
  }
  if (data.medications === "yes" || data.medications === "prefer_privately") {
    reasons.push("medication_consideration");
  }
  if (data.pregnancy_considerations === "yes" || data.pregnancy_considerations === "prefer_privately") {
    reasons.push("pregnancy_consideration");
  }
  if (data.health_additional_notes.trim()) reasons.push("other_health_note");
  if (data.previous_injuries === "yes") reasons.push("previous_injury");
  if (data.surgeries === "yes") reasons.push("surgery_history");

  const coach_review_needed = reasons.length > 0;
  return {
    coach_review_needed,
    health_flag: coach_review_needed ? "Coach Review Needed" : "",
    health_flag_reasons: reasons,
  };
}

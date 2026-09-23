import { describe, expect, it } from "vitest";
import { buildHealthFlags } from "@/lib/onboarding/health-flags";
import { validateSubmission } from "@/lib/onboarding/validate";
import { validDraft } from "./fixtures/onboarding-draft";

function flags(overrides: Parameters<typeof validDraft>[0]) {
  return buildHealthFlags(validateSubmission(validDraft(overrides)));
}

describe("buildHealthFlags", () => {
  it("does not flag a clean health profile", () => {
    const result = flags({});
    expect(result.coach_review_needed).toBe(false);
    expect(result.health_flag).toBe("");
    expect(result.health_flag_reasons).toEqual([]);
  });

  it("flags current injury", () => {
    expect(flags({ current_injuries: "yes", current_injury_details: "Knee" }).health_flag_reasons).toContain(
      "current_injury_or_pain",
    );
  });

  it("flags exercise restriction", () => {
    expect(
      flags({ exercise_restrictions: "yes", exercise_restriction_details: "No overhead" }).health_flag_reasons,
    ).toContain("exercise_restriction");
  });

  it("flags medical condition yes", () => {
    expect(
      flags({ medical_conditions: "yes", medical_condition_details: "Asthma" }).health_flag_reasons,
    ).toContain("medical_condition");
  });

  it("flags medical condition unsure", () => {
    expect(
      flags({ medical_conditions: "unsure", medical_condition_details: "Checking" }).health_flag_reasons,
    ).toContain("medical_condition");
  });

  it("flags medication yes", () => {
    expect(flags({ medications: "yes" }).health_flag_reasons).toContain("medication_consideration");
  });

  it("flags medication prefer privately", () => {
    expect(flags({ medications: "prefer_privately" }).health_flag_reasons).toContain(
      "medication_consideration",
    );
  });

  it("flags pregnancy yes", () => {
    expect(flags({ pregnancy_considerations: "yes" }).health_flag_reasons).toContain("pregnancy_consideration");
  });

  it("flags pregnancy prefer privately", () => {
    expect(flags({ pregnancy_considerations: "prefer_privately" }).health_flag_reasons).toContain(
      "pregnancy_consideration",
    );
  });

  it("flags additional health notes", () => {
    expect(flags({ health_additional_notes: "Occasional dizziness" }).health_flag_reasons).toContain(
      "other_health_note",
    );
  });

  it("flags previous injury", () => {
    expect(
      flags({ previous_injuries: "yes", previous_injury_details: "Ankle" }).health_flag_reasons,
    ).toContain("previous_injury");
  });

  it("flags surgery history", () => {
    expect(flags({ surgeries: "yes", surgery_details: "ACL" }).health_flag_reasons).toContain("surgery_history");
  });

  it("sets Coach Review Needed when any trigger fires", () => {
    const result = flags({ current_injuries: "yes", current_injury_details: "Knee" });
    expect(result.coach_review_needed).toBe(true);
    expect(result.health_flag).toBe("Coach Review Needed");
  });
});

import { describe, expect, it } from "vitest";
import { createBlankOnboardingSchema } from "@/lib/forms/blank-schema";
import { identityMappingIssues, normalizeEmail, V1_IDENTITY_MAPPING } from "@/lib/forms/identity";
import { emmanuelOnboardingV1 } from "@/lib/onboarding/schemas/emmanuel-onboarding-v1";

describe("client identity mapping", () => {
  it("accepts the V1 mapping", () => {
    expect(identityMappingIssues(emmanuelOnboardingV1, V1_IDENTITY_MAPPING)).toEqual([]);
  });

  it("rejects a missing email field", () => {
    const schema = createBlankOnboardingSchema();
    expect(
      identityMappingIssues(schema, { fullNameFieldKey: "full_name", emailFieldKey: "missing" }),
    ).not.toEqual([]);
  });

  it("normalizes email with trim and lowercase only", () => {
    expect(normalizeEmail("  Ada@Example.com ")).toBe("ada@example.com");
  });
});

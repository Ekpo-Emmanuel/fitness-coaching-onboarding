import { describe, expect, it } from "vitest";
import { collectAnswerKeys, validateSchemaDefinition } from "@/lib/onboarding/schema/definition";
import { CLIENT_FIELD_KEYS } from "@/lib/onboarding/schema/client-keys";
import { emmanuelOnboardingV1 } from "@/lib/onboarding/schemas/emmanuel-onboarding-v1";

describe("emmanuel onboarding v1 schema definition", () => {
  it("passes structural validation", () => {
    expect(validateSchemaDefinition(emmanuelOnboardingV1)).toEqual([]);
  });

  it("contains the exact 86 client field keys", () => {
    expect([...collectAnswerKeys(emmanuelOnboardingV1)].sort()).toEqual([...CLIENT_FIELD_KEYS].sort());
    expect(CLIENT_FIELD_KEYS).toHaveLength(86);
  });

  it("keeps stable ids and ten form sections", () => {
    expect(emmanuelOnboardingV1.sections).toHaveLength(10);
    expect(emmanuelOnboardingV1.schemaVersion).toBe("onboarding_v1");
    expect(emmanuelOnboardingV1.storageKey).toBe("emmanuel_onboarding_v1");
    expect(emmanuelOnboardingV1.estimatedMinutes).toEqual({ min: 8, max: 12 });
  });

  it("serializes through JSON without losing structure", () => {
    const roundTrip = JSON.parse(JSON.stringify(emmanuelOnboardingV1));
    expect(roundTrip.sections).toHaveLength(10);
    expect(collectAnswerKeys(roundTrip).sort()).toEqual([...CLIENT_FIELD_KEYS].sort());
    expect(validateSchemaDefinition(roundTrip)).toEqual([]);
  });
});

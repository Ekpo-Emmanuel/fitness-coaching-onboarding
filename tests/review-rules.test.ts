import { describe, expect, it } from "vitest";
import { createBlankOnboardingSchema } from "@/lib/forms/blank-schema";
import { EMPTY_REVIEW_RULES } from "@/lib/review/types";
import { reviewRuleSetIssues } from "@/lib/review/validate";
import { V1_REVIEW_RULES } from "@/lib/review/v1-rules";
import { emmanuelOnboardingV1 } from "@/lib/onboarding/schemas/emmanuel-onboarding-v1";

describe("review rule definition", () => {
  it("accepts the seeded V1 rule set and empty historical null", () => {
    expect(reviewRuleSetIssues(V1_REVIEW_RULES, emmanuelOnboardingV1)).toEqual([]);
    expect(reviewRuleSetIssues(null, emmanuelOnboardingV1)).toEqual([]);
    expect(reviewRuleSetIssues(EMPTY_REVIEW_RULES, createBlankOnboardingSchema())).toEqual([]);
    expect(JSON.parse(JSON.stringify(V1_REVIEW_RULES))).toMatchObject({ version: "review_rules_v1" });
  });

  it("rejects duplicate ids and codes", () => {
    const duplicateId = {
      ...V1_REVIEW_RULES,
      rules: [V1_REVIEW_RULES.rules[0], { ...V1_REVIEW_RULES.rules[1], id: V1_REVIEW_RULES.rules[0].id }],
    };
    expect(reviewRuleSetIssues(duplicateId, emmanuelOnboardingV1).join(" ")).toMatch(/unique/);
    const duplicateCode = {
      ...V1_REVIEW_RULES,
      rules: [V1_REVIEW_RULES.rules[0], { ...V1_REVIEW_RULES.rules[1], code: V1_REVIEW_RULES.rules[0].code }],
    };
    expect(reviewRuleSetIssues(duplicateCode, emmanuelOnboardingV1).join(" ")).toMatch(/unique/);
  });

  it("rejects missing fields, operators, options, and source keys", () => {
    const missing = {
      version: "review_rules_v1" as const,
      rules: [
        {
          id: "r1",
          code: "current_pain",
          label: "Current pain reported",
          conditions: { all: [{ fieldKey: "not_a_field", operator: "equals" as const, value: "yes" }] },
          sourceFieldKeys: ["not_a_field"],
        },
      ],
    };
    expect(reviewRuleSetIssues(missing, emmanuelOnboardingV1).join(" ")).toMatch(/missing/);
    const badOp = {
      version: "review_rules_v1" as const,
      rules: [
        {
          id: "r1",
          code: "current_pain",
          label: "Current pain reported",
          conditions: { all: [{ fieldKey: "current_injuries", operator: "greater_than" as never, value: "yes" }] },
          sourceFieldKeys: ["current_injuries"],
        },
      ],
    };
    expect(reviewRuleSetIssues(badOp, emmanuelOnboardingV1).join(" ")).toMatch(/Unsupported/);
    const badOption = {
      version: "review_rules_v1" as const,
      rules: [
        {
          id: "r1",
          code: "current_pain",
          label: "Current pain reported",
          conditions: { all: [{ fieldKey: "current_injuries", operator: "equals" as const, value: "probably" }] },
          sourceFieldKeys: ["current_injuries"],
        },
      ],
    };
    expect(reviewRuleSetIssues(badOption, emmanuelOnboardingV1).join(" ")).toMatch(/unknown option/);
    const missingSource = {
      version: "review_rules_v1" as const,
      rules: [
        {
          id: "r1",
          code: "current_pain",
          label: "Current pain reported",
          conditions: { all: [{ fieldKey: "current_injuries", operator: "equals" as const, value: "yes" }] },
          sourceFieldKeys: ["nope"],
        },
      ],
    };
    expect(reviewRuleSetIssues(missingSource, emmanuelOnboardingV1).join(" ")).toMatch(/source/);
  });

  it("rejects medical-risk labels", () => {
    const risky = {
      version: "review_rules_v1" as const,
      rules: [
        {
          id: "r1",
          code: "current_pain",
          label: "High medical risk",
          conditions: { all: [{ fieldKey: "current_injuries", operator: "equals" as const, value: "yes" }] },
          sourceFieldKeys: ["current_injuries"],
        },
      ],
    };
    expect(reviewRuleSetIssues(risky, emmanuelOnboardingV1).join(" ")).toMatch(/medical risk/);
  });
});

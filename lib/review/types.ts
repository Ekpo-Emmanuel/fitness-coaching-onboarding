import type { Condition } from "@/lib/onboarding/schema/types";

export const REVIEW_RULES_VERSION = "review_rules_v1";

export type ReviewRule = {
  id: string;
  code: string;
  label: string;
  conditions: {
    all?: Condition[];
    any?: Condition[];
  };
  sourceFieldKeys: string[];
};

export type ReviewRuleSet = {
  version: typeof REVIEW_RULES_VERSION;
  rules: ReviewRule[];
};

export const EMPTY_REVIEW_RULES: ReviewRuleSet = {
  version: REVIEW_RULES_VERSION,
  rules: [],
};

export type ReviewFlagCandidate = {
  ruleId: string;
  code: string;
  label: string;
  sourceFieldKeys: string[];
};

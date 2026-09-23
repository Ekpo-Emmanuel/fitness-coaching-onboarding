import { isLogicSatisfied } from "@/lib/onboarding/schema/visibility";
import type { OnboardingAnswers, OnboardingSchema } from "@/lib/onboarding/schema/types";
import type { ReviewFlagCandidate, ReviewRuleSet } from "./types";

export function evaluateReviewRules(input: {
  rules: ReviewRuleSet | null | undefined;
  answers: OnboardingAnswers;
  schema: OnboardingSchema;
}): ReviewFlagCandidate[] {
  if (!input.rules?.rules?.length) return [];
  const flags: ReviewFlagCandidate[] = [];
  for (const rule of input.rules.rules) {
    const all = rule.conditions.all ?? [];
    const any = rule.conditions.any ?? [];
    if (all.length === 0 && any.length === 0) continue;
    if (!isLogicSatisfied({ action: "show", all, any }, input.answers)) continue;
    flags.push({
      ruleId: rule.id,
      code: rule.code,
      label: rule.label,
      sourceFieldKeys: rule.sourceFieldKeys,
    });
  }
  return flags;
}

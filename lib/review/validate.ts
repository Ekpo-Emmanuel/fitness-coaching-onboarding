import { CONDITION_OPERATORS } from "@/lib/forms/schema-ops";
import { collectAnswerKeys } from "@/lib/onboarding/schema/definition";
import type { OnboardingSchema } from "@/lib/onboarding/schema/types";
import { allFields } from "@/lib/onboarding/schema/visibility";
import { FormServiceError } from "@/lib/forms/errors";
import { REVIEW_RULES_VERSION, type ReviewRuleSet } from "./types";

const MAX_RULES = 40;
const MAX_CONDITIONS = 8;
const CODE_PATTERN = /^[a-z][a-z0-9_]{1,47}$/;
const FORBIDDEN_LABEL = /unsafe|cleared to exercise|diagnos|high medical risk|torn acl|needs diagnosis|likely /i;

export function parseReviewRuleSet(input: unknown): ReviewRuleSet | null {
  if (input == null) return null;
  if (!isRecord(input) || input.version !== REVIEW_RULES_VERSION || !Array.isArray(input.rules)) {
    throw new FormServiceError("Review rules are invalid.");
  }
  return input as ReviewRuleSet;
}

export function reviewRuleSetIssues(
  rules: ReviewRuleSet | null | undefined,
  schema: OnboardingSchema | { keys: Set<string>; skipFieldCheck?: boolean },
) {
  const issues: string[] = [];
  if (rules == null) return issues;
  if (rules.version !== REVIEW_RULES_VERSION) issues.push("Unknown review rules version.");
  if (!Array.isArray(rules.rules)) {
    issues.push("Review rules must be a list.");
    return issues;
  }
  if (rules.rules.length > MAX_RULES) issues.push("Too many review rules.");
  const keys = "sections" in schema ? new Set(collectAnswerKeys(schema)) : schema.keys;
  const skipFieldCheck = "skipFieldCheck" in schema && schema.skipFieldCheck;
  const ids = new Set<string>();
  const codes = new Set<string>();
  for (const rule of rules.rules) {
    if (!rule?.id) issues.push("Each review rule needs an id.");
    else if (ids.has(rule.id)) issues.push("Review rule ids must be unique.");
    else ids.add(rule.id);
    if (!rule?.code || !CODE_PATTERN.test(rule.code)) issues.push("Each review rule needs a stable snake_case code.");
    else if (codes.has(rule.code)) issues.push("Review rule codes must be unique.");
    else codes.add(rule.code);
    if (!rule?.label?.trim()) issues.push("Each review rule needs a label.");
    else if (FORBIDDEN_LABEL.test(rule.label)) {
      issues.push("Review labels must describe reported information, not medical risk or clearance.");
    }
    const all = rule.conditions?.all ?? [];
    const any = rule.conditions?.any ?? [];
    if (all.length + any.length === 0) issues.push(`Rule "${rule.label || rule.code}" needs a condition.`);
    if (all.length + any.length > MAX_CONDITIONS) issues.push("Too many conditions on one rule.");
    const fields = "sections" in schema ? allFields(schema) : [];
    for (const condition of [...all, ...any]) {
      if (!CONDITION_OPERATORS.includes(condition.operator)) issues.push("Unsupported condition operator.");
      if (!skipFieldCheck && !keys.has(condition.fieldKey)) {
        issues.push(`Review rule refers to missing question "${condition.fieldKey}".`);
      }
      const field = fields.find((item) => item.key === condition.fieldKey);
      if (
        field &&
        (field.type === "single_select" || field.type === "multi_select") &&
        (condition.operator === "equals" || condition.operator === "not_equals") &&
        typeof condition.value === "string" &&
        !field.options.some((option) => option.value === condition.value)
      ) {
        issues.push(`Review rule compares "${condition.fieldKey}" to an unknown option.`);
      }
    }
    if (!rule.sourceFieldKeys?.length) issues.push("Each review rule needs source questions.");
    for (const key of rule.sourceFieldKeys ?? []) {
      if (!skipFieldCheck && !keys.has(key)) issues.push(`Review rule source "${key}" is missing.`);
    }
  }
  return issues;
}

export function assertReviewRuleSet(schema: OnboardingSchema, rules: ReviewRuleSet | null | undefined) {
  const issues = reviewRuleSetIssues(rules, schema);
  if (issues.length > 0) throw new FormServiceError(issues[0]);
  return rules ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

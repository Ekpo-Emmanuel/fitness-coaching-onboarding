import type { Condition, ConditionalLogic, FormField, OnboardingAnswers, OnboardingSchema } from "./types";

function isEmpty(value: unknown) {
  if (value == null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

export function matchesCondition(condition: Condition, answers: OnboardingAnswers) {
  const actual = answers[condition.fieldKey];
  switch (condition.operator) {
    case "equals":
      return actual === condition.value;
    case "not_equals":
      return actual !== condition.value;
    case "contains":
      return Array.isArray(actual) && actual.includes(condition.value);
    case "not_contains":
      return Array.isArray(actual) && !actual.includes(condition.value);
    case "is_empty":
      return isEmpty(actual);
    case "is_not_empty":
      return !isEmpty(actual);
    default:
      return false;
  }
}

export function isLogicSatisfied(logic: ConditionalLogic | undefined, answers: OnboardingAnswers) {
  if (!logic) return true;
  const all = logic.all ?? [];
  const any = logic.any ?? [];
  if (all.length === 0 && any.length === 0) return true;
  const allPass = all.length === 0 || all.every((condition) => matchesCondition(condition, answers));
  const anyPass = any.length === 0 || any.some((condition) => matchesCondition(condition, answers));
  return allPass && anyPass;
}

export function isFieldVisible(field: FormField, answers: OnboardingAnswers) {
  if (!field.logic) return true;
  if (field.logic.action !== "show") return true;
  return isLogicSatisfied(field.logic, answers);
}

export function visibleFields(fields: FormField[], answers: OnboardingAnswers) {
  return fields.filter((field) => isFieldVisible(field, answers));
}

export function allFields(schema: OnboardingSchema) {
  return schema.sections.flatMap((section) => section.fields);
}

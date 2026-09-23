import { formatHeight, formatWeight } from "@/lib/onboarding/format";
import type { FormField, OnboardingAnswers } from "@/lib/onboarding/schema/types";
import { isFieldVisible } from "@/lib/onboarding/schema/visibility";

function asString(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return value == null ? "" : String(value);
}

export function formatAnswerValue(field: FormField, answers: OnboardingAnswers) {
  if (field.type === "unit_number") {
    const value = asString(answers[field.key]);
    const unit = asString(answers[field.unitKey]);
    const companion = field.companionKey ? asString(answers[field.companionKey]) : "";
    if (!value) return "—";
    if (field.unitKey.includes("height") || field.key.includes("height")) {
      if (unit === "ft_in") return `${value} ft ${companion || "0"} in`;
      return formatHeight(value, unit || "cm", companion);
    }
    return formatWeight(value, unit || field.defaultUnit);
  }
  if (field.type === "multi_select") {
    const value = answers[field.key];
    if (!Array.isArray(value) || value.length === 0) return "—";
    const labels = new Map(field.options.map((option) => [option.value, option.label]));
    return value.map((item) => labels.get(String(item)) ?? String(item)).join(", ");
  }
  if (field.type === "single_select") {
    const value = asString(answers[field.key]);
      return field.options.find((option) => option.value === value)?.label ?? (value || "—");
  }
  if (field.type === "acknowledgement" || field.type === "boolean") {
    return answers[field.key] === true ? "Yes" : "No";
  }
  if (field.type === "scale") {
    const value = answers[field.key];
    return value == null || value === "" ? "—" : String(value);
  }
  return asString(answers[field.key]) || "—";
}

export function visibleAnswerRows(fields: FormField[], answers: OnboardingAnswers) {
  return fields.filter((field) => isFieldVisible(field, answers)).map((field) => ({
    field,
    value: formatAnswerValue(field, answers),
  }));
}

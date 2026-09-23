import type { FormField, OnboardingAnswers } from "./types";
import { isFieldVisible } from "./visibility";

const COMPACT_TYPES = new Set<FormField["type"]>([
  "short_text",
  "email",
  "phone",
  "date",
  "number",
  "unit_number",
]);

export function presentSectionFields(fields: FormField[], answers: OnboardingAnswers) {
  const visible = fields.filter((field) => isFieldVisible(field, answers));
  const groups: FormField[][] = [];
  for (const field of visible) {
    const last = groups[groups.length - 1];
    if (field.group && last?.[0]?.group === field.group) {
      last.push(field);
      continue;
    }
    if (
      last &&
      !field.group &&
      !last[0]?.group &&
      COMPACT_TYPES.has(field.type) &&
      last.every((item) => COMPACT_TYPES.has(item.type))
    ) {
      last.push(field);
      continue;
    }
    groups.push([field]);
  }
  return groups;
}

export function isSensitiveField(field: FormField) {
  return /(injur|pain|medic|pregnan|surg|condition|restrict|health)/i.test(`${field.key} ${field.label}`);
}

export function fieldHint(field: FormField) {
  if (field.description) return field.description;
  if (isSensitiveField(field)) return "Your coach should know this before working with you.";
  return undefined;
}

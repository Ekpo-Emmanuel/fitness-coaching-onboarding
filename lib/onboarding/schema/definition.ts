import { allFields } from "./visibility";
import type { FormField, OnboardingSchema } from "./types";

export type SchemaDefinitionIssue = {
  path: string;
  message: string;
};

const FIELD_TYPES = new Set([
  "short_text",
  "long_text",
  "email",
  "phone",
  "date",
  "number",
  "single_select",
  "multi_select",
  "boolean",
  "scale",
  "acknowledgement",
  "unit_number",
]);

function answerKeysForField(field: FormField) {
  if (field.type === "unit_number") {
    return [field.key, field.unitKey, ...(field.companionKey ? [field.companionKey] : [])];
  }
  return [field.key];
}

export function collectAnswerKeys(schema: OnboardingSchema) {
  return allFields(schema).flatMap(answerKeysForField);
}

export function validateSchemaDefinition(schema: OnboardingSchema): SchemaDefinitionIssue[] {
  const issues: SchemaDefinitionIssue[] = [];
  const sectionIds = new Set<string>();
  const sectionKeys = new Set<string>();
  const fieldIds = new Set<string>();
  const fieldKeys = new Set<string>();

  if (!schema.id) issues.push({ path: "id", message: "Schema id is required." });
  if (!schema.schemaVersion) issues.push({ path: "schemaVersion", message: "schemaVersion is required." });
  if (!schema.sections.length) issues.push({ path: "sections", message: "At least one section is required." });
  if (schema.estimatedMinutes) {
    if (
      typeof schema.estimatedMinutes.min !== "number" ||
      !Number.isFinite(schema.estimatedMinutes.min) ||
      schema.estimatedMinutes.min < 0
    ) {
      issues.push({ path: "estimatedMinutes.min", message: "estimatedMinutes.min must be a non-negative number." });
    }
    if (
      schema.estimatedMinutes.max != null &&
      (typeof schema.estimatedMinutes.max !== "number" ||
        !Number.isFinite(schema.estimatedMinutes.max) ||
        schema.estimatedMinutes.max < schema.estimatedMinutes.min)
    ) {
      issues.push({ path: "estimatedMinutes.max", message: "estimatedMinutes.max must be >= min." });
    }
  }

  schema.sections.forEach((section, index) => {
    if (section.position !== index) {
      issues.push({ path: `sections.${section.key}.position`, message: "Section position must match array order." });
    }
    if (sectionIds.has(section.id)) {
      issues.push({ path: `sections.${section.id}`, message: "Duplicate section id." });
    }
    sectionIds.add(section.id);
    if (sectionKeys.has(section.key)) {
      issues.push({ path: `sections.${section.key}`, message: "Duplicate section key." });
    }
    sectionKeys.add(section.key);

    section.fields.forEach((field, fieldIndex) => {
      if (field.position !== fieldIndex) {
        issues.push({ path: `${field.key}.position`, message: "Field position must match array order." });
      }
      if (!FIELD_TYPES.has(field.type)) {
        issues.push({ path: field.key, message: `Unknown field type ${field.type}.` });
      }
      if (fieldIds.has(field.id)) issues.push({ path: field.id, message: "Duplicate field id." });
      fieldIds.add(field.id);
      for (const key of answerKeysForField(field)) {
        if (fieldKeys.has(key)) issues.push({ path: key, message: "Duplicate field key." });
        fieldKeys.add(key);
      }
      if (
        (field.type === "single_select" || field.type === "multi_select") &&
        (!field.options || field.options.length === 0)
      ) {
        issues.push({ path: field.key, message: "Select fields need options." });
      }
      if (field.type === "single_select" || field.type === "multi_select") {
        const values = new Set<string>();
        for (const option of field.options) {
          if (values.has(option.value)) {
            issues.push({ path: field.key, message: `Duplicate option ${option.value}.` });
          }
          values.add(option.value);
        }
      }
      if (field.type === "unit_number") {
        if (!field.units.length) issues.push({ path: field.key, message: "unit_number needs units." });
        if (!field.units.some((unit) => unit.value === field.defaultUnit)) {
          issues.push({ path: field.key, message: "defaultUnit must exist in units." });
        }
      }
      if (field.type === "scale" && field.min >= field.max) {
        issues.push({ path: field.key, message: "Scale min must be below max." });
      }
    });
  });

  for (const field of allFields(schema)) {
    const referenced = [...(field.logic?.all ?? []), ...(field.logic?.any ?? [])].map((item) => item.fieldKey);
    for (const key of referenced) {
      if (!fieldKeys.has(key)) {
        issues.push({ path: field.key, message: `Logic references unknown field ${key}.` });
      }
    }
  }

  return issues;
}

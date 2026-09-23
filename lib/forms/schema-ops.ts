import type {
  ConditionOperator,
  FieldType,
  FormField,
  FormSection,
  OnboardingSchema,
} from "@/lib/onboarding/schema/types";
import { allFields } from "@/lib/onboarding/schema/visibility";
import { FormServiceError } from "./errors";
import { newEntityId, toSnakeKey, uniqueKey } from "./keys";
import { parseOnboardingSchema } from "./parse-schema";

export const FIELD_TYPES: FieldType[] = [
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
];

export function cloneSchema(schema: OnboardingSchema): OnboardingSchema {
  return parseOnboardingSchema(structuredClone(schema));
}

export function normalizeSchema(schema: OnboardingSchema): OnboardingSchema {
  const next: OnboardingSchema = {
    ...schema,
    sections: schema.sections.map((section, position) => ({
      ...section,
      position,
      fields: section.fields.map((field, fieldPosition) => ({ ...field, position: fieldPosition })),
    })),
  };
  return parseOnboardingSchema(next);
}

function usedKeys(schema: OnboardingSchema) {
  const used = new Set<string>();
  for (const field of allFields(schema)) {
    used.add(field.key);
    if (field.type === "unit_number") {
      used.add(field.unitKey);
      if (field.companionKey) used.add(field.companionKey);
    }
  }
  return used;
}

export function createField(type: FieldType, label: string, schema: OnboardingSchema): FormField {
  const used = usedKeys(schema);
  const key = uniqueKey(toSnakeKey(label), used);
  const id = newEntityId("fld");
  const base = { id, key, label, required: false, position: 0 };
  switch (type) {
    case "short_text":
    case "long_text":
    case "email":
    case "phone":
      return { ...base, type, validation: type === "email" ? { email: true } : undefined };
    case "date":
      return { ...base, type, validation: { date: "past" } };
    case "number":
      return { ...base, type, validation: { min: 0, max: 100 } };
    case "single_select":
    case "multi_select":
      return {
        ...base,
        type,
        options: [
          { label: "Option 1", value: "option_1" },
          { label: "Option 2", value: "option_2" },
        ],
      };
    case "boolean":
      return { ...base, type };
    case "scale":
      return { ...base, type, min: 1, max: 5, lowLabel: "Low", highLabel: "High" };
    case "acknowledgement":
      return { ...base, type, required: true, statement: label };
    case "unit_number": {
      const unitKey = uniqueKey(`${key}_unit`, used);
      return {
        ...base,
        type,
        unitKey,
        defaultUnit: "lb",
        units: [
          { value: "lb", label: "lb", min: 70, max: 400 },
          { value: "kg", label: "kg", min: 30, max: 180 },
        ],
      };
    }
    default:
      return { ...base, type: "short_text" };
  }
}

export function addSection(schema: OnboardingSchema, title: string) {
  const usedSectionKeys = new Set(schema.sections.map((section) => section.key));
  const key = uniqueKey(toSnakeKey(title), usedSectionKeys);
  const section: FormSection = {
    id: newEntityId("sec"),
    key,
    title,
    navLabel: title,
    position: schema.sections.length,
    fields: [],
  };
  return normalizeSchema({ ...schema, sections: [...schema.sections, section] });
}

export function updateSection(
  schema: OnboardingSchema,
  sectionId: string,
  patch: Partial<Pick<FormSection, "title" | "description" | "navLabel" | "footer">>,
) {
  return normalizeSchema({
    ...schema,
    sections: schema.sections.map((section) => (section.id === sectionId ? { ...section, ...patch } : section)),
  });
}

export function deleteSection(schema: OnboardingSchema, sectionId: string) {
  if (schema.sections.length <= 1) {
    throw new FormServiceError("Keep at least one section.");
  }
  const target = schema.sections.find((section) => section.id === sectionId);
  if (!target) throw new FormServiceError("Section not found.");
  const keys = new Set(target.fields.flatMap((field) => [field.key]));
  const referenced = findLogicReferences(schema, keys);
  if (referenced.length > 0) {
    throw new FormServiceError(`Other questions still depend on this section: ${referenced.join(", ")}.`);
  }
  return normalizeSchema({
    ...schema,
    sections: schema.sections.filter((section) => section.id !== sectionId),
  });
}

export function moveSection(schema: OnboardingSchema, sectionId: string, direction: -1 | 1) {
  const index = schema.sections.findIndex((section) => section.id === sectionId);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= schema.sections.length) return schema;
  const sections = [...schema.sections];
  const [item] = sections.splice(index, 1);
  sections.splice(nextIndex, 0, item);
  return normalizeSchema({ ...schema, sections });
}

export function addField(schema: OnboardingSchema, sectionId: string, type: FieldType, label: string) {
  const field = createField(type, label, schema);
  return normalizeSchema({
    ...schema,
    sections: schema.sections.map((section) =>
      section.id === sectionId ? { ...section, fields: [...section.fields, field] } : section,
    ),
  });
}

export function updateField(schema: OnboardingSchema, fieldId: string, patch: Partial<FormField> & { type?: FieldType }) {
  return normalizeSchema({
    ...schema,
    sections: schema.sections.map((section) => ({
      ...section,
      fields: section.fields.map((field) => {
        if (field.id !== fieldId) return field;
        if (patch.type && patch.type !== field.type) {
          return { ...createField(patch.type, patch.label ?? field.label, schema), id: field.id, key: field.key };
        }
        return { ...field, ...patch, id: field.id, key: patch.key ?? field.key } as FormField;
      }),
    })),
  });
}

export function duplicateField(schema: OnboardingSchema, fieldId: string) {
  const original = allFields(schema).find((field) => field.id === fieldId);
  if (!original) throw new FormServiceError("Question not found.");
  const used = usedKeys(schema);
  const copy: FormField = structuredClone(original);
  copy.id = newEntityId("fld");
  copy.key = uniqueKey(`${original.key}_copy`, used);
  if (copy.type === "unit_number") {
    copy.unitKey = uniqueKey(`${copy.key}_unit`, used);
    if (copy.companionKey) copy.companionKey = uniqueKey(`${copy.key}_inches`, used);
  }
  return normalizeSchema({
    ...schema,
    sections: schema.sections.map((section) =>
      section.fields.some((field) => field.id === fieldId)
        ? { ...section, fields: [...section.fields, copy] }
        : section,
    ),
  });
}

export function deleteField(schema: OnboardingSchema, fieldId: string) {
  const target = allFields(schema).find((field) => field.id === fieldId);
  if (!target) throw new FormServiceError("Question not found.");
  const keys = new Set([target.key]);
  if (target.type === "unit_number") {
    keys.add(target.unitKey);
    if (target.companionKey) keys.add(target.companionKey);
  }
  const referenced = findLogicReferences(schema, keys).filter((key) => key !== target.key);
  if (referenced.length > 0) {
    throw new FormServiceError(`Other questions still depend on this question: ${referenced.join(", ")}.`);
  }
  return normalizeSchema({
    ...schema,
    sections: schema.sections.map((section) => ({
      ...section,
      fields: section.fields.filter((field) => field.id !== fieldId),
    })),
  });
}

export function moveField(schema: OnboardingSchema, fieldId: string, direction: -1 | 1) {
  return normalizeSchema({
    ...schema,
    sections: schema.sections.map((section) => {
      const index = section.fields.findIndex((field) => field.id === fieldId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= section.fields.length) return section;
      const fields = [...section.fields];
      const [item] = fields.splice(index, 1);
      fields.splice(nextIndex, 0, item);
      return { ...section, fields };
    }),
  });
}

export function findLogicReferences(schema: OnboardingSchema, keys: Set<string>) {
  const hits: string[] = [];
  for (const field of allFields(schema)) {
    const refs = [...(field.logic?.all ?? []), ...(field.logic?.any ?? [])].map((item) => item.fieldKey);
    if (refs.some((key) => keys.has(key))) hits.push(field.key);
  }
  return hits;
}

export const CONDITION_OPERATORS: ConditionOperator[] = [
  "equals",
  "not_equals",
  "contains",
  "not_contains",
  "is_empty",
  "is_not_empty",
];

import { FormServiceError } from "@/lib/forms/errors";
import { defaultIdentityMapping, identityMappingIssues, type ClientIdentityMapping } from "@/lib/forms/identity";
import {
  addSection,
  createField,
  deleteField,
  deleteSection,
  FIELD_TYPES,
  normalizeSchema,
  updateField,
  updateSection,
  CONDITION_OPERATORS,
} from "@/lib/forms/schema-ops";
import { newEntityId, toSnakeKey, uniqueKey } from "@/lib/forms/keys";
import { parseOnboardingSchema } from "@/lib/forms/parse-schema";
import { allFields } from "@/lib/onboarding/schema/visibility";
import type { Condition, ConditionalLogic, FieldOption, FormField, FormSection, OnboardingSchema } from "@/lib/onboarding/schema/types";
import { EMPTY_REVIEW_RULES, type ReviewRule, type ReviewRuleSet } from "@/lib/review/types";
import { assertReviewRuleSet } from "@/lib/review/validate";
import { AGENT_LIMITS } from "./limits";
import { AGENT_OPERATION_TYPES, type AgentOperation } from "./operations";

const KEY_PATTERN = /^[a-z][a-z0-9_]{0,47}$/;
const REF_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{0,47}$/;
const PLACEHOLDER_LABEL = /^(question|new question|untitled|untitled question|field|new field|label|section|new section)$/i;

function assertMeaningfulLabel(label: string, kind: "question" | "section") {
  const trimmed = label.trim();
  if (!trimmed || PLACEHOLDER_LABEL.test(trimmed)) {
    throw new AgentOperationError(
      kind === "section"
        ? "New sections need a real name, not a placeholder."
        : "New questions need a real label, not a placeholder.",
    );
  }
  return trimmed;
}

function normalizeRef(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^(the|a|an)\s+/i, "")
    .replace(/\s+(question|field|section)$/i, "")
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ");
}

function coerceRequired(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (["false", "optional", "no", "0"].includes(normalized)) return false;
  if (["true", "required", "yes", "1"].includes(normalized)) return true;
  return undefined;
}

export class AgentOperationError extends FormServiceError {
  constructor(message: string) {
    super(message, 400);
    this.name = "AgentOperationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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

function asText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map((item) => asText(item)).filter(Boolean).join(" ");
  return "";
}

function clip(value: unknown, max: number = AGENT_LIMITS.maxTextChars) {
  return asText(value).trim().slice(0, max);
}

function normalizeSelectOptions(raw: unknown): FieldOption[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const used = new Set<string>();
  const options: FieldOption[] = [];
  for (const item of raw) {
    let label = "";
    let requested = "";
    if (typeof item === "string" || typeof item === "number") {
      label = clip(item, 80);
      requested = toSnakeKey(label);
    } else if (isRecord(item)) {
      label = clip(item.label ?? item.title ?? item.value ?? item.name, 80);
      requested = asText(item.value) || toSnakeKey(label || "option");
    }
    if (!label) continue;
    let value = KEY_PATTERN.test(requested) ? requested : toSnakeKey(label || "option");
    if (!KEY_PATTERN.test(value)) value = "option";
    options.push({ label, value: uniqueKey(value, used) });
  }
  return options.length ? options : undefined;
}

function reorder<T>(items: T[], from: number, to: number) {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function resolveSectionId(
  schema: OnboardingSchema,
  refs: Map<string, string>,
  op: { sectionId?: string; sectionRef?: string; sectionIndex?: number },
) {
  if (typeof op.sectionIndex === "number" && Number.isInteger(op.sectionIndex)) {
    const section = schema.sections[op.sectionIndex];
    if (!section) throw new AgentOperationError("Section not found.");
    return section.id;
  }
  if (op.sectionRef) {
    const fromTemp = refs.get(op.sectionRef);
    if (fromTemp) return fromTemp;
    const needle = op.sectionRef.trim().toLowerCase();
    const existing = schema.sections.find(
      (section) =>
        section.key === op.sectionRef ||
        section.id === op.sectionRef ||
        section.title.toLowerCase() === needle ||
        section.navLabel?.toLowerCase() === needle,
    ) ?? schema.sections.find(
      (section) =>
        section.title.toLowerCase().includes(needle) ||
        section.navLabel?.toLowerCase().includes(needle) ||
        section.key.toLowerCase().includes(needle.replace(/\s+/g, "_")),
    );
    if (existing) return existing.id;
    throw new AgentOperationError(`Unknown section reference "${op.sectionRef}".`);
  }
  if (op.sectionId) {
    if (schema.sections.some((section) => section.id === op.sectionId)) return op.sectionId;
    const byKey = schema.sections.find((section) => section.key === op.sectionId);
    if (byKey) return byKey.id;
    throw new AgentOperationError("Section not found.");
  }
  throw new AgentOperationError("Choose a section.");
}

function resolveFieldId(
  schema: OnboardingSchema,
  refs: Map<string, string>,
  op: { fieldId?: string; fieldRef?: string; sectionId?: string; sectionRef?: string },
) {
  const sectionId =
    op.sectionId || op.sectionRef
      ? resolveSectionId(schema, refs, { sectionId: op.sectionId, sectionRef: op.sectionRef })
      : undefined;
  const inScope = allFields(schema).filter((field) => {
    if (!sectionId) return true;
    return schema.sections.some((section) => section.id === sectionId && section.fields.some((item) => item.id === field.id));
  });
  const pick = (matches: FormField[], needle: string) => {
    if (matches.length === 1) return matches[0].id;
    if (matches.length > 1) throw new AgentOperationError(`Ambiguous question reference "${needle}".`);
    return null;
  };
  if (op.fieldRef) {
    const fromTemp = refs.get(op.fieldRef);
    if (fromTemp && inScope.some((field) => field.id === fromTemp)) return fromTemp;
    const needle = op.fieldRef.trim();
    const normalized = normalizeRef(needle);
    const byKey = inScope.find((field) => field.key === needle || field.id === needle);
    if (byKey) return byKey.id;
    const exact = pick(
      inScope.filter((field) => normalizeRef(field.label) === normalized || field.key === normalized),
      needle,
    );
    if (exact) return exact;
    const fuzzy = pick(
      inScope.filter((field) => {
        const label = normalizeRef(field.label);
        return label.includes(normalized) || normalized.includes(label) || field.key.includes(normalized.replace(/\s+/g, "_"));
      }),
      needle,
    );
    if (fuzzy) return fuzzy;
    throw new AgentOperationError(`Unknown field reference "${op.fieldRef}".`);
  }
  if (op.fieldId) {
    if (inScope.some((field) => field.id === op.fieldId)) return op.fieldId;
    const byKey = inScope.find((field) => field.key === op.fieldId);
    if (byKey) return byKey.id;
    throw new AgentOperationError("Question not found.");
  }
  throw new AgentOperationError("Choose a question.");
}

function assertRef(value: string) {
  if (!REF_PATTERN.test(value)) throw new AgentOperationError("Temporary references must be short names, not IDs.");
}

function proposedKey(label: unknown, requested: string | undefined, used: Set<string>) {
  const base = requested?.trim() ? requested.trim() : toSnakeKey(asText(label) || "question");
  if (!KEY_PATTERN.test(base)) throw new AgentOperationError(`Answer key "${base}" is not valid snake_case.`);
  if (used.has(base)) return uniqueKey(base, used);
  used.add(base);
  return base;
}

export function coerceAgentOperations(input: unknown): unknown[] {
  let value: unknown = input;
  if (value == null) return [];
  if (typeof value === "string") {
    try {
      value = JSON.parse(value) as unknown;
    } catch {
      throw new AgentOperationError("Operations must be an array.");
    }
  }
  if (isRecord(value) && Array.isArray(value.operations)) value = value.operations;
  if (isRecord(value) && Array.isArray(value.sections)) {
    return flattenExpanded(value.sections as unknown[], new Set());
  }
  if (isRecord(value) && typeof value.type === "string") value = [value];
  if (isRecord(value) && !Array.isArray(value)) value = Object.values(value);
  if (!Array.isArray(value)) throw new AgentOperationError("Operations must be an array.");
  const aliased = value.map((item) => aliasOperation(item));
  return flattenExpanded(aliased, new Set());
}

const OPERATION_ALIASES: Record<string, AgentOperation["type"]> = {
  remove_section: "delete_section",
  remove_field: "delete_field",
  add_section: "create_section",
  add_field: "create_field",
  add_review_rule: "create_review_rule",
  replace_field: "create_field",
  replace_question: "create_field",
  rename_field: "update_field",
  rename_question: "update_field",
  change_field: "update_field",
};

function aliasOperation(item: unknown): unknown {
  let next: unknown = item;
  if (typeof next === "string") {
    try {
      next = JSON.parse(next) as unknown;
    } catch {
      return item;
    }
  }
  if (!isRecord(next)) return next;
  const type = next.type ?? next.op ?? next.operation ?? next.action ?? next.kind;
  if (typeof type !== "string") return next;
  const mapped = OPERATION_ALIASES[type] ?? type;
  const replaceRef =
    asText(next.replaceFieldRef || next.replaceRef || next.replaces || next.replace) ||
    ((type === "replace_field" || type === "replace_question") && asText(next.fieldRef || next.from || next.old || next.target));
  const patched: Record<string, unknown> = { ...next, type: mapped };
  if (replaceRef && mapped === "create_field") patched.replaceFieldRef = replaceRef;
  if (asText(next.afterFieldRef || next.after)) patched.afterFieldRef = asText(next.afterFieldRef || next.after);
  if (asText(next.beforeFieldRef || next.before)) patched.beforeFieldRef = asText(next.beforeFieldRef || next.before);
  if (next.toIndex == null && typeof next.index === "number") patched.toIndex = next.index;
  return patched;
}

function makeRef(label: string, used: Set<string>) {
  let base = toSnakeKey(label).replace(/^[0-9_]+/, "") || "item";
  if (!/^[a-zA-Z]/.test(base)) base = `s_${base}`;
  base = base.slice(0, 48);
  let ref = base;
  let index = 2;
  while (used.has(ref)) {
    ref = `${base}_${index}`.slice(0, 48);
    index += 1;
  }
  used.add(ref);
  return ref;
}

function flattenExpanded(items: unknown[], used: Set<string>): unknown[] {
  const out: unknown[] = [];
  let lastSectionRef: string | undefined;
  for (const raw of items) {
    const item = aliasOperation(raw);
    if (!isRecord(item)) continue;
    const nested = item.fields ?? item.questions ?? item.items;
    const isUntypedSection = !item.type && typeof item.title === "string";
    if (item.type === "delete_section" || item.type === "delete_field") {
      const indexRaw = item.sectionIndex ?? item.index ?? item.atIndex;
      out.push({
        ...item,
        type: item.type,
        sectionRef: item.sectionRef ?? item.key ?? item.title ?? item.navLabel,
        fieldRef: item.fieldRef ?? (item.type === "delete_field" ? item.key ?? item.label : item.fieldRef),
        sectionIndex: typeof indexRaw === "number" ? indexRaw : undefined,
      });
      continue;
    }
    if (item.type === "create_section" || isUntypedSection) {
      const title = assertMeaningfulLabel(String(item.title ?? ""), "section");
      const tempRef = typeof item.tempRef === "string" && REF_PATTERN.test(item.tempRef) ? item.tempRef : makeRef(title, used);
      used.add(tempRef);
      lastSectionRef = tempRef;
      out.push({
        type: "create_section",
        tempRef,
        title,
        key: item.key,
        navLabel: item.navLabel,
        description: item.description,
      });
      if (Array.isArray(nested)) {
        for (const child of nested) {
          const field = expandField(child, tempRef, used);
          if (field) out.push(field);
        }
      }
      continue;
    }
    if (item.type === "create_review_rule" || item.type === "review_rule" || (isRecord(item.conditions) && item.label && item.type !== "create_field")) {
      out.push(expandReviewRule(item, used));
      continue;
    }
    if (typeof item.type === "string" && FIELD_TYPES.includes(item.type as (typeof FIELD_TYPES)[number]) && !item.fieldType) {
      const field = expandField({ ...item, fieldType: item.type }, lastSectionRef, used);
      if (field) out.push(field);
      continue;
    }
    if (item.type === "create_field") {
      const field = expandField(item, typeof item.sectionRef === "string" ? item.sectionRef : lastSectionRef, used);
      if (!field) throw new AgentOperationError("Choose a section for the new question.");
      out.push(field);
      continue;
    }
    out.push(item);
  }
  return out;
}

function expandField(raw: unknown, sectionRef: string | undefined, used: Set<string>) {
  if (!isRecord(raw)) return null;
  const label = assertMeaningfulLabel(asText(raw.label ?? raw.title ?? raw.name ?? raw.question ?? raw.prompt), "question");
  const fieldTypeRaw = raw.fieldType ?? raw.questionType ?? (FIELD_TYPES.includes(raw.type as (typeof FIELD_TYPES)[number]) ? raw.type : "short_text");
  const fieldType = FIELD_TYPES.includes(fieldTypeRaw as (typeof FIELD_TYPES)[number])
    ? fieldTypeRaw
    : "short_text";
  const tempRef = typeof raw.tempRef === "string" && REF_PATTERN.test(raw.tempRef) ? raw.tempRef : makeRef(label, used);
  used.add(tempRef);
  const resolvedSection = typeof raw.sectionRef === "string" ? raw.sectionRef : sectionRef;
  if (!resolvedSection) return null;
  const toIndex = typeof raw.toIndex === "number" ? raw.toIndex : typeof raw.index === "number" ? raw.index : undefined;
  return {
    type: "create_field",
    tempRef,
    sectionRef: resolvedSection,
    fieldType,
    label,
    key: raw.key,
    required: coerceRequired(raw.required),
    description: raw.description,
    statement: raw.statement,
    options: normalizeSelectOptions(raw.options),
    validation: raw.validation,
    logic: raw.logic,
    toIndex,
    afterFieldRef: asText(raw.afterFieldRef || raw.after) || undefined,
    beforeFieldRef: asText(raw.beforeFieldRef || raw.before) || undefined,
    replaceFieldRef: asText(raw.replaceFieldRef || raw.replaces) || undefined,
  };
}

function fieldKeyFromRef(key: string, schema: OnboardingSchema, refs: Map<string, string>) {
  if (allFields(schema).some((field) => field.key === key)) return key;
  const id = refs.get(key);
  if (id) {
    const field = allFields(schema).find((item) => item.id === id);
    if (field) return field.key;
  }
  return key;
}

function rewriteConditionList(list: Condition[] | undefined, schema: OnboardingSchema, refs: Map<string, string>) {
  return list?.map((condition) => ({
    ...condition,
    fieldKey: fieldKeyFromRef(asText(condition.fieldKey), schema, refs),
  }));
}

function rewriteLogic(logic: ConditionalLogic, schema: OnboardingSchema, refs: Map<string, string>): ConditionalLogic {
  return {
    action: "show",
    all: rewriteConditionList(logic.all, schema, refs),
    any: rewriteConditionList(logic.any, schema, refs),
  };
}

function asCondition(raw: unknown): Condition | null {
  if (!isRecord(raw)) return null;
  const fieldKey = asText(raw.fieldKey || raw.fieldRef || raw.source);
  if (!fieldKey) return null;
  const operatorRaw = asText(raw.operator || "equals");
  const operator = CONDITION_OPERATORS.includes(operatorRaw as Condition["operator"])
    ? (operatorRaw as Condition["operator"])
    : "equals";
  return { fieldKey, operator, value: raw.value };
}

function asConditionGroup(raw: unknown): { all?: Condition[]; any?: Condition[] } | undefined {
  if (raw == null) return undefined;
  if (Array.isArray(raw)) {
    const all = raw.map(asCondition).filter((item): item is Condition => Boolean(item));
    return all.length ? { all } : undefined;
  }
  if (!isRecord(raw)) return undefined;
  if (Array.isArray(raw.all) || Array.isArray(raw.any)) {
    const all = Array.isArray(raw.all) ? raw.all.map(asCondition).filter((item): item is Condition => Boolean(item)) : undefined;
    const any = Array.isArray(raw.any) ? raw.any.map(asCondition).filter((item): item is Condition => Boolean(item)) : undefined;
    if ((all?.length ?? 0) + (any?.length ?? 0) === 0) return undefined;
    return { all, any };
  }
  const one = asCondition(raw);
  return one ? { all: [one] } : undefined;
}

function stringKeys(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => asText(item)).filter(Boolean);
}

function expandReviewRule(item: Record<string, unknown>, used: Set<string>) {
  const conditions =
    asConditionGroup(item.conditions) ??
    asConditionGroup(item.when) ??
    asConditionGroup(item.if) ??
    asConditionGroup(Array.isArray(item.all) || Array.isArray(item.any) ? { all: item.all, any: item.any } : undefined);
  const sourceFieldKeys = stringKeys(item.sourceFieldKeys).length ? stringKeys(item.sourceFieldKeys) : stringKeys(item.fieldKeys);
  const tempRef =
    typeof item.tempRef === "string" && REF_PATTERN.test(item.tempRef)
      ? item.tempRef
      : makeRef(String(item.label ?? "rule"), used);
  used.add(tempRef);
  return {
    type: "create_review_rule",
    tempRef,
    label: item.label,
    code: item.code,
    conditions,
    sourceFieldKeys,
  };
}

function conditionCount(conditions?: { all?: Condition[]; any?: Condition[] }) {
  return (conditions?.all?.length ?? 0) + (conditions?.any?.length ?? 0);
}

function defaultFlagCondition(field: FormField): Condition {
  if (field.type === "boolean") return { fieldKey: field.key, operator: "equals", value: true };
  if (field.type === "single_select" || field.type === "multi_select") {
    const yes = field.options.find(
      (option) => /^(yes|true)$/i.test(option.value) || /^yes\b/i.test(option.label),
    );
    if (yes) {
      return {
        fieldKey: field.key,
        operator: field.type === "multi_select" ? "contains" : "equals",
        value: yes.value,
      };
    }
  }
  return { fieldKey: field.key, operator: "is_not_empty" };
}

function reviewFieldTopic(field: FormField) {
  const text = `${field.key} ${field.label}`.toLowerCase();
  if (/restrict|avoid|modif/.test(text)) return "restrict";
  if (/clinician|professional/.test(text) && field.type === "boolean") return "restrict";
  if (/pain|injur/.test(text)) return "pain";
  return null;
}

function inferReviewFields(label: string, schema: OnboardingSchema) {
  const hay = label.toLowerCase();
  const wantRestrict = /restrict/.test(hay);
  const wantPain = /pain|injur/.test(hay);
  return allFields(schema).filter((field) => {
    if (field.type !== "boolean" && field.type !== "single_select") return false;
    const topic = reviewFieldTopic(field);
    if (wantRestrict) return topic === "restrict";
    if (wantPain) return topic === "pain";
    return false;
  });
}

function completeReviewRule(
  operation: Extract<AgentOperation, { type: "create_review_rule" }>,
  schema: OnboardingSchema,
  refs: Map<string, string>,
) {
  let conditions = {
    all: rewriteConditionList(operation.conditions?.all, schema, refs),
    any: rewriteConditionList(operation.conditions?.any, schema, refs),
  };
  let sourceFieldKeys = (operation.sourceFieldKeys ?? []).map((key) => fieldKeyFromRef(key, schema, refs)).filter(Boolean);
  if (conditionCount(conditions) === 0 && sourceFieldKeys.length) {
    const fields = sourceFieldKeys
      .map((key) => allFields(schema).find((field) => field.key === key))
      .filter((field): field is FormField => Boolean(field));
    conditions = { all: fields.map(defaultFlagCondition), any: undefined };
  }
  if (conditionCount(conditions) === 0) {
    const inferred = inferReviewFields(asText(operation.label), schema);
    if (inferred.length === 1) conditions = { all: inferred.map(defaultFlagCondition), any: undefined };
    else if (inferred.length > 1) conditions = { all: undefined, any: inferred.map(defaultFlagCondition) };
    sourceFieldKeys = inferred.map((field) => field.key);
  }
  if (!sourceFieldKeys.length) {
    sourceFieldKeys = [...(conditions.all ?? []), ...(conditions.any ?? [])].map((item) => item.fieldKey);
  }
  return { conditions, sourceFieldKeys };
}

export function parseAgentOperations(input: unknown): AgentOperation[] {
  const items = coerceAgentOperations(input);
  if (items.length > AGENT_LIMITS.maxOperations) {
    throw new AgentOperationError("That request is too large. Split it into smaller changes.");
  }
  return items.map((item, index) => parseOne(item, index));
}

function parseOne(item: unknown, index: number): AgentOperation {
  if (!isRecord(item) || typeof item.type !== "string") {
    throw new AgentOperationError(`Operation ${index + 1} is invalid.`);
  }
  if (!AGENT_OPERATION_TYPES.includes(item.type as AgentOperation["type"])) {
    throw new AgentOperationError(`Unsupported operation "${item.type}".`);
  }
  if (item.type === "create_field") assertMeaningfulLabel(asText(item.label), "question");
  if (item.type === "create_section") assertMeaningfulLabel(asText(item.title), "section");
  if ("required" in item) {
    const required = coerceRequired(item.required);
    if (required === undefined) delete item.required;
    else item.required = required;
  }
  return item as AgentOperation;
}

export type ApplyAgentResult = {
  schema: OnboardingSchema;
  clientIdentityMapping: ClientIdentityMapping | null;
  reviewRules: ReviewRuleSet | null;
  formName?: string;
  changeSummary: {
    addedSections: string[];
    addedFields: string[];
    updated: string[];
    removed: string[];
    minutesBefore?: { min: number; max?: number };
    minutesAfter?: { min: number; max?: number };
    details: string[];
  };
};

export function applyAgentOperations(input: {
  schema: OnboardingSchema;
  clientIdentityMapping: ClientIdentityMapping | null;
  reviewRules?: ReviewRuleSet | null;
  operations: AgentOperation[];
}): ApplyAgentResult {
  let schema = structuredClone(input.schema);
  let mapping = input.clientIdentityMapping;
  let reviewRules: ReviewRuleSet = structuredClone(input.reviewRules ?? EMPTY_REVIEW_RULES);
  let formName: string | undefined;
  const refs = new Map<string, string>();
  const summary: ApplyAgentResult["changeSummary"] = {
    addedSections: [],
    addedFields: [],
    updated: [],
    removed: [],
    minutesBefore: schema.estimatedMinutes,
    details: [],
  };
  let createdSections = 0;
  let createdFields = 0;
  let insertHint: { sectionId: string; index: number; label: string } | undefined;

  for (const operation of input.operations) {
    if (operation.type === "create_section") {
      createdSections += 1;
      if (createdSections > AGENT_LIMITS.maxCreateSections) {
        throw new AgentOperationError("Too many new sections in one proposal.");
      }
    }
    if (operation.type === "create_field") {
      createdFields += 1;
      if (createdFields > AGENT_LIMITS.maxCreateFields) {
        throw new AgentOperationError("Too many new questions in one proposal.");
      }
    }
    if (
      operation.type === "create_review_rule" ||
      operation.type === "update_review_rule" ||
      operation.type === "delete_review_rule"
    ) {
      const next = applyReviewRule(reviewRules, refs, schema, operation);
      reviewRules = next.rules;
      summary.details.push(next.detail);
      if (next.kind === "add_field") summary.addedFields.push(next.label);
      if (next.kind === "update") summary.updated.push(next.label);
      if (next.kind === "remove") summary.removed.push(next.label);
      continue;
    }
    const next = applyOne(schema, mapping, refs, operation, insertHint);
    schema = next.schema;
    mapping = next.mapping;
    if (next.formName) formName = next.formName;
    if (next.replacedFrom) {
      summary.details.pop();
      summary.removed.pop();
      summary.details.push(`Replaced: ${next.replacedFrom} → ${next.label}`);
      summary.updated.push(next.label);
    } else {
      summary.details.push(next.detail);
      if (next.kind === "add_section") summary.addedSections.push(next.label);
      if (next.kind === "add_field") summary.addedFields.push(next.label);
      if (next.kind === "update") summary.updated.push(next.label);
      if (next.kind === "remove") summary.removed.push(next.label);
    }
    insertHint = next.removedSlot;
  }

  schema = parseOnboardingSchema(normalizeSchema(schema));
  let identityIssues = identityMappingIssues(schema, mapping);
  if (identityIssues.length > 0) {
    const remapped = defaultIdentityMapping(schema);
    if (remapped && identityMappingIssues(schema, remapped).length === 0) {
      mapping = remapped;
      identityIssues = [];
    }
  }
  if (identityIssues.length > 0) {
    throw new AgentOperationError(identityIssues[0]);
  }
  try {
    assertReviewRuleSet(schema, reviewRules);
  } catch (error) {
    throw new AgentOperationError(error instanceof Error ? error.message : "Review rules are invalid.");
  }
  summary.minutesAfter = schema.estimatedMinutes;
  return { schema, clientIdentityMapping: mapping, reviewRules, formName, changeSummary: summary };
}

function applyOne(
  schema: OnboardingSchema,
  mapping: ClientIdentityMapping | null,
  refs: Map<string, string>,
  operation: AgentOperation,
  insertHint?: { sectionId: string; index: number; label: string },
): {
  schema: OnboardingSchema;
  mapping: ClientIdentityMapping | null;
  formName?: string;
  detail: string;
  kind: "add_section" | "add_field" | "update" | "remove" | "other";
  label: string;
  removedSlot?: { sectionId: string; index: number; label: string };
  replacedFrom?: string;
} {
  switch (operation.type) {
    case "update_form_metadata": {
      const next = {
        ...schema,
        title: operation.title != null ? clip(operation.title, 120) : schema.title,
        description: operation.description != null ? clip(operation.description, 800) : schema.description,
        estimatedMinutes: operation.estimatedMinutes ?? schema.estimatedMinutes,
      };
      return {
        schema: next,
        mapping,
        formName: operation.formName ? clip(operation.formName, 80) : undefined,
        detail: `Updated form details`,
        kind: "update",
        label: next.title,
      };
    }
    case "update_intro": {
      const intro = {
        ...schema.intro,
        title: operation.title != null ? clip(operation.title) : schema.intro.title,
        navLabel: operation.navLabel != null ? clip(operation.navLabel, 40) : schema.intro.navLabel,
        description: operation.description?.map((line) => clip(line, 400)) ?? schema.intro.description,
        buttonLabel: operation.buttonLabel != null ? clip(operation.buttonLabel, 40) : schema.intro.buttonLabel,
        footnote: operation.footnote != null ? clip(operation.footnote) : schema.intro.footnote,
      };
      return {
        schema: { ...schema, intro },
        mapping,
        detail: `Updated intro: ${intro.title}`,
        kind: "update",
        label: intro.title,
      };
    }
    case "update_success": {
      const success = {
        ...schema.success,
        title: operation.title != null ? clip(operation.title) : schema.success.title,
        message: operation.message?.map((line) => clip(line, 400)) ?? schema.success.message,
        aside: operation.aside != null ? clip(operation.aside) : schema.success.aside,
        closing: operation.closing != null ? clip(operation.closing) : schema.success.closing,
      };
      return {
        schema: { ...schema, success },
        mapping,
        detail: `Updated success: ${success.title}`,
        kind: "update",
        label: success.title,
      };
    }
    case "create_section": {
      assertRef(operation.tempRef);
      if (refs.has(operation.tempRef)) throw new AgentOperationError(`Duplicate reference "${operation.tempRef}".`);
      const created = addSection(schema, clip(operation.title, 80));
      const section = created.sections[created.sections.length - 1];
      let next = created;
      if (operation.navLabel || operation.description || operation.key) {
        next = updateSection(created, section.id, {
          navLabel: operation.navLabel ? clip(operation.navLabel, 40) : section.navLabel,
          description: operation.description ? clip(operation.description, 400) : section.description,
        });
        if (operation.key) {
          if (!KEY_PATTERN.test(operation.key)) throw new AgentOperationError("Section key is invalid.");
          next = {
            ...next,
            sections: next.sections.map((item) =>
              item.id === section.id ? { ...item, key: operation.key as string } : item,
            ),
          };
        }
      }
      refs.set(operation.tempRef, section.id);
      return {
        schema: next,
        mapping,
        detail: `Added section: ${section.title}`,
        kind: "add_section",
        label: section.title,
      };
    }
    case "update_section": {
      const sectionId = resolveSectionId(schema, refs, operation);
      const patch: Partial<Pick<FormSection, "title" | "description" | "navLabel" | "footer">> = {};
      if (operation.title != null) patch.title = clip(operation.title, 80);
      if (operation.navLabel != null) patch.navLabel = clip(operation.navLabel, 40);
      if (operation.description != null) patch.description = clip(operation.description, 400);
      if (operation.footer != null) patch.footer = clip(operation.footer, 400);
      const next = updateSection(schema, sectionId, patch);
      const section = next.sections.find((item) => item.id === sectionId)!;
      return {
        schema: next,
        mapping,
        detail: `Updated section: ${section.title}`,
        kind: "update",
        label: section.title,
      };
    }
    case "delete_section": {
      const sectionId = resolveSectionId(schema, refs, operation);
      const section = schema.sections.find((item) => item.id === sectionId)!;
      return {
        schema: deleteSection(schema, sectionId),
        mapping,
        detail: `Removed section: ${section.title}`,
        kind: "remove",
        label: section.title,
      };
    }
    case "move_section": {
      const sectionId = resolveSectionId(schema, refs, operation);
      const section = schema.sections.find((item) => item.id === sectionId);
      if (!section) throw new AgentOperationError("Section not found.");
      let next = schema;
      let index = next.sections.findIndex((item) => item.id === sectionId);
      const target = Math.max(0, Math.min(operation.toIndex, next.sections.length - 1));
      while (index > target) {
        next = { ...next, sections: reorder(next.sections, index, index - 1) };
        index -= 1;
      }
      while (index < target) {
        next = { ...next, sections: reorder(next.sections, index, index + 1) };
        index += 1;
      }
      return {
        schema: normalizeSchema(next),
        mapping,
        detail: `Moved section: ${section.title}`,
        kind: "update",
        label: section.title,
      };
    }
    case "create_field": {
      if (!FIELD_TYPES.includes(operation.fieldType)) {
        throw new AgentOperationError(`Unsupported question type "${operation.fieldType}".`);
      }
      assertMeaningfulLabel(operation.label, "question");
      const sectionId = resolveSectionId(schema, refs, operation);
      const used = usedKeys(schema);
      let field = createField(operation.fieldType, clip(operation.label), schema);
      field = { ...field, key: proposedKey(operation.label, operation.key, used), required: operation.required ?? field.required };
      if (operation.description) field = { ...field, description: clip(operation.description) };
      if (operation.statement && field.type === "acknowledgement") {
        field = { ...field, statement: clip(operation.statement) };
      }
      const selectOptions = normalizeSelectOptions(operation.options);
      if (selectOptions && (field.type === "single_select" || field.type === "multi_select")) {
        if (selectOptions.length > AGENT_LIMITS.maxOptions) {
          throw new AgentOperationError("Too many choices on one question.");
        }
        field = { ...field, options: selectOptions };
      }
      if (operation.validation) field = { ...field, validation: operation.validation } as FormField;
      if (operation.logic) field = { ...field, logic: rewriteLogic(operation.logic, schema, refs) };
      if (operation.tempRef) {
        assertRef(operation.tempRef);
        refs.set(operation.tempRef, field.id);
      }
      const section = schema.sections.find((item) => item.id === sectionId);
      if (!section) throw new AgentOperationError("Section not found.");
      let working = schema;
      let insertAt = section.fields.length;
      let replacedLabel: string | undefined;
      if (operation.replaceFieldRef) {
        const replaceId = resolveFieldId(schema, refs, { fieldRef: operation.replaceFieldRef });
        const removed = allFields(schema).find((item) => item.id === replaceId)!;
        const currentIndex = section.fields.findIndex((item) => item.id === replaceId);
        if (currentIndex < 0) {
          throw new AgentOperationError("Replacement target is not in that section.");
        }
        insertAt = currentIndex;
        working = deleteField(schema, replaceId);
        replacedLabel = removed.label;
      } else if (operation.afterFieldRef) {
        const afterId = resolveFieldId(schema, refs, { fieldRef: operation.afterFieldRef, sectionId });
        const index = section.fields.findIndex((item) => item.id === afterId);
        if (index < 0) throw new AgentOperationError("That question is not in this section.");
        insertAt = index + 1;
      } else if (operation.beforeFieldRef) {
        const beforeId = resolveFieldId(schema, refs, { fieldRef: operation.beforeFieldRef, sectionId });
        const index = section.fields.findIndex((item) => item.id === beforeId);
        if (index < 0) throw new AgentOperationError("That question is not in this section.");
        insertAt = index;
      } else if (typeof operation.toIndex === "number" && Number.isInteger(operation.toIndex)) {
        insertAt = Math.max(0, Math.min(operation.toIndex, section.fields.length));
      } else if (insertHint && insertHint.sectionId === sectionId) {
        insertAt = Math.max(0, Math.min(insertHint.index, section.fields.length));
        replacedLabel = insertHint.label;
      }
      const next = normalizeSchema({
        ...working,
        sections: working.sections.map((item) => {
          if (item.id !== sectionId) return item;
          const fields = [...item.fields];
          const at = Math.max(0, Math.min(insertAt, fields.length));
          fields.splice(at, 0, field);
          return { ...item, fields };
        }),
      });
      return {
        schema: next,
        mapping,
        detail: replacedLabel ? `Replaced: ${replacedLabel} → ${field.label}` : `Added question: ${field.label}`,
        kind: replacedLabel ? "update" : "add_field",
        label: field.label,
        replacedFrom: operation.replaceFieldRef ? undefined : replacedLabel,
      };
    }
    case "update_field": {
      const fieldId = resolveFieldId(schema, refs, operation);
      const before = allFields(schema).find((field) => field.id === fieldId)!;
      const patch: Partial<FormField> & { type?: FormField["type"] } = {};
      if (operation.label != null) patch.label = clip(operation.label);
      if (operation.required != null) patch.required = operation.required;
      if (operation.description != null) patch.description = clip(operation.description);
      if (operation.placeholder != null) patch.placeholder = clip(operation.placeholder);
      if (operation.fieldType && operation.fieldType !== before.type) {
        if (!FIELD_TYPES.includes(operation.fieldType)) {
          throw new AgentOperationError(`Unsupported question type "${operation.fieldType}".`);
        }
        patch.type = operation.fieldType;
      }
      const next = updateField(
        schema,
        fieldId,
        operation.statement ? { ...patch, statement: clip(operation.statement) } : patch,
      );
      const after = allFields(next).find((field) => field.id === fieldId)!;
      return {
        schema: next,
        mapping,
        detail: before.label === after.label ? `Updated: ${after.label}` : `Updated: ${before.label} → ${after.label}`,
        kind: "update",
        label: after.label,
      };
    }
    case "delete_field": {
      const fieldId = resolveFieldId(schema, refs, operation);
      const field = allFields(schema).find((item) => item.id === fieldId)!;
      const owner = schema.sections.find((section) => section.fields.some((item) => item.id === fieldId));
      const index = owner?.fields.findIndex((item) => item.id === fieldId) ?? 0;
      return {
        schema: deleteField(schema, fieldId),
        mapping,
        detail: `Removed: ${field.label}`,
        kind: "remove",
        label: field.label,
        removedSlot: owner ? { sectionId: owner.id, index, label: field.label } : undefined,
      };
    }
    case "move_field": {
      const fieldId = resolveFieldId(schema, refs, operation);
      let targetSectionId = schema.sections.find((section) => section.fields.some((field) => field.id === fieldId))?.id;
      if (operation.sectionId || operation.sectionRef) {
        targetSectionId = resolveSectionId(schema, refs, operation);
      }
      if (!targetSectionId) throw new AgentOperationError("Question not found.");
      let moving: FormField | undefined;
      const stripped: FormSection[] = schema.sections.map((section) => ({
        ...section,
        fields: section.fields.filter((field) => {
          if (field.id !== fieldId) return true;
          moving = field;
          return false;
        }),
      }));
      if (!moving) throw new AgentOperationError("Question not found.");
      const nextSections = stripped.map((section) => {
        if (section.id !== targetSectionId) return section;
        const fields = [...section.fields];
        const toIndex = Math.max(0, Math.min(operation.toIndex, fields.length));
        fields.splice(toIndex, 0, moving as FormField);
        return { ...section, fields };
      });
      return {
        schema: normalizeSchema({ ...schema, sections: nextSections }),
        mapping,
        detail: `Moved question: ${moving.label}`,
        kind: "update",
        label: moving.label,
      };
    }
    case "set_field_options": {
      const fieldId = resolveFieldId(schema, refs, operation);
      const field = allFields(schema).find((item) => item.id === fieldId)!;
      if (field.type !== "single_select" && field.type !== "multi_select") {
        throw new AgentOperationError("Choices can only be set on select questions.");
      }
      const selectOptions = normalizeSelectOptions(operation.options);
      if (!selectOptions) throw new AgentOperationError("Select questions need choices.");
      if (selectOptions.length > AGENT_LIMITS.maxOptions) {
        throw new AgentOperationError("Too many choices on one question.");
      }
      const next = updateField(schema, fieldId, { options: selectOptions });
      return {
        schema: next,
        mapping,
        detail: `Updated choices: ${field.label}`,
        kind: "update",
        label: field.label,
      };
    }
    case "set_field_validation": {
      const fieldId = resolveFieldId(schema, refs, operation);
      const field = allFields(schema).find((item) => item.id === fieldId)!;
      const next = updateField(schema, fieldId, { validation: operation.validation ?? undefined });
      return {
        schema: next,
        mapping,
        detail: `Updated validation: ${field.label}`,
        kind: "update",
        label: field.label,
      };
    }
    case "set_field_logic": {
      const fieldId = resolveFieldId(schema, refs, operation);
      const field = allFields(schema).find((item) => item.id === fieldId)!;
      if (operation.logic) {
        const keys = new Set(usedKeys(schema));
        for (const condition of [...(operation.logic.all ?? []), ...(operation.logic.any ?? [])]) {
          if (!keys.has(condition.fieldKey)) {
            throw new AgentOperationError(`Show-when refers to missing question "${condition.fieldKey}".`);
          }
        }
      }
      const next = updateField(schema, fieldId, { logic: operation.logic ?? undefined });
      return {
        schema: next,
        mapping,
        detail: operation.logic ? `Updated show-when: ${field.label}` : `Cleared show-when: ${field.label}`,
        kind: "update",
        label: field.label,
      };
    }
    case "set_client_identity_mapping": {
      return {
        schema,
        mapping: operation.mapping,
        detail: "Updated client identity questions",
        kind: "update",
        label: "Client identity",
      };
    }
    default:
      throw new AgentOperationError("Unsupported operation.");
  }
}

function applyReviewRule(
  rules: ReviewRuleSet,
  refs: Map<string, string>,
  schema: OnboardingSchema,
  operation: Extract<AgentOperation, { type: "create_review_rule" | "update_review_rule" | "delete_review_rule" }>,
): { rules: ReviewRuleSet; detail: string; kind: "add_field" | "update" | "remove"; label: string } {
  if (operation.type === "create_review_rule") {
    const used = new Set(rules.rules.map((rule) => rule.code));
    const code = uniqueKey(operation.code ? toSnakeKey(operation.code) : toSnakeKey(operation.label), used);
    const id = newEntityId("rule");
    if (operation.tempRef) refs.set(operation.tempRef, id);
    const normalized = completeReviewRule(operation, schema, refs);
    const next: ReviewRule = {
      id,
      code,
      label: clip(operation.label, 120),
      conditions: normalized.conditions,
      sourceFieldKeys: normalized.sourceFieldKeys,
    };
    return {
      rules: { ...rules, rules: [...rules.rules, next] },
      detail: `Added review rule: ${next.label}`,
      kind: "add_field",
      label: next.label,
    };
  }
  const id = operation.ruleId ?? (operation.ruleRef ? refs.get(operation.ruleRef) : undefined);
  if (!id) throw new AgentOperationError("Review rule reference is missing.");
  const index = rules.rules.findIndex((rule) => rule.id === id);
  if (index < 0) throw new AgentOperationError("Review rule was not found.");
  if (operation.type === "delete_review_rule") {
    const removed = rules.rules[index];
    return {
      rules: { ...rules, rules: rules.rules.filter((rule) => rule.id !== id) },
      detail: `Removed review rule: ${removed.label}`,
      kind: "remove",
      label: removed.label,
    };
  }
  const current = rules.rules[index];
  const next = [...rules.rules];
  next[index] = {
    ...current,
    code: operation.code ? toSnakeKey(operation.code) : current.code,
    label: operation.label != null ? clip(operation.label, 120) : current.label,
    conditions: operation.conditions ?? current.conditions,
    sourceFieldKeys: operation.sourceFieldKeys ?? current.sourceFieldKeys,
  };
  return {
    rules: { ...rules, rules: next },
    detail: `Updated review rule: ${next[index].label}`,
    kind: "update",
    label: next[index].label,
  };
}

export function formatChangeSummary(summary: ApplyAgentResult["changeSummary"]) {
  const lines: string[] = [];
  if (summary.addedSections.length) lines.push(`+ Add ${summary.addedSections.join(", ")}`);
  if (summary.addedFields.length) {
    lines.push(`+ Add ${summary.addedFields.length} question${summary.addedFields.length === 1 ? "" : "s"}`);
  }
  if (summary.updated.length) lines.push(`~ Update ${summary.updated.length} item${summary.updated.length === 1 ? "" : "s"}`);
  if (summary.removed.length) {
    lines.push(`- Remove ${summary.removed.length} item${summary.removed.length === 1 ? "" : "s"}`);
  }
  if (summary.minutesBefore && summary.minutesAfter) {
    const before = `${summary.minutesBefore.min}${summary.minutesBefore.max ? `–${summary.minutesBefore.max}` : ""} min`;
    const after = `${summary.minutesAfter.min}${summary.minutesAfter.max ? `–${summary.minutesAfter.max}` : ""} min`;
    if (before !== after) lines.push(`Estimated length: ${before} → ${after}`);
  }
  return lines.length ? lines.join("\n") : "Proposed updates";
}

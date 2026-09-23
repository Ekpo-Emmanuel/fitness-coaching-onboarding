import { collectAnswerKeys } from "./definition";
import type {
  FormField,
  FormSection,
  OnboardingAnswers,
  OnboardingSchema,
} from "./types";
import { isFieldVisible } from "./visibility";

export class ValidationError extends Error {
  constructor(public fields: Record<string, string>) {
    super("Invalid onboarding submission");
    this.name = "ValidationError";
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function asString(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function isBlank(value: unknown) {
  return asString(value).trim() === "";
}

function parseNumber(
  value: unknown,
  field: string,
  errors: Record<string, string>,
  min: number,
  max: number,
) {
  const n = Number(asString(value));
  if (!Number.isFinite(n) || n < min || n > max) {
    errors[field] = `Enter a number between ${min} and ${max}.`;
    return null;
  }
  return n;
}

function validateField(
  field: FormField,
  answers: OnboardingAnswers,
  errors: Record<string, string>,
) {
  if (!isFieldVisible(field, answers)) return;
  const value = answers[field.key];
  const requiredMessage =
    "validation" in field && field.validation?.requiredMessage
      ? field.validation.requiredMessage
      : "This is required.";

  if (field.type === "acknowledgement") {
    if (field.required && value !== true) {
      errors[field.key] =
        field.validation?.requiredMessage ?? "Confirm this before continuing.";
    }
    return;
  }

  if (field.type !== "multi_select" && isBlank(value)) {
    if (field.required) errors[field.key] = requiredMessage;
    return;
  }

  if (field.type === "boolean") {
    if (typeof value !== "boolean") errors[field.key] = "Choose Yes or No.";
    return;
  }

  if (field.type === "scale") {
    const n = typeof value === "number" ? value : Number(value);
    if (
      value == null ||
      !Number.isFinite(n) ||
      n < field.min ||
      n > field.max
    ) {
      errors[field.key] = `Choose a number from ${field.min} to ${field.max}.`;
    }
    return;
  }

  if (field.type === "multi_select") {
    const allowed = new Set(field.options.map((option) => option.value));
    if (!Array.isArray(value)) {
      errors[field.key] = "Select valid options.";
      return;
    }
    if (value.some((item) => typeof item !== "string" || !allowed.has(item))) {
      errors[field.key] = "Remove unknown options and try again.";
      return;
    }
    const minItems = field.validation?.minItems ?? (field.required ? 1 : 0);
    if (value.length < minItems) {
      errors[field.key] =
        field.validation?.requiredMessage ?? "Select at least one option.";
    }
    return;
  }

  if (field.type === "single_select") {
    const allowed = field.options.map((option) => option.value);
    if (!allowed.includes(asString(value))) {
      errors[field.key] = "Choose one of the listed options.";
    }
    return;
  }

  if (field.type === "unit_number") {
    const unit = asString(answers[field.unitKey]);
    const selected = field.units.find((item) => item.value === unit);
    if (!selected) {
      errors[field.unitKey] = "Choose one of the listed options.";
      return;
    }
    parseNumber(
      answers[field.key],
      field.key,
      errors,
      selected.min,
      selected.max,
    );
    if (selected.companion && field.companionKey) {
      parseNumber(
        answers[field.companionKey] || "0",
        field.companionKey,
        errors,
        selected.companion.min,
        selected.companion.max,
      );
    }
    return;
  }

  if (field.type === "email") {
    if (field.required && isBlank(value)) {
      errors[field.key] = requiredMessage;
      return;
    }
    if (!isBlank(value) && !EMAIL_RE.test(asString(value).trim())) {
      errors[field.key] = "Enter a valid email.";
    }
    return;
  }

  if (field.type === "date") {
    if (field.required && isBlank(value)) {
      errors[field.key] = requiredMessage;
      return;
    }
    if (!isBlank(value) && field.validation?.date === "past") {
      const dob = new Date(`${asString(value)}T00:00:00`);
      if (Number.isNaN(dob.getTime()) || dob >= new Date()) {
        errors[field.key] = "Enter a valid date in the past.";
      }
    }
    return;
  }

  if (field.type === "number") {
    const min = field.validation?.min ?? Number.NEGATIVE_INFINITY;
    const max = field.validation?.max ?? Number.POSITIVE_INFINITY;
    const parsed = parseNumber(value, field.key, errors, min, max);
    if (
      parsed !== null &&
      field.validation?.integer &&
      !Number.isInteger(parsed)
    ) {
      errors[field.key] = `Use a whole number from ${min} to ${max}.`;
    }
    return;
  }

  if (field.required && isBlank(value)) {
    errors[field.key] = requiredMessage;
  }
}

export function validateSection(
  schema: OnboardingSchema,
  sectionId: string,
  answers: OnboardingAnswers,
): Record<string, string> {
  const section = schema.sections.find((item) => item.id === sectionId);
  if (!section) return { form: "Unknown section." };
  return validateSectionFields(section, answers);
}

export function validateSectionFields(
  section: FormSection,
  answers: OnboardingAnswers,
) {
  const errors: Record<string, string> = {};
  for (const field of section.fields) validateField(field, answers, errors);
  return errors;
}

export function validateAnswers(schema: OnboardingSchema, input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ValidationError({ form: "Submit a complete onboarding form." });
  }

  const allowed = new Set(collectAnswerKeys(schema));
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) {
      throw new ValidationError({
        form: "Unexpected fields were sent. Refresh and try again.",
      });
    }
  }

  const answers = input as OnboardingAnswers;
  const errors: Record<string, string> = {};
  for (const section of schema.sections) {
    Object.assign(errors, validateSectionFields(section, answers));
  }
  if (Object.keys(errors).length > 0) throw new ValidationError(errors);
  return answers;
}

export function emptyAnswers(schema: OnboardingSchema): OnboardingAnswers {
  const answers: OnboardingAnswers = {};
  for (const field of schema.sections.flatMap((section) => section.fields)) {
    if (field.type === "multi_select") answers[field.key] = [];
    else if (field.type === "acknowledgement")
      answers[field.key] = false;
    else if (field.type === "scale") answers[field.key] = null;
    else if (field.type === "unit_number") {
      answers[field.key] = "";
      answers[field.unitKey] = field.defaultUnit;
      if (field.companionKey) answers[field.companionKey] = "";
    } else answers[field.key] = "";
  }
  return answers;
}

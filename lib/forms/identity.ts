import { allFields } from "@/lib/onboarding/schema/visibility";
import type { FormField, OnboardingAnswers, OnboardingSchema } from "@/lib/onboarding/schema/types";
import { FormServiceError } from "./errors";

export type ClientIdentityMapping = {
  fullNameFieldKey: string;
  emailFieldKey: string;
  phoneFieldKey?: string | null;
};

export const V1_IDENTITY_MAPPING: ClientIdentityMapping = {
  fullNameFieldKey: "full_name",
  emailFieldKey: "email",
  phoneFieldKey: "phone",
};

const NAME_TYPES = new Set(["short_text", "long_text"]);
const EMAIL_TYPES = new Set(["email"]);
const PHONE_TYPES = new Set(["phone", "short_text"]);

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function defaultIdentityMapping(schema: OnboardingSchema): ClientIdentityMapping | null {
  const fields = allFields(schema);
  const fullName =
    fields.find((field) => field.key === "full_name" && NAME_TYPES.has(field.type)) ??
    fields.find((field) => NAME_TYPES.has(field.type));
  const email =
    fields.find((field) => field.key === "email" && EMAIL_TYPES.has(field.type)) ??
    fields.find((field) => EMAIL_TYPES.has(field.type));
  const phone =
    fields.find((field) => field.key === "phone" && PHONE_TYPES.has(field.type)) ??
    fields.find((field) => field.type === "phone");
  if (!fullName || !email) return null;
  return {
    fullNameFieldKey: fullName.key,
    emailFieldKey: email.key,
    phoneFieldKey: phone?.key ?? null,
  };
}

export function identityMappingIssues(schema: OnboardingSchema, mapping: ClientIdentityMapping | null | undefined) {
  const issues: string[] = [];
  if (!mapping) {
    issues.push("Choose the questions that identify the client before publishing.");
    return issues;
  }
  const fields = new Map(allFields(schema).map((field) => [field.key, field]));
  const nameField = fields.get(mapping.fullNameFieldKey);
  const emailField = fields.get(mapping.emailFieldKey);
  if (!nameField) issues.push("Client name question is missing.");
  else if (!NAME_TYPES.has(nameField.type)) issues.push("Client name must use a text question.");
  if (!emailField) issues.push("Client email question is missing.");
  else if (!EMAIL_TYPES.has(emailField.type)) issues.push("Client email must use an email question.");
  if (mapping.phoneFieldKey) {
    const phoneField = fields.get(mapping.phoneFieldKey);
    if (!phoneField) issues.push("Client phone question is missing.");
    else if (!PHONE_TYPES.has(phoneField.type)) issues.push("Client phone must use a phone or short text question.");
  }
  return issues;
}

export function assertCollectibleMapping(schema: OnboardingSchema, mapping: ClientIdentityMapping | null | undefined) {
  const issues = identityMappingIssues(schema, mapping);
  if (issues.length > 0) throw new FormServiceError(issues[0]);
  return mapping as ClientIdentityMapping;
}

export function isCollectibleMapping(schema: OnboardingSchema, mapping: ClientIdentityMapping | null | undefined) {
  return identityMappingIssues(schema, mapping).length === 0;
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

export function extractClientIdentity(answers: OnboardingAnswers, mapping: ClientIdentityMapping) {
  const fullName = asString(answers[mapping.fullNameFieldKey]);
  const email = asString(answers[mapping.emailFieldKey]);
  const phone = mapping.phoneFieldKey ? asString(answers[mapping.phoneFieldKey]) : "";
  if (!fullName) throw new FormServiceError("Enter the client's name.");
  if (!email) throw new FormServiceError("Enter the client's email.");
  return {
    fullName,
    email,
    normalizedEmail: normalizeEmail(email),
    phone: phone || null,
  };
}

export function identityFieldOptions(schema: OnboardingSchema, kind: "name" | "email" | "phone") {
  const allowed = kind === "name" ? NAME_TYPES : kind === "email" ? EMAIL_TYPES : PHONE_TYPES;
  return allFields(schema)
    .filter((field: FormField) => allowed.has(field.type))
    .map((field) => ({ key: field.key, label: field.label }));
}

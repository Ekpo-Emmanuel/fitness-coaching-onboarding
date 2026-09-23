import type { OnboardingSchema } from "@/lib/onboarding/schema/types";
import type { ReviewRuleSet } from "@/lib/review/types";

export function buildFormCatalog(schema: OnboardingSchema, reviewRules?: ReviewRuleSet | null) {
  return {
    sections: schema.sections.map((section, position) => ({
      ref: section.key,
      title: section.title,
      position,
      questions: section.fields.map((field, fieldPosition) => ({
        ref: field.key,
        label: field.label,
        type: field.type,
        required: Boolean(field.required),
        position: fieldPosition,
      })),
    })),
    reviewRules: (reviewRules?.rules ?? []).map((rule) => ({ ref: rule.code, label: rule.label })),
  };
}

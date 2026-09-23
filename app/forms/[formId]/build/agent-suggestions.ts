import { allFields } from "@/lib/onboarding/schema/visibility";
import type { OnboardingSchema } from "@/lib/onboarding/schema/types";
import type { ReviewRuleSet } from "@/lib/review/types";

function unique(values: string[]) {
  return [...new Set(values)];
}

function mentions(haystack: string[], pattern: RegExp) {
  return haystack.some((value) => pattern.test(value));
}

export function agentStarterPrompts(schema?: OnboardingSchema | null, rules?: ReviewRuleSet | null) {
  const sections = schema?.sections ?? [];
  const fields = schema ? allFields(schema) : [];
  const titles = sections.map((section) => section.title.toLowerCase());
  const labels = fields.map((field) => `${field.label} ${field.key}`.toLowerCase());
  const text = [...titles, ...labels];
  if (fields.length <= 4) {
    return [
      "Create an onboarding for online coaching clients.",
      "Add questions about training experience.",
      "Add questions about injuries and limitations.",
      "Review my form and suggest what I'm missing.",
    ];
  }
  const prompts: string[] = [];
  const largest = sections.reduce((current, section) => (section.fields.length > current.fields.length ? section : current), sections[0]);
  if (largest && largest.fields.length >= 5) prompts.push(`Make the ${largest.title} section shorter.`);
  if (fields.length >= 12) prompts.push("Make this onboarding shorter.");
  if (!rules?.rules.length) prompts.push("Suggest useful review rules.");
  if (!mentions(text, /injur|pain|limit/)) prompts.push("Ask about injuries.");
  if (!mentions(text, /sleep|recover|lifestyle/)) prompts.push("Add questions about sleep and recovery.");
  if (!mentions(text, /train|gym|experience/)) prompts.push("Add questions about training experience.");
  if (prompts.length < 3) prompts.push("Review my form and suggest what I'm missing.");
  return unique(prompts).slice(0, 4);
}

export function agentNextPrompts(details: string[]) {
  const text = details.join(" ").toLowerCase();
  const prompts: string[] = [];
  if (/train/.test(text)) {
    prompts.push("Add training frequency.");
    prompts.push("Ask about gym access.");
  }
  if (/injur|pain/.test(text)) prompts.push("Ask for more detail when someone reports pain.");
  if (/nutrition|food|diet/.test(text)) prompts.push("Ask about food preferences.");
  if (/sleep|lifestyle|recover/.test(text)) prompts.push("Ask about recovery.");
  if (!prompts.length) {
    prompts.push("Add a question about weekly routine.");
    prompts.push("Review my form for anything important I'm missing.");
  }
  return unique(prompts).slice(0, 3);
}

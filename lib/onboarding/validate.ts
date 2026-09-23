import { emmanuelOnboardingV1 } from "./schemas/emmanuel-onboarding-v1";
import { validateAnswers, validateSectionFields, ValidationError } from "./schema/engine";
import type { OnboardingDraft, ValidatedOnboarding } from "./types";

export { ValidationError };

export const STEP_TITLES = [
  emmanuelOnboardingV1.intro.navLabel,
  ...emmanuelOnboardingV1.sections.map((section) => section.navLabel ?? section.title),
];

export function validateStep(step: number, data: OnboardingDraft): Record<string, string> {
  if (step <= 0) return {};
  const section = emmanuelOnboardingV1.sections[step - 1];
  if (!section) return {};
  return validateSectionFields(section, data);
}

export function validateSubmission(input: unknown): ValidatedOnboarding {
  return validateAnswers(emmanuelOnboardingV1, input) as ValidatedOnboarding;
}

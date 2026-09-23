"use client";

import { OnboardingRenderer } from "./OnboardingRenderer";
import { submitLegacyOnboarding } from "@/lib/onboarding/client-submit";
import { emmanuelOnboardingV1 } from "@/lib/onboarding/schemas/emmanuel-onboarding-v1";

export function OnboardingFlow() {
  return <OnboardingRenderer schema={emmanuelOnboardingV1} onSubmit={submitLegacyOnboarding} />;
}

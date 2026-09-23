"use client";
import { OnboardingRenderer, type PublicBranding } from "@/app/onboarding/OnboardingRenderer";
import type { OnboardingSchema } from "@/lib/onboarding/schema/types";
export function PublicDesignPreview({ schema, branding }: { schema: OnboardingSchema; branding: PublicBranding }) {
  return <OnboardingRenderer schema={schema} branding={branding} persistAnswers={false} mode="preview" onSubmit={async () => undefined}/>;
}

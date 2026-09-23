import { notFound } from "next/navigation";
import { OnboardingFlow } from "@/app/onboarding/OnboardingFlow";

/** Dev-only harness for the unmounted V1 client renderer. Not a product route. */
export default function LegacyOnboardingHarnessPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <OnboardingFlow />;
}

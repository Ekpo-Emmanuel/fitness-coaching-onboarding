import { LandingPage } from "@/components/marketing/LandingPage";
import { getSessionUser } from "@/lib/workspace/session";

export const metadata = {
  title: {
    absolute: "Coaching — AI Client Onboarding for Fitness Coaches",
  },
  description:
    "Build fitness coaching onboarding forms with AI, collect structured client information, generate coaching-ready briefs, and connect submissions to your existing tools.",
};

export default async function Home() {
  let signedIn = false;
  try {
    signedIn = Boolean(await getSessionUser());
  } catch {
    signedIn = false;
  }
  return <LandingPage signedIn={signedIn} />;
}

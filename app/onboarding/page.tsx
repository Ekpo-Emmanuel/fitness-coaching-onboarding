import { Brand } from "@/components/product/Brand";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CoachingProfileForm } from "@/components/product/CoachingProfileForm";
import { getWorkspaceContext, requireUser } from "@/lib/workspace/session";

export const dynamic = "force-dynamic";

export default async function CoachSetupPage() {
  await requireUser();
  const context = await getWorkspaceContext();
  if (context?.workspace && context.profile) {
    redirect("/dashboard");
  }

  return (
    <main className="setup-page">
      <Link href="/"><Brand /></Link>
      <div className="setup-layout"><section>
        <p className="eyebrow">Coach setup · Your foundation</p>
        <h1>A workspace that understands your coaching.</h1>
        <p>Tell us who you help and how you work. Your Agent uses this context to build more thoughtful onboarding.</p>
        <p className="setup-note">You can refine these details anytime in your coaching profile.</p>
      </section><div>
        <CoachingProfileForm
          mode="setup"
          initial={{ coachName: context?.user.name ?? "", requiresHealthScreening: true }}
        />
      </div></div>
    </main>
  );
}

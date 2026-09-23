import { AppShell } from "@/components/product/AppShell";
import { CoachingProfileForm } from "@/components/product/CoachingProfileForm";
import { requireWorkspace } from "@/lib/workspace/session";

export const dynamic = "force-dynamic";

export default async function SettingsProfilePage() {
  const { profile } = await requireWorkspace();

  return (
    <AppShell businessName={profile.businessName}>
      <main className="mx-auto w-full max-w-7xl px-4 py-10">
        <p className="font-mono text-xs tracking-[0.22em] text-muted uppercase">Settings</p>
        <h1 className="mt-3 font-display text-4xl tracking-tight">Coaching profile</h1>
        <p className="mt-3 max-w-[50ch] text-muted">Give your Agent context about who you coach and how you work. Published forms stay unchanged.</p>
        <div className="mt-10">
          <CoachingProfileForm
            mode="edit"
            initial={{
              businessName: profile.businessName,
              coachName: profile.coachName,
              coachingTypes: profile.coachingTypes,
              targetClientDescription: profile.targetClientDescription,
              providesNutritionCoaching: profile.providesNutritionCoaching,
              requiresHealthScreening: profile.requiresHealthScreening,
              coachingPhilosophy: profile.coachingPhilosophy ?? "",
              programmingConsiderations: profile.programmingConsiderations ?? "",
            }}
          />
        </div>
      </main>
    </AppShell>
  );
}
